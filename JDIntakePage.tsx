import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Company, JD, CRA } from '../types';
import { formatIndianDate } from '../utils/formatters';
import {
  FileText,
  CheckCircle,
  Sparkles,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Edit3,
  UploadCloud,
  Loader2,
  File,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  X,
  Layers,
  Check,
  RefreshCw,
  Info,
  Clock,
} from 'lucide-react';

interface StagedFileItem {
  id: string;
  file: File;
  title: string;
  company: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  error?: string;
  isVerified?: boolean;
}

const extractHtmlJobMetadata = (parsedDocument: Document, fileName?: string) => {
  let title = '';
  let company = '';

  // 1. JSON-LD scripts
  const jsonLdScripts = Array.from(parsedDocument.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of jsonLdScripts) {
    try {
      const parsed = JSON.parse(script.textContent || '');
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const jobPosting = entries.find((entry) => {
        const types = Array.isArray(entry?.['@type']) ? entry['@type'] : [entry?.['@type']];
        return types.includes('JobPosting');
      });

      if (jobPosting) {
        title = jobPosting.title || jobPosting.name || '';
        company = jobPosting.hiringOrganization?.name || '';
        break;
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  // 2. Page Title parsing (e.g. "Application Security Analyst _ ZS _ LinkedIn" or "Engineer I - Cisco | LinkedIn")
  const pageTitle = parsedDocument.title?.trim() || '';
  if ((!title || !company) && pageTitle) {
    const parts = pageTitle
      .split(/\s*[_|\-–—]\s*/)
      .map((p) => p.trim())
      .filter((p) => p && !p.toLowerCase().includes('linkedin'));
    if (!title && parts.length > 0) title = parts[0];
    if (!company && parts.length > 1) company = parts[1];
  }

  // 3. Fallback to File Name parsing (e.g. "Application Security Analyst _ ZS _ LinkedIn.html")
  if ((!title || !company) && fileName) {
    const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/_ LinkedIn$/i, '').trim();
    const nameParts = cleanName
      .split(/\s*[_|\-–—]\s*/)
      .map((p) => p.trim())
      .filter((p) => p && !p.toLowerCase().includes('linkedin'));
    if (!title && nameParts.length > 0) title = nameParts[0];
    if (!company && nameParts.length > 1) company = nameParts[1];
  }

  // 4. Headings
  if (!title) {
    title = parsedDocument.querySelector('h1, h2')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  return { title, company };
};

const extractCleanJobText = (parsedDocument: Document, maxChars: number = 4000): string => {
  try {
    const clone = parsedDocument.cloneNode(true) as Document;
    // Strip scripts, styles, metadata, media, telemetry
    const tagsToRemove = clone.querySelectorAll(
      'script, style, noscript, svg, iframe, link, meta, object, embed, canvas'
    );
    tagsToRemove.forEach((el) => el.remove());

    // Prefer specific job posting content containers if present
    const selectors = [
      '.description__text',
      '.job-description',
      '.show-more-less-html__markup',
      '[data-job-description]',
      '.jobs-description-content__text',
      '.jobs-box__html-content',
      'article',
      'main',
    ];

    for (const sel of selectors) {
      const match = clone.querySelector(sel);
      if (match && match.textContent && match.textContent.trim().length > 60) {
        return match.textContent.replace(/\s+/g, ' ').trim().slice(0, maxChars);
      }
    }

    const bodyText = clone.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
    return bodyText.slice(0, maxChars);
  } catch {
    return (parsedDocument.body?.textContent?.replace(/\s+/g, ' ').trim() || '').slice(0, maxChars);
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const JDIntakePage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recentJDs, setRecentJDs] = useState<JD[]>([]);
  const [currentUser, setCurrentUser] = useState<CRA | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('placemein:admin_verified') === 'true';
  });
  const [verifyingJdId, setVerifyingJdId] = useState<string | null>(null);
  const [useExistingCompany, setUseExistingCompany] = useState<boolean>(false);
  const [companyInput, setCompanyInput] = useState('');
  const [industryInput, setIndustryInput] = useState('');
  const [jdTitle, setJdTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [opportunityType, setOpportunityType] = useState<'existing_post' | 'cold_outreach'>('existing_post');
  const [intakeMethod, setIntakeMethod] = useState<'file_ai_extract' | 'manual_entry'>('file_ai_extract');
  const [isVerified, setIsVerified] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastLoggedCompany, setLastLoggedCompany] = useState<string | null>(null);

  // File Extraction & Batch queue state
  const [stagedFiles, setStagedFiles] = useState<StagedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentFileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [extractedFilename, setExtractedFilename] = useState<string>('');
  const [htmlVerification, setHtmlVerification] = useState<boolean | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<{ ai_active: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<{ company?: string; title?: string }>({});

  const handleQuickFillSample = () => {
    setCompanyInput('NStarX Technologies');
    setIndustryInput('Information Technology');
    setJdTitle('Data Engineer');
    setRawText(`Role: Data Engineer
Location: Bengaluru / Remote
Requirements:
- 2+ years experience building data pipelines with Python and SQL
- Familiarity with PostgreSQL, Apache Airflow, and Cloud Data Warehouses
- Passion for analytics and high-volume data engineering
- Good communication and collaboration skills`);
    setOpportunityType('existing_post');
    setIsVerified(true);
    setFormErrors({});
    setMessage({
      type: 'success',
      text: 'Sample opportunity filled! Click "Submit & Save Opportunity to CRM" below to test saving.',
    });
  };

  const loadJDs = async () => {
    try {
      const jds = await api.getJDs();
      setRecentJDs(jds);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyJD = async (jdId: string, verify: boolean) => {
    setVerifyingJdId(jdId);
    try {
      await api.verifyJD(jdId, verify);
      setMessage({
        type: 'success',
        text: verify
          ? 'Opportunity approved and marked as verified by Manager/Admin!'
          : 'Opportunity marked as unverified / rejected.',
      });
      await loadJDs();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to update opportunity verification status',
      });
    } finally {
      setVerifyingJdId(null);
    }
  };

  useEffect(() => {
    api.getCompanies().then(setCompanies).catch(console.error);
    loadJDs();
    api.getJDExtractionStatus().then(setExtractionStatus).catch(() => undefined);
    api.getCurrentCRA()
      .then((user) => {
        setCurrentUser(user);
        const adminVerified = sessionStorage.getItem('placemein:admin_verified') === 'true';
        setIsAdmin(user?.role === 'admin' || adminVerified);
      })
      .catch(() => undefined);
  }, []);

  const handleMethodChange = (method: 'file_ai_extract' | 'manual_entry') => {
    setIntakeMethod(method);
    setExtractionConfidence(null);
    setHtmlVerification(null);
    setIsVerified(false);
  };

  const handleSingleFileFormSync = async (file: File) => {
    if (!file) return;
    setExtracting(true);
    setMessage(null);
    setExtractionConfidence(null);
    setHtmlVerification(null);

    try {
      if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm') || file.type === 'text/html') {
        const html = await file.text();
        const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
        const cleanText = extractCleanJobText(parsedDocument, 4000);
        const jobSignals = ['job', 'role', 'position', 'responsibilities', 'requirements', 'qualifications', 'apply'];
        const signalCount = jobSignals.filter((signal) => cleanText.toLowerCase().includes(signal)).length;
        const verified = Boolean(parsedDocument.documentElement && parsedDocument.title.trim() && cleanText.length >= 50 && signalCount >= 1);
        const metadata = extractHtmlJobMetadata(parsedDocument, file.name);

        setExtractedFilename(file.name);
        setRawText(`[Source HTML: ${file.name}]\n\n${cleanText}`);
        if (metadata.company) {
          const matched = companies.find(
            (company) => company.name.toLowerCase().trim() === metadata.company.toLowerCase().trim()
          );
          setCompanyInput(matched?.name || metadata.company);
          if (matched?.industry) setIndustryInput(matched.industry);
          setFormErrors((prev) => ({ ...prev, company: undefined }));
        }
        if (metadata.title) {
          setJdTitle(metadata.title);
          setFormErrors((prev) => ({ ...prev, title: undefined }));
        }
        setHtmlVerification(verified);
        setIsVerified(verified);
        setMessage({
          type: verified ? 'success' : 'error',
          text: verified
            ? `'${file.name}' is Verified: valid HTML with recognizable job posting content. Review auto-filled fields below.`
            : `'${file.name}' is Not Verified: the file does not look like a complete job posting HTML document.`,
        });
        return;
      }

      try {
        const res = await api.extractJDFromFile(file);
        setExtractedFilename(res.filename);
        setExtractionConfidence(res.confidence);
        setExtractionStatus({ ai_active: !!res.ai_active, message: res.ai_active ? 'AI-powered extraction active' : 'Basic extraction — review fields carefully' });

        if (res.company_name) {
          const matched = companies.find(
            (c) => c.name.toLowerCase().trim() === res.company_name.toLowerCase().trim()
          );
          if (matched) {
            setCompanyInput(matched.name);
            if (matched.industry) setIndustryInput(matched.industry);
          } else {
            setCompanyInput(res.company_name);
          }
          setFormErrors((prev) => ({ ...prev, company: undefined }));
        }

        if (res.role_title) {
          setJdTitle(res.role_title);
          setFormErrors((prev) => ({ ...prev, title: undefined }));
        }

        const formattedRaw = `[Source File: ${res.filename}]\n\n${res.raw_text}`;
        setRawText(formattedRaw);

        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
        if (isPdf) {
          setIsVerified(false);
          setHtmlVerification(false);
          setMessage({
            type: 'success',
            text: `Extracted text from PDF '${res.filename}'. Note: As a PDF document, it requires Manager/Admin manual approval before verification.`,
          });
        } else {
          setIsVerified(res.confidence === 'high');
          setHtmlVerification(res.confidence === 'high');
          setMessage({
            type: 'success',
            text: `Extracted text from '${res.filename}' with ${res.confidence.toUpperCase()} confidence. Review auto-filled fields below.${res.ocr_warning ? ` ${res.ocr_warning}` : ''}`,
          });
        }
      } catch {
        // Fallback for file without backend OCR
        const clean = file.name.replace(/\.[^/.]+$/, '').replace(/_ LinkedIn$/i, '').trim();
        const parts = clean.split(/\s*[_|\-–—]\s*/).map((p) => p.trim()).filter(Boolean);
        const autoTitle = parts[0] || 'Software Engineer';
        const autoComp = parts[1] || 'Hiring Company';
        setExtractedFilename(file.name);
        setJdTitle(autoTitle);
        setCompanyInput(autoComp);
        setRawText(`[Source File: ${file.name}]\n\nOpportunity extracted from '${file.name}'. Ready for submission.`);
        setIsVerified(false);
        setHtmlVerification(false);
        setFormErrors({});
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: `Document extraction error: ${err.message || 'Could not parse document'}. You can still enter details manually.`,
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleFilesSelected = (files: FileList | File[] | null | undefined) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    handleAddFiles(fileArray);
  };

  const handleAddFiles = async (incoming: FileList | File[] | null | undefined) => {
    if (!incoming) return;
    const fileArray = Array.from(incoming);
    if (fileArray.length === 0) return;

    setMessage(null);

    // 1. Deduplicate within the incoming selection itself by filename
    const seenIncoming = new Set<string>();
    const uniqueIncoming: File[] = [];
    for (const file of fileArray) {
      const normalized = file.name.trim().toLowerCase();
      if (!seenIncoming.has(normalized)) {
        seenIncoming.add(normalized);
        uniqueIncoming.push(file);
      }
    }

    // 2. Deduplicate against files already in the upload queue by filename
    const currentQueueNames = new Set(
      stagedFiles.map((sf) => sf.file.name.trim().toLowerCase())
    );
    const filesToStage = uniqueIncoming.filter(
      (file) => !currentQueueNames.has(file.name.trim().toLowerCase())
    );
    const duplicateCount = uniqueIncoming.length - filesToStage.length;

    if (filesToStage.length === 0) {
      setMessage({
        type: 'error',
        text: duplicateCount === 1
          ? `'${uniqueIncoming[0].name}' is already in the upload queue.`
          : `All ${uniqueIncoming.length} selected file(s) are already in the upload queue.`,
      });
      return;
    }

    // 3. Extract metadata for each newly accepted file
    const newItems: StagedFileItem[] = [];
    for (const file of filesToStage) {
      let detectedTitle = '';
      let detectedCompany = '';
      let isVerified = false;

      if (
        file.name.toLowerCase().endsWith('.html') ||
        file.name.toLowerCase().endsWith('.htm') ||
        file.type === 'text/html'
      ) {
        try {
          const html = await file.text();
          const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
          const meta = extractHtmlJobMetadata(parsedDocument, file.name);
          detectedTitle = meta.title;
          detectedCompany = meta.company;
          isVerified = true;
        } catch {
          // ignore parsing errors
        }
      }

      if (!detectedTitle || !detectedCompany) {
        const clean = file.name.replace(/\.[^/.]+$/, '').replace(/_ LinkedIn$/i, '').trim();
        const parts = clean.split(/\s*[_|\-–—]\s*/).map((p) => p.trim()).filter(Boolean);
        if (!detectedTitle && parts.length > 0) detectedTitle = parts[0];
        if (!detectedCompany && parts.length > 1) detectedCompany = parts[1];
      }

      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        title: detectedTitle || 'Software Engineer',
        company: detectedCompany || 'Hiring Company',
        status: 'queued',
        isVerified,
      });
    }

    // 4. Safely append to queue using functional updater to avoid state loss
    setStagedFiles((prev) => {
      const prevNames = new Set(prev.map((item) => item.file.name.trim().toLowerCase()));
      const filteredNew = newItems.filter((item) => !prevNames.has(item.file.name.trim().toLowerCase()));
      const combined = [...prev, ...filteredNew];

      // If only 1 file in total, also sync with single form view
      if (combined.length === 1 && filteredNew.length > 0) {
        handleSingleFileFormSync(filteredNew[0].file);
      }
      return combined;
    });

    // 5. Notify user with clear status
    const totalQueued = stagedFiles.length + newItems.length;
    if (duplicateCount > 0) {
      setMessage({
        type: 'success',
        text: `Added ${newItems.length} file(s) to queue (${duplicateCount} duplicate skipped). Total ${totalQueued} file(s) ready for batch upload.`,
      });
    } else if (totalQueued > 1) {
      setMessage({
        type: 'success',
        text: `Queued ${newItems.length} file(s). Total ${totalQueued} file(s) ready in queue. Click "Process & Save All to CRM" below.`,
      });
    }
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 1) {
        handleSingleFileFormSync(next[0].file);
      } else if (next.length === 0) {
        setExtractedFilename('');
        setExtractionConfidence(null);
        setHtmlVerification(null);
      }
      return next;
    });
  };

  const handleClearQueue = () => {
    setStagedFiles([]);
    setExtractedFilename('');
    setExtractionConfidence(null);
    setHtmlVerification(null);
    setMessage(null);
  };

  const handleProcessBatch = async () => {
    const uncompleted = stagedFiles.filter((sf) => sf.status !== 'done');
    if (uncompleted.length === 0) {
      setMessage({ type: 'success', text: 'All files in the queue have already been processed.' });
      return;
    }

    setBatchProcessing(true);
    setMessage(null);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < uncompleted.length; i++) {
      const item = uncompleted[i];
      setBatchProgress({
        current: i + 1,
        total: uncompleted.length,
        currentFileName: item.file.name,
      });

      setStagedFiles((prev) =>
        prev.map((sf) => (sf.id === item.id ? { ...sf, status: 'processing' } : sf))
      );

      try {
        let compName = item.company;
        let titleName = item.title;
        let textContent = '';
        let verified = false;

        if (
          item.file.name.toLowerCase().endsWith('.html') ||
          item.file.name.toLowerCase().endsWith('.htm') ||
          item.file.type === 'text/html'
        ) {
          const html = await item.file.text();
          const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
          const cleanText = extractCleanJobText(parsedDocument, 4000);
          const meta = extractHtmlJobMetadata(parsedDocument, item.file.name);
          if (meta.company) compName = meta.company;
          if (meta.title) titleName = meta.title;
          verified = true;
          textContent = `[Source HTML: ${item.file.name}]\n\n${cleanText || 'Job posting details'}`;
        } else {
          const isPdf = item.file.name.toLowerCase().endsWith('.pdf') || item.file.type === 'application/pdf';
          try {
            const res = await api.extractJDFromFile(item.file);
            if (res.company_name) compName = res.company_name;
            if (res.role_title) titleName = res.role_title;
            textContent = `[Source File: ${res.filename}]\n\n${(res.raw_text || '').slice(0, 4000)}`;
            // If it is a PDF, it must be manually checked/approved by manager or admin - never auto-verify
            verified = isPdf ? false : (res.confidence === 'high');
          } catch {
            textContent = `[Source File: ${item.file.name}]\n\nLogged from uploaded file '${item.file.name}'. Awaiting manager manual review.`;
            verified = false;
          }
        }

        const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        const newNormTitle = norm(titleName);

        // Check or create company
        let compId: string;
        const matched = companies.find(
          (c) => c.name.toLowerCase().trim() === compName.toLowerCase().trim()
        );
        if (matched) {
          compId = matched.id;
          // Rule: If company exists and role is the same, leave it and don't allow to store!
          const existingRolesForComp = recentJDs.filter((j) => j.company_id === matched.id);
          const dupRole = existingRolesForComp.find((j) => norm(j.title) === newNormTitle);
          if (dupRole) {
            setStagedFiles((prev) =>
              prev.map((sf) =>
                sf.id === item.id
                  ? {
                      ...sf,
                      status: 'failed',
                      error: `Duplicate role: "${titleName}" already exists for "${matched.name}". Skipped duplicate.`,
                    }
                  : sf
              )
            );
            failCount++;
            continue;
          }
        } else {
          const created = await api.createCompany({ name: compName, source: 'manual' });
          compId = created.id;
          setCompanies((prev) => [...prev, created]);
        }

        const isPdf = item.file.name.toLowerCase().endsWith('.pdf') || item.file.type === 'application/pdf';
        await api.createJD({
          company_id: compId,
          title: titleName,
          raw_text: textContent,
          opportunity_type: 'existing_post',
          is_verified: verified,
          verification_source: isPdf ? 'pdf_upload' : 'file_ai_extract',
        });

        setStagedFiles((prev) =>
          prev.map((sf) =>
            sf.id === item.id
              ? { ...sf, status: 'done', title: titleName, company: compName, isVerified: verified }
              : sf
          )
        );
        successCount++;
      } catch (err: any) {
        setStagedFiles((prev) =>
          prev.map((sf) =>
            sf.id === item.id ? { ...sf, status: 'failed', error: err.message || 'Failed to save' } : sf
          )
        );
        failCount++;
      }
    }

    setBatchProcessing(false);
    setBatchProgress(null);
    await loadJDs();

    setMessage({
      type: successCount > 0 ? 'success' : 'error',
      text: `Bulk upload complete: Successfully processed ${successCount} opportunity(s) into CRM${
        failCount > 0 ? ` (${failCount} failed)` : ''
      }. Verified opportunities are immediately available below!`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const errors: { company?: string; title?: string } = {};
    if (!companyInput.trim()) {
      errors.company = 'Please enter or select a Company Name.';
    }
    if (!jdTitle.trim()) {
      errors.title = 'Please enter a Job Title (e.g. Senior Fullstack Engineer).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setMessage({
        type: 'error',
        text: 'Please fill in Company Name and Job Title before saving the opportunity.',
      });
      return;
    }

    setFormErrors({});
    setSubmitting(true);

    try {
      let companyId: string | undefined;

      const existingComp = companies.find(
        (c) => c.name.toLowerCase().trim() === companyInput.toLowerCase().trim()
      );

      const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      const newNormTitle = norm(jdTitle);

      if (existingComp) {
        companyId = existingComp.id;
        // Check if role already exists for this company:
        // Rule: "if it existed then see the role that entred if it is a different role add it but if it is a same role leave it dont allow to store"
        const existingRolesForComp = recentJDs.filter((j) => j.company_id === existingComp.id);
        const dupRole = existingRolesForComp.find((j) => norm(j.title) === newNormTitle);
        if (dupRole) {
          setSubmitting(false);
          setMessage({
            type: 'error',
            text: `⚠️ Duplicate Role Rejected: Company "${existingComp.name}" already has the role "${jdTitle.trim()}". Duplicate roles for the same company are not allowed to be stored.`,
          });
          return;
        }
      } else {
        const createdComp = await api.createCompany({
          name: companyInput.trim(),
          industry: industryInput.trim() || undefined,
          source: 'manual',
        });
        companyId = createdComp.id;
        setCompanies((prev) => [...prev, createdComp]);
      }

      const textToSave = (rawText.trim() || `Job opportunity for ${jdTitle.trim()} at ${companyInput.trim()}. Verified by CRA.`).slice(0, 4000);

      const isPdf = extractedFilename.toLowerCase().endsWith('.pdf') || (rawText && rawText.includes('[Source File:') && rawText.toLowerCase().includes('.pdf'));
      const finalVerified = isPdf ? false : isVerified;
      const finalSource = isPdf ? 'pdf_upload' : intakeMethod;

      const createdJD = await api.createJD({
        company_id: companyId,
        title: jdTitle.trim(),
        raw_text: textToSave,
        opportunity_type: opportunityType,
        is_verified: finalVerified,
        verification_source: finalSource,
      });

      try {
        localStorage.setItem('placemein:hr-sourcing-prefill', JSON.stringify({
          company: companyInput.trim(),
          title: jdTitle.trim(),
        }));
      } catch (_) {}

      const savedCompName = companyInput.trim();
      setLastLoggedCompany(savedCompName);

      setMessage({
        type: 'success',
        text: isPdf
          ? `PDF Opportunity '${createdJD.title}' for '${savedCompName}' logged! It requires Manager/Admin approval before verification.`
          : `Opportunity '${createdJD.title}' for '${savedCompName}' logged & saved to CRM successfully!`,
      });

      setCompanyInput('');
      setIndustryInput('');
      setJdTitle('');
      setRawText('');
      setIsVerified(false);
      setExtractionConfidence(null);
      setExtractedFilename('');
      setHtmlVerification(null);
      loadJDs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit JD intake.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-indigo-400" />
          JD & Opportunity Intake
        </h1>
        <p className="text-gray-400 text-sm">Log opportunities via File Auto-Extraction (PDF/DOCX/Image), URL Parser, or Manual Entry</p>
      </div>

      {extractionStatus && <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${extractionStatus.ai_active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-100'}`}><Sparkles className="h-4 w-4 shrink-0" />{extractionStatus.message}{!extractionStatus.ai_active && ' — confidence is capped at Medium.'}</div>}

      {message && (
        <div
          className={`p-4 rounded-xl space-y-2 border ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {message.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
          {message.type === 'success' && lastLoggedCompany && (
            <div className="pt-2 border-t border-emerald-500/20 text-xs text-emerald-300/80">
              Opportunity recorded. Next step: Head to <strong>HR Sourcing</strong> to find recruiters and source contacts for this company.
            </div>
          )}
        </div>
      )}

      {/* Intake Mode Selection Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tab 1: File Upload */}
        <button
          type="button"
          onClick={() => handleMethodChange('file_ai_extract')}
          className={`p-4 rounded-xl border text-left flex items-start space-x-3 transition cursor-pointer ${
            intakeMethod === 'file_ai_extract'
              ? 'bg-indigo-900/30 border-indigo-500 text-white shadow-lg'
              : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <UploadCloud className={`h-6 w-6 mt-0.5 ${intakeMethod === 'file_ai_extract' ? 'text-indigo-400' : 'text-gray-400'}`} />
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <span>File Upload (HTML / PDF / DOCX / Image)</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Direct file upload and batch processing. Automatically extracts job details and saves to CRM.</p>
          </div>
        </button>

        {/* Tab 2: Manual Entry */}
        <button
          type="button"
          onClick={() => handleMethodChange('manual_entry')}
          className={`p-4 rounded-xl border text-left flex items-start space-x-3 transition cursor-pointer ${
            intakeMethod === 'manual_entry'
              ? 'bg-indigo-900/30 border-indigo-500 text-white shadow-lg'
              : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <Edit3 className={`h-6 w-6 mt-0.5 ${intakeMethod === 'manual_entry' ? 'text-amber-400' : 'text-gray-400'}`} />
          <div>
            <div className="flex items-center gap-2 font-semibold text-sm">
              <span>Manual Text Paste</span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Form Entry</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Directly fill in company name, job title, and paste job description text.</p>
          </div>
        </button>
      </div>

      {intakeMethod === 'file_ai_extract' ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6 shadow-sm">
          {/* File Upload Zone */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">
                Upload Job Description Files (HTML, PDF, DOCX, JPG, PNG)
              </label>
              <span className="text-xs text-indigo-400 font-medium bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Info className="h-3 w-3" />
                Multi-file & batch upload enabled
              </span>
            </div>

            {/* Native Multi-File Selection Input */}
            <input
              id="jd-bulk-file-input"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".html,.htm,.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesSelected(e.target.files);
                }
                e.target.value = '';
              }}
              className="hidden"
            />

            {/* Drag & Drop Box */}
            <div
              id="jd-dropzone"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesSelected(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer relative ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-950/50 ring-2 ring-indigo-500/50'
                  : 'border-gray-700 hover:border-indigo-500 bg-gray-900/40'
              }`}
            >
              {extracting ? (
                <div className="pointer-events-none flex flex-col items-center space-y-2 text-indigo-400 py-3">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm font-semibold">Reading document & extracting metadata...</p>
                  <p className="text-xs text-gray-400">Extracting company name, job title, and requirements</p>
                </div>
              ) : (
                <div className="pointer-events-none flex flex-col items-center space-y-2 py-3">
                  <UploadCloud className="h-10 w-10 text-indigo-400" />
                  <p className="text-sm font-medium text-white">
                    Drop one or multiple JD files here, or <span className="text-indigo-400 underline font-semibold pointer-events-auto">browse files</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Supports LinkedIn HTML downloads, PDF resumes/JDs, Word (.docx), and screenshots (.png, .jpg)
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-800/80 border border-gray-700 text-[11px] text-gray-300">
                    <span className="font-semibold text-indigo-300">💡 Tip:</span> Hold <kbd className="bg-gray-700 px-1 py-0.5 rounded text-gray-200 font-mono text-[10px]">⌘ Cmd</kbd> (Mac) or <kbd className="bg-gray-700 px-1 py-0.5 rounded text-gray-200 font-mono text-[10px]">Ctrl</kbd> (Windows) in your file picker to select multiple files at once.
                  </div>
                </div>
              )}
            </div>

            {/* Staged Files Queue */}
            {stagedFiles.length > 0 && (
              <div className="bg-gray-900/70 border border-gray-700/80 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">
                      Upload Queue ({stagedFiles.length} file{stagedFiles.length === 1 ? '' : 's'})
                    </h3>
                    <span className="text-xs text-gray-400">
                      ({stagedFiles.filter((f) => f.status === 'done').length} saved, {stagedFiles.filter((f) => f.status === 'queued').length} ready)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1 text-xs font-medium text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add More Files
                    </button>
                    <button
                      type="button"
                      onClick={handleClearQueue}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-rose-400 rounded transition cursor-pointer"
                      title="Clear queue"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* File Items List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {stagedFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-gray-800/80 border border-gray-700/60 text-xs hover:border-gray-600 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-gray-700/80 text-gray-300 font-mono text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <File className="h-4 w-4 text-indigo-400 shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold text-white truncate">{item.file.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-gray-400">
                            <span>{formatFileSize(item.file.size)}</span>
                            {item.company && (
                              <span className="inline-flex items-center gap-1 text-indigo-300 font-medium">
                                <Building2 className="h-3 w-3" />
                                {item.company}
                              </span>
                            )}
                            {item.title && (
                              <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                                <FileText className="h-3 w-3" />
                                {item.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 text-indigo-400 font-medium">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </span>
                        )}
                        {item.status === 'done' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                            <Check className="h-3 w-3" />
                            Saved to CRM
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold" title={item.error}>
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </span>
                        )}
                        {item.status === 'queued' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300 font-medium">
                            Ready
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedFile(item.id)}
                          className="text-gray-400 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                          title="Remove file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Batch Progress Bar */}
                {batchProgress && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-700/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-300 font-medium flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Processing {batchProgress.current} of {batchProgress.total}: {batchProgress.currentFileName}
                      </span>
                      <span className="font-mono text-gray-400">
                        {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Batch Action Button */}
                {stagedFiles.some((f) => f.status !== 'done') && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={batchProcessing}
                      onClick={handleProcessBatch}
                      className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 shadow-md transition cursor-pointer text-sm"
                    >
                      {batchProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Processing & Saving to CRM...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>
                            {stagedFiles.filter((f) => f.status !== 'done').length === 1
                              ? 'Process & Save 1 File to CRM'
                              : `Process & Save All (${stagedFiles.filter((f) => f.status !== 'done').length}) Files to CRM`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {stagedFiles.length > 0 && stagedFiles.every((f) => f.status === 'done') && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center gap-2 font-medium">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      All {stagedFiles.length} file(s) processed & saved to CRM successfully!
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-white font-semibold rounded transition cursor-pointer"
                    >
                      Upload More Files
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6 shadow-sm">
          {/* Company Selection Mode Toggle & Inputs */}
          <div className="space-y-3 bg-gray-900/40 p-4 rounded-xl border border-gray-700/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-indigo-400" />
                Company Details *
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleQuickFillSample}
                  className="text-xs px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  title="Click to populate demo company & job details"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Fill Demo Sample</span>
                </button>
                <label className="inline-flex items-center cursor-pointer text-xs text-indigo-300 font-medium space-x-2">
                  <input
                    type="checkbox"
                    checked={useExistingCompany}
                    onChange={(e) => {
                      setUseExistingCompany(e.target.checked);
                      if (e.target.checked && companies.length > 0) {
                        setCompanyInput(companies[0].name);
                        setIndustryInput(companies[0].industry || '');
                        setFormErrors((prev) => ({ ...prev, company: undefined }));
                      }
                    }}
                    className="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Select Existing Company</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="md:col-span-2">
                {useExistingCompany ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Choose Existing Company</label>
                    <select
                      value={companyInput}
                      onChange={(e) => {
                        setCompanyInput(e.target.value);
                        const selectedComp = companies.find((c) => c.name === e.target.value);
                        if (selectedComp) {
                          setIndustryInput(selectedComp.industry || '');
                        }
                        if (e.target.value) {
                          setFormErrors((prev) => ({ ...prev, company: undefined }));
                        }
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm font-semibold"
                    >
                      {companies.length === 0 ? (
                        <option value="">No existing companies found</option>
                      ) : (
                        companies.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.industry ? `(${c.industry})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Company Name *</label>
                    <input
                      type="text"
                      list="existing-companies-list"
                      placeholder="e.g. Google, Stripe, Acme Corp..."
                      value={companyInput}
                      onChange={(e) => {
                        setCompanyInput(e.target.value);
                        if (e.target.value.trim()) {
                          setFormErrors((prev) => ({ ...prev, company: undefined }));
                        }
                      }}
                      className={`w-full bg-gray-900 border rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none text-sm ${
                        formErrors.company
                          ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50'
                          : 'border-gray-700 focus:border-indigo-500'
                      }`}
                    />
                    {formErrors.company && (
                      <p className="text-xs text-rose-400 mt-1">{formErrors.company}</p>
                    )}
                    <datalist id="existing-companies-list">
                      {companies.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Industry (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Software, FinTech"
                  value={industryInput}
                  onChange={(e) => setIndustryInput(e.target.value)}
                  disabled={useExistingCompany && !!industryInput}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* Job Title & Opportunity Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Job / Opportunity Title *</label>
              <input
                type="text"
                placeholder="e.g. Senior Fullstack Engineer"
                value={jdTitle}
                onChange={(e) => {
                  setJdTitle(e.target.value);
                  if (e.target.value.trim()) {
                    setFormErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
                className={`w-full bg-gray-900 border rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none text-sm ${
                  formErrors.title
                    ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/50'
                    : 'border-gray-700 focus:border-indigo-500'
                }`}
              />
              {formErrors.title && (
                <p className="text-xs text-rose-400 mt-1">{formErrors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Opportunity Type</label>
              <select
                value={opportunityType}
                onChange={(e: any) => setOpportunityType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
              >
                <option value="existing_post">Existing Job Post</option>
                <option value="cold_outreach">Cold Outreach Target</option>
              </select>
            </div>
          </div>

          {/* Raw Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-300">Job Description Text (Optional)</label>
              <span className="text-xs text-gray-500">Auto-generated summary used if left empty</span>
            </div>
            <textarea
              rows={5}
              placeholder="Paste full job specification, responsibilities, requirements, or tech stack (optional)..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm font-mono"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg flex items-center justify-center space-x-2 transition shadow-md cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Saving Opportunity to CRM...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Submit & Save Opportunity to CRM</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Logged JDs & Verification Badges */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          Logged Opportunities & Verification Badges
        </h2>
        {recentJDs.length === 0 ? (
          <p className="text-sm text-gray-400">No opportunities logged yet.</p>
        ) : (
          <div>
            <div className="md:hidden px-3.5 py-2 bg-gray-900/90 border border-gray-700 rounded-t-lg flex items-center justify-between text-xs text-indigo-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span>👉 Swipe sideways to view all details & approval actions</span>
              </span>
              <span className="text-[10px] text-indigo-300 font-semibold px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/50">
                Scrollable
              </span>
            </div>
            <div className="overflow-x-auto w-full touch-pan-x scrollbar-thin scrollbar-thumb-gray-600">
              <table className="w-full min-w-[760px] text-left text-sm text-gray-300">
              <thead className="bg-gray-900/60 text-xs uppercase text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Verification Badge</th>
                  <th className="px-4 py-3">Logged Date</th>
                  <th className="px-4 py-3 text-right">Approval Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {recentJDs.map((jd) => {
                  const isPdfSource = jd.verification_source === 'pdf_upload' || jd.raw_text?.toLowerCase().includes('.pdf');
                  const autoVerified = jd.verification_source === 'html_url_parser' || jd.is_verified;
                  return (
                    <tr key={jd.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-medium text-white">{jd.title}</td>
                      <td className="px-4 py-3 text-gray-300">{jd.company?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 capitalize">
                        {jd.verification_source === 'pdf_upload' ? 'PDF Upload' : (jd.verification_source || 'manual')}
                      </td>
                      <td className="px-4 py-3">
                        {autoVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {isPdfSource ? 'Manager Approved' : 'Auto-Verified'}
                          </span>
                        ) : isPdfSource ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30" title="PDFs require manual manager/admin approval before verification">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            PDF · Needs Approval
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Needs Review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatIndianDate(jd.created_at || jd.date_found)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {autoVerified ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Approved
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                disabled={verifyingJdId === jd.id}
                                onClick={() => handleVerifyJD(jd.id, false)}
                                className="text-[11px] text-gray-400 hover:text-rose-400 underline transition cursor-pointer"
                                title="Revoke verification status"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin ? (
                              <>
                                <button
                                  type="button"
                                  disabled={verifyingJdId === jd.id}
                                  onClick={() => handleVerifyJD(jd.id, true)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                                  title="Manager/Admin Approval: Approve & Mark Verified"
                                >
                                  {verifyingJdId === jd.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  <span>Approve & Verify</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={verifyingJdId === jd.id}
                                  onClick={() => handleVerifyJD(jd.id, false)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-rose-900/40 text-gray-400 hover:text-rose-300 disabled:opacity-50 text-xs font-medium rounded-lg border border-gray-700 transition cursor-pointer"
                                  title="Reject or Discard"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300/90 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-full">
                                <Clock className="h-3 w-3 text-amber-400" />
                                Awaiting Manager Review
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

