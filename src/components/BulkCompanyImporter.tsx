import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Database,
  Building2,
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
  Filter,
  Search,
  Trash2,
  Edit2,
  X,
  FileText,
  ExternalLink,
  Code2,
  Copy,
  ChevronRight,
  ListFilter,
  CheckSquare,
  Square,
  HelpCircle,
  Server,
  Activity,
  CheckCheck,
  Terminal,
} from 'lucide-react';
import { Company, CRA, TotalCompanyRecord, TotalCompanyImportStatus, TotalCompanyImportBatch, ServerValidationRowResult, ServerValidationResponse } from '../types';
import { api } from '../services/api';
import { supabaseDataService, TOTAL_COMPANY_LIST_SCHEMA_SQL } from '../services/supabaseDataService';
import { clientFallbackStore } from '../services/clientFallbackStore';
import { isSupabaseConfigured } from '../services/supabase';
import { formatIndianDate } from '../utils/formatters';

export interface ParsedCompanyRow {
  rowNumber: number;
  name: string;
  industry: string;
  website: string;
  linkedin_url: string;
  employee_count: string;
  location: string;
  notes: string;
  source: string;
  status: 'valid' | 'duplicate' | 'error';
  validationErrors: string[];
  duplicateReason?: string;
  existingMatchedName?: string;
  feedbackMessage?: string;
  serverValidationStatus?: 'server_validated' | 'client_fallback';
  selected: boolean;
  rawRecord: Record<string, any>;
  isEdited?: boolean;
}

export interface BulkCompanyImporterProps {
  isOpen?: boolean;
  onClose?: () => void;
  onImportComplete?: (summary: {
    importedCount: number;
    duplicateCount: number;
    errorCount: number;
    batchId: string;
  }) => void;
  currentUser?: CRA | null;
  isEmbedded?: boolean;
}

export const BulkCompanyImporter: React.FC<BulkCompanyImporterProps> = ({
  isOpen = true,
  onClose,
  onImportComplete,
  currentUser,
  isEmbedded = false,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'upload' | 'review' | 'logs' | 'sql'>('upload');

  // Input state
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Configuration options
  const [enteredByName, setEnteredByName] = useState(currentUser?.name || 'Aravind Reddy');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'allow_update'>('skip');
  const [sourceTag, setSourceTag] = useState('admin_bulk_importer');

  // Parsed dataset state
  const [parsedRows, setParsedRows] = useState<ParsedCompanyRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgressMsg, setParsingProgressMsg] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Server Validation Engine State
  const [validationEngine, setValidationEngine] = useState<'server' | 'client'>('server');
  const [serverFeedbackSummary, setServerFeedbackSummary] = useState<string>('');
  const [commitLogs, setCommitLogs] = useState<
    Array<{
      row_number: number;
      company_name: string;
      status: string;
      message: string;
      timestamp: string;
    }>
  >([]);
  const [showCommitLogsModal, setShowCommitLogsModal] = useState<boolean>(false);

  // Review filters & search
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'duplicate' | 'error' | 'selected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ParsedCompanyRow>>({});

  // Database audit logs view state (Supabase total_company_list table)
  const [dbLogs, setDbLogs] = useState<TotalCompanyRecord[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsFilterStatus, setLogsFilterStatus] = useState<string>('all');
  const [logsSearch, setLogsSearch] = useState('');
  const [selectedLogRow, setSelectedLogRow] = useState<TotalCompanyRecord | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Completed batch summary state
  const [lastBatchSummary, setLastBatchSummary] = useState<{
    batchId: string;
    totalRows: number;
    imported: number;
    duplicates: number;
    errors: number;
    filename?: string;
  } | null>(null);

  // Load database logs when entering logs tab
  useEffect(() => {
    if (activeTab === 'logs') {
      loadDatabaseLogs();
    }
  }, [activeTab]);

  const loadDatabaseLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const records = await api.getTotalCompanyList();
      setDbLogs(records || []);
    } catch (e) {
      console.warn('Error loading total_company_list audit logs:', e);
      setDbLogs(clientFallbackStore.getTotalCompanyList());
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Helper: Domain normalization for deduplication
  const extractRootDomain = (url?: string): string => {
    if (!url || typeof url !== 'string') return '';
    try {
      const withProto = url.startsWith('http') ? url : `https://${url}`;
      const parsed = new URL(withProto);
      return parsed.hostname.replace(/^www\./, '').toLowerCase().trim();
    } catch {
      return url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
    }
  };

  // Helper: Name cleaning for fuzzy deduplication
  const normalizeCompanyName = (name?: string): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b(private\s+limited|pvt\s+ltd|ltd|limited|inc|incorporated|llc|corp|corporation|technologies|solutions|services|group|co)\b/gi, '')
      .replace(/[^a-z0-9]/gi, '')
      .trim();
  };

  // Row-by-row validation & deduplication engine
  const validateAndDeduplicateRows = (
    rawRows: Record<string, any>[],
    currentFileName?: string
  ): ParsedCompanyRow[] => {
    // 1. Fetch existing companies and total_company_list for lookup
    const existingCompanies = clientFallbackStore.getCompanies();
    const existingTotalCompanyList = clientFallbackStore.getTotalCompanyList();

    const existingNameMap = new Map<string, string>();
    const existingNormNameMap = new Map<string, string>();
    const existingDomainMap = new Map<string, string>();

    // Index active companies
    existingCompanies.forEach((c) => {
      if (c.name) {
        existingNameMap.set(c.name.trim().toLowerCase(), c.name);
        const norm = normalizeCompanyName(c.name);
        if (norm) existingNormNameMap.set(norm, c.name);
      }
      if (c.website) {
        const dom = extractRootDomain(c.website);
        if (dom && dom.includes('.')) existingDomainMap.set(dom, c.name);
      }
    });

    // Index previous successful total_company_list imports
    existingTotalCompanyList.forEach((r) => {
      if (r.name && (r.import_status === 'imported' || r.import_status === 'valid')) {
        existingNameMap.set(r.name.trim().toLowerCase(), r.name);
        const norm = normalizeCompanyName(r.name);
        if (norm) existingNormNameMap.set(norm, r.name);
        if (r.website) {
          const dom = extractRootDomain(r.website);
          if (dom && dom.includes('.')) existingDomainMap.set(dom, r.name);
        }
      }
    });

    // In-file duplicate tracking
    const seenFileNames = new Map<string, number>();
    const seenFileNormNames = new Map<string, number>();
    const seenFileDomains = new Map<string, number>();

    const results: ParsedCompanyRow[] = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 1;

      // Header matching flexibility
      const getVal = (candidates: string[]): string => {
        for (const c of candidates) {
          for (const key of Object.keys(row)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanCandidate = c.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanKey === cleanCandidate || cleanKey.includes(cleanCandidate)) {
              const val = row[key];
              if (val !== undefined && val !== null) return String(val).trim();
            }
          }
        }
        return '';
      };

      const name = getVal(['company_name', 'company', 'organization', 'name', 'firm', 'account']);
      const industry = getVal(['industry', 'sector', 'domain', 'vertical', 'business']);
      const website = getVal(['website', 'url', 'web', 'domain', 'site']);
      const linkedin_url = getVal(['linkedin_url', 'linkedin', 'company_linkedin', 'li']);
      const employee_count = getVal(['employee_count', 'headcount', 'size', 'employees', 'strength', 'staff']);
      const location = getVal(['location', 'city', 'headquarters', 'hq', 'state', 'country']);
      const notes = getVal(['notes', 'description', 'remarks', 'about', 'comment']);
      const source = getVal(['source']) || sourceTag;

      const validationErrors: string[] = [];
      let status: 'valid' | 'duplicate' | 'error' = 'valid';
      let duplicateReason: string | undefined = undefined;
      let existingMatchedName: string | undefined = undefined;

      // ---------------------------------------------------------
      // 1. FIELD LEVEL VALIDATION
      // ---------------------------------------------------------
      if (!name || name.trim().length === 0) {
        validationErrors.push('Company name is required');
        status = 'error';
      } else if (name.trim().length < 2) {
        validationErrors.push('Company name must be at least 2 characters');
        status = 'error';
      } else if (/^(n\/a|na|none|unknown|test|untitled|demo|sample|company)$/i.test(name.trim())) {
        validationErrors.push(`Invalid placeholder company name ("${name}")`);
        status = 'error';
      }

      if (website) {
        // Website syntax check
        if (website.includes(' ') || !website.includes('.')) {
          validationErrors.push('Invalid website domain format (must contain "." and no spaces)');
          status = 'error';
        } else if (website.length < 4) {
          validationErrors.push('Website URL is too short');
          status = 'error';
        }
      }

      if (linkedin_url) {
        // LinkedIn format check
        const cleanLi = linkedin_url.toLowerCase();
        if (!cleanLi.includes('linkedin.com/')) {
          validationErrors.push('LinkedIn URL must contain "linkedin.com/"');
          status = 'error';
        }
      }

      if (employee_count) {
        // Check for negative numbers or unreasonable values
        if (employee_count.startsWith('-')) {
          validationErrors.push('Employee count cannot be negative');
          status = 'error';
        }
      }

      // ---------------------------------------------------------
      // 2. DUPLICATE DETECTION (Only if no fatal field validation errors)
      // ---------------------------------------------------------
      if (status !== 'error' && name) {
        const lowerName = name.trim().toLowerCase();
        const normName = normalizeCompanyName(name);
        const domain = website ? extractRootDomain(website) : '';

        // A. Database Duplication Checks
        if (existingNameMap.has(lowerName)) {
          status = 'duplicate';
          existingMatchedName = existingNameMap.get(lowerName);
          duplicateReason = `Exact name match with existing record: "${existingMatchedName}"`;
        } else if (normName && existingNormNameMap.has(normName)) {
          status = 'duplicate';
          existingMatchedName = existingNormNameMap.get(normName);
          duplicateReason = `Normalized name match with existing record: "${existingMatchedName}"`;
        } else if (domain && domain.includes('.') && existingDomainMap.has(domain)) {
          status = 'duplicate';
          existingMatchedName = existingDomainMap.get(domain);
          duplicateReason = `Identical website domain (${domain}) registered under "${existingMatchedName}"`;
        }

        // B. Intra-File Duplication Checks (Within this upload batch)
        if (status !== 'duplicate') {
          if (seenFileNames.has(lowerName)) {
            const firstRow = seenFileNames.get(lowerName)!;
            status = 'duplicate';
            duplicateReason = `Intra-file duplicate: matches Row #${firstRow} in this upload`;
          } else if (normName && seenFileNormNames.has(normName)) {
            const firstRow = seenFileNormNames.get(normName)!;
            status = 'duplicate';
            duplicateReason = `Intra-file duplicate: similar to Row #${firstRow} in this upload`;
          } else if (domain && domain.includes('.') && seenFileDomains.has(domain)) {
            const firstRow = seenFileDomains.get(domain)!;
            status = 'duplicate';
            duplicateReason = `Intra-file duplicate: shares website domain (${domain}) with Row #${firstRow}`;
          }
        }

        // Register in seen map for subsequent rows
        if (!seenFileNames.has(lowerName)) seenFileNames.set(lowerName, rowNum);
        if (normName && !seenFileNormNames.has(normName)) seenFileNormNames.set(normName, rowNum);
        if (domain && domain.includes('.') && !seenFileDomains.has(domain)) seenFileDomains.set(domain, rowNum);
      }

      // Auto-select valid rows for import
      const isSelected = status === 'valid';

      results.push({
        rowNumber: rowNum,
        name: name || '',
        industry,
        website,
        linkedin_url,
        employee_count,
        location,
        notes: notes || (currentFileName ? `Imported from ${currentFileName}` : 'Bulk upload'),
        source,
        status,
        validationErrors,
        duplicateReason,
        existingMatchedName,
        selected: isSelected,
        rawRecord: row,
      });
    });

    return results;
  };

  // Parse Excel or CSV File with Server-Side Validation
  const handleFileProcess = async (file: File) => {
    setIsParsing(true);
    setParsingProgressMsg('Running server-side validation against required fields & company database...');
    setSelectedFile(file);

    try {
      // 1. Primary: Server-Side Validation via /api/v1/total-companies/validate
      const serverResult = await api.validateTotalCompanyRows({
        file,
        entered_by_name: enteredByName,
        source_tag: sourceTag,
        filename: file.name,
      });

      if (serverResult && serverResult.rows && serverResult.rows.length > 0) {
        setParsedRows(serverResult.rows);
        setValidationEngine(serverResult.source === 'server_validation_engine' ? 'server' : 'client');
        setServerFeedbackSummary(
          serverResult.validation_summary?.message ||
            `Server validated ${serverResult.total_rows} rows: ${serverResult.valid_count} valid, ${serverResult.duplicate_count} duplicates, ${serverResult.error_count} errors.`
        );
        setActiveTab('review');
        setIsParsing(false);
        setParsingProgressMsg('');
        return;
      }
    } catch (err: any) {
      console.warn('[BulkCompanyImporter] Server validation network error, falling back to local client parsing:', err);
    }

    // 2. Fallback: Parse file locally and run client validation engine
    try {
      setParsingProgressMsg('Processing file in local fallback mode...');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        alert('The uploaded file is empty or does not have recognizable tabular data.');
        setIsParsing(false);
        setParsingProgressMsg('');
        return;
      }

      const validated = validateAndDeduplicateRows(rawJson, file.name);
      setParsedRows(validated);
      setValidationEngine('client');
      setServerFeedbackSummary(`Validated ${validated.length} rows (client fallback)`);
      setActiveTab('review');
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert(`Failed to parse file: ${err.message || 'Unknown format error'}`);
    } finally {
      setIsParsing(false);
      setParsingProgressMsg('');
    }
  };

  // Parse Pasted Text (CSV/TSV) with Server-Side Validation
  const handlePasteProcess = async () => {
    if (!pastedText.trim()) {
      alert('Please paste some CSV or Excel tabular data first.');
      return;
    }

    setIsParsing(true);
    setParsingProgressMsg('Validating tabular text against server required fields...');

    try {
      const serverResult = await api.validateTotalCompanyRows({
        csv_text: pastedText,
        entered_by_name: enteredByName,
        source_tag: sourceTag,
        filename: 'Pasted Tabular Data',
      });

      if (serverResult && serverResult.rows && serverResult.rows.length > 0) {
        setParsedRows(serverResult.rows);
        setValidationEngine(serverResult.source === 'server_validation_engine' ? 'server' : 'client');
        setServerFeedbackSummary(
          serverResult.validation_summary?.message ||
            `Server validated ${serverResult.total_rows} rows: ${serverResult.valid_count} valid, ${serverResult.duplicate_count} duplicates, ${serverResult.error_count} errors.`
        );
        setActiveTab('review');
        setIsParsing(false);
        setParsingProgressMsg('');
        return;
      }
    } catch (err) {
      console.warn('Server validation fallback for paste:', err);
    }

    try {
      const workbook = XLSX.read(pastedText, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        alert('Could not parse valid tabular rows from the pasted text.');
        setIsParsing(false);
        setParsingProgressMsg('');
        return;
      }

      const validated = validateAndDeduplicateRows(rawJson, 'Pasted Data');
      setParsedRows(validated);
      setValidationEngine('client');
      setActiveTab('review');
    } catch (err: any) {
      console.error('Text parsing error:', err);
      alert(`Failed to parse text: ${err.message}`);
    } finally {
      setIsParsing(false);
      setParsingProgressMsg('');
    }
  };

  // Load sample demo data with Server-Side Validation
  const handleLoadDemoData = async () => {
    setIsParsing(true);
    setParsingProgressMsg('Submitting demo dataset to server-side validation engine...');

    const demoData = [
      {
        'Company Name': 'HCL Technologies Limited',
        Industry: 'IT Services & Consulting',
        Website: 'https://www.hcltech.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/hcltech',
        'Employee Count': '10,000+ employees',
        Location: 'Noida / Hyderabad, India',
        Notes: 'Global technology company enterprise',
      },
      {
        'Company Name': 'Infosys Limited',
        Industry: 'Information Technology',
        Website: 'https://www.infosys.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/infosys',
        'Employee Count': '10,000+ employees',
        Location: 'Bengaluru, India',
        Notes: 'Flagged as duplicate because Infosys exists in company database',
      },
      {
        'Company Name': 'Razorpay Software',
        Industry: 'FinTech / Payments',
        Website: 'https://razorpay.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/razorpay',
        'Employee Count': '1,000-5,000 employees',
        Location: 'Bengaluru, India',
        Notes: 'Leading payment gateway provider',
      },
      {
        'Company Name': 'Swiggy Bundl Technologies',
        Industry: 'FoodTech & Quick Commerce',
        Website: 'https://www.swiggy.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/swiggy-in',
        'Employee Count': '5,000-10,000 employees',
        Location: 'Bengaluru, India',
        Notes: 'On-demand delivery platform',
      },
      {
        'Company Name': '', // Intentionally invalid to test required field validation
        Industry: 'Venture Capital',
        Website: 'invalid-url-no-dot',
        'LinkedIn URL': 'https://facebook.com/notlinkedin',
        'Employee Count': '-50',
        Location: 'Mumbai',
        Notes: 'Testing required field failure & logging to total_company_list',
      },
      {
        'Company Name': 'HCL Technologies Limited', // Intentionally intra-file duplicate
        Industry: 'IT',
        Website: 'hcltech.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/hcltech',
        'Employee Count': '50000',
        Location: 'Noida',
        Notes: 'Testing intra-batch duplicate detection',
      },
    ];

    try {
      const serverResult = await api.validateTotalCompanyRows({
        rows: demoData,
        entered_by_name: enteredByName,
        source_tag: sourceTag,
        filename: 'Sample Demo Dataset',
      });

      if (serverResult && serverResult.rows && serverResult.rows.length > 0) {
        setParsedRows(serverResult.rows);
        setValidationEngine(serverResult.source === 'server_validation_engine' ? 'server' : 'client');
        setServerFeedbackSummary(
          serverResult.validation_summary?.message ||
            `Server validated ${serverResult.total_rows} rows: ${serverResult.valid_count} valid, ${serverResult.duplicate_count} duplicates, ${serverResult.error_count} errors.`
        );
        setActiveTab('review');
        setIsParsing(false);
        setParsingProgressMsg('');
        return;
      }
    } catch (_) {}

    const validated = validateAndDeduplicateRows(demoData, 'Demo Dataset');
    setParsedRows(validated);
    setValidationEngine('client');
    setActiveTab('review');
    setIsParsing(false);
    setParsingProgressMsg('');
  };

  // Download Sample Template CSV / Excel
  const handleDownloadTemplate = (format: 'csv' | 'xlsx') => {
    const templateData = [
      {
        'Company Name': 'Tata Consultancy Services',
        Industry: 'Information Technology',
        Website: 'https://www.tcs.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/tata-consultancy-services',
        'Employee Count': '100,000+ employees',
        Location: 'Mumbai, India',
        Notes: 'Enterprise IT solutions and global consulting',
        'Entered By': currentUser?.name || 'Aravind Reddy',
      },
      {
        'Company Name': 'PhonePe Private Limited',
        Industry: 'FinTech & Payments',
        Website: 'https://www.phonepe.com',
        'LinkedIn URL': 'https://www.linkedin.com/company/phonepe-internet',
        'Employee Count': '1,000-5,000 employees',
        Location: 'Bengaluru, Karnataka',
        Notes: 'Digital payments and financial services',
        'Entered By': currentUser?.name || 'Aravind Reddy',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Company_Import_Template');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Placemein_Company_Import_Template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, 'Placemein_Company_Import_Template.xlsx');
    }
  };

  // Download Error Report CSV from Current Review or Historical DB
  const handleDownloadErrorReport = (rowsToExport?: ParsedCompanyRow[]) => {
    const targetRows = rowsToExport || parsedRows.filter((r) => r.status === 'error' || r.status === 'duplicate');

    if (targetRows.length === 0) {
      alert('No error or duplicate records to export.');
      return;
    }

    const reportData = targetRows.map((r) => ({
      'Row Number': r.rowNumber,
      'Company Name': r.name || '(Empty / Missing)',
      Status: r.status.toUpperCase(),
      'Error Summary': r.validationErrors.join('; ') || r.duplicateReason || 'N/A',
      Industry: r.industry || '',
      Website: r.website || '',
      'LinkedIn URL': r.linkedin_url || '',
      'Employee Count': r.employee_count || '',
      Location: r.location || '',
      'Duplicate Reason': r.duplicateReason || 'N/A',
      'Timestamp Logged': new Date().toISOString(),
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Placemein_Company_Import_Error_Report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Historical DB Error Logs
  const handleDownloadHistoricalLogs = () => {
    if (dbLogs.length === 0) {
      alert('No database logs available to export.');
      return;
    }

    const exportRows = dbLogs.map((item) => ({
      'Log ID': item.id,
      'Company Name': item.name,
      Status: item.import_status.toUpperCase(),
      'Error Log': item.error_log || '',
      'Validation Errors': item.validation_errors?.join('; ') || '',
      'Batch ID': item.batch_id || '',
      'Row Number': item.row_number || '',
      'Imported By': item.imported_by || '',
      Website: item.website || '',
      Industry: item.industry || '',
      'Created At': item.created_at,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `total_company_list_audit_logs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save Inline Edit for a Row
  const handleSaveInlineEdit = (rowIndex: number) => {
    const updated = [...parsedRows];
    const target = updated[rowIndex];

    const newName = (editFormData.name !== undefined ? editFormData.name : target.name).trim();
    const newIndustry = (editFormData.industry !== undefined ? editFormData.industry : target.industry).trim();
    const newWebsite = (editFormData.website !== undefined ? editFormData.website : target.website).trim();
    const newLinkedIn = (editFormData.linkedin_url !== undefined ? editFormData.linkedin_url : target.linkedin_url).trim();
    const newHeadcount = (editFormData.employee_count !== undefined ? editFormData.employee_count : target.employee_count).trim();
    const newLocation = (editFormData.location !== undefined ? editFormData.location : target.location).trim();

    // Re-validate this single row
    const validationErrors: string[] = [];
    let status: 'valid' | 'duplicate' | 'error' = 'valid';

    if (!newName || newName.length < 2) {
      validationErrors.push('Company name is required (min 2 chars)');
      status = 'error';
    }

    if (newWebsite && (newWebsite.includes(' ') || !newWebsite.includes('.'))) {
      validationErrors.push('Invalid website format');
      status = 'error';
    }

    if (newLinkedIn && !newLinkedIn.toLowerCase().includes('linkedin.com/')) {
      validationErrors.push('LinkedIn URL must contain "linkedin.com/"');
      status = 'error';
    }

    // Check duplicate
    if (status !== 'error') {
      const existing = clientFallbackStore.getCompanies();
      const match = existing.find((c) => c.name.toLowerCase() === newName.toLowerCase());
      if (match) {
        status = 'duplicate';
        target.duplicateReason = `Matches existing company "${match.name}"`;
      } else {
        target.duplicateReason = undefined;
      }
    }

    updated[rowIndex] = {
      ...target,
      name: newName,
      industry: newIndustry,
      website: newWebsite,
      linkedin_url: newLinkedIn,
      employee_count: newHeadcount,
      location: newLocation,
      status,
      validationErrors,
      selected: status === 'valid',
      isEdited: true,
    };

    setParsedRows(updated);
    setEditingRowIndex(null);
    setEditFormData({});
  };

  // Bulk Selection Actions
  const handleSelectAll = (select: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: select })));
  };

  const handleSelectValidOnly = () => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: r.status === 'valid' })));
  };

  const handleDeselectDuplicates = () => {
    setParsedRows((prev) => prev.map((r) => (r.status === 'duplicate' ? { ...r, selected: false } : r)));
  };

  // --------------------------------------------------------------------------
  // EXECUTE IMPORT & ERROR LOGGING TO total_company_list SUPABASE TABLE
  // --------------------------------------------------------------------------
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setImportProgress(10);

    const batchId = `BATCH_${Date.now()}`;
    const selectedRows = parsedRows.filter((r) => r.selected);
    const unselectedOrErrorRows = parsedRows.filter((r) => !r.selected);

    // Prepare complete audit log records for Supabase table `total_company_list`
    // We log ALL rows: successfully imported rows, duplicates skipped, and validation error rows!
    const totalCompanyListPayload: Array<{
      name: string;
      industry?: string;
      website?: string;
      linkedin_url?: string;
      employee_count?: string;
      location?: string;
      source: string;
      notes?: string;
      import_status: TotalCompanyImportStatus;
      error_log?: string;
      validation_errors?: string[];
      raw_row_data?: Record<string, any>;
      batch_id: string;
      row_number: number;
      imported_by: string;
    }> = [];

    // 1. Process selected rows (imported)
    selectedRows.forEach((r) => {
      let finalStatus: TotalCompanyImportStatus = 'imported';
      let errorLog: string | undefined = undefined;

      if (r.status === 'duplicate' && duplicatePolicy === 'allow_update') {
        finalStatus = 'imported';
        errorLog = `Imported with duplicate policy override: "${r.duplicateReason}"`;
      } else if (r.status === 'error') {
        finalStatus = 'error';
        errorLog = `[Row ${r.rowNumber}] Validation failed: ${r.validationErrors.join('; ')}`;
      }

      totalCompanyListPayload.push({
        name: r.name,
        industry: r.industry || undefined,
        website: r.website || undefined,
        linkedin_url: r.linkedin_url || undefined,
        employee_count: r.employee_count || undefined,
        location: r.location || undefined,
        source: sourceTag,
        notes: r.notes ? `${r.notes} | Batch: ${batchId}` : `Imported via BulkCompanyImporter | Batch: ${batchId}`,
        import_status: finalStatus,
        error_log: errorLog,
        validation_errors: r.validationErrors.length > 0 ? r.validationErrors : undefined,
        raw_row_data: r.rawRecord,
        batch_id: batchId,
        row_number: r.rowNumber,
        imported_by: enteredByName,
      });
    });

    setImportProgress(40);

    // 2. Process unselected / skipped duplicate / validation error rows
    unselectedOrErrorRows.forEach((r) => {
      const isDuplicate = r.status === 'duplicate';
      const isError = r.status === 'error';

      const import_status: TotalCompanyImportStatus = isDuplicate
        ? 'duplicate_skipped'
        : isError
        ? 'error'
        : 'duplicate_skipped';

      const error_log = isDuplicate
        ? `[Row ${r.rowNumber}] Duplicate detected & skipped: ${r.duplicateReason || 'Matches existing company'}`
        : isError
        ? `[Row ${r.rowNumber}] Validation error: ${r.validationErrors.join('; ')}`
        : `[Row ${r.rowNumber}] Excluded by user selection`;

      totalCompanyListPayload.push({
        name: r.name || `(Invalid Row #${r.rowNumber})`,
        industry: r.industry || undefined,
        website: r.website || undefined,
        linkedin_url: r.linkedin_url || undefined,
        employee_count: r.employee_count || undefined,
        location: r.location || undefined,
        source: sourceTag,
        notes: `Skipped/Failed during batch import: ${r.notes || ''}`,
        import_status,
        error_log,
        validation_errors: r.validationErrors.length > 0 ? r.validationErrors : isDuplicate ? ['Duplicate company'] : undefined,
        raw_row_data: r.rawRecord,
        batch_id: batchId,
        row_number: r.rowNumber,
        imported_by: enteredByName,
      });
    });

    setImportProgress(70);

    try {
      // Commit batch to server and total_company_list table with row-by-row feedback logs
      const result = await api.commitTotalCompanyBatch({
        batch_id: batchId,
        records: totalCompanyListPayload,
        duplicate_policy: duplicatePolicy,
      });

      setImportProgress(100);

      const importedCount = result.imported_count || totalCompanyListPayload.filter((r) => r.import_status === 'imported').length;
      const duplicateCount = result.duplicate_skipped_count || totalCompanyListPayload.filter((r) => r.import_status === 'duplicate_skipped').length;
      const errorCount = result.error_logged_count || totalCompanyListPayload.filter((r) => r.import_status === 'error' || r.import_status === 'invalid').length;

      if (result.commit_logs && result.commit_logs.length > 0) {
        setCommitLogs(result.commit_logs);
      }

      setLastBatchSummary({
        batchId,
        totalRows: totalCompanyListPayload.length,
        imported: importedCount,
        duplicates: duplicateCount,
        errors: errorCount,
        filename: selectedFile?.name || 'Manual Upload',
      });

      // Notify parent callback
      if (onImportComplete) {
        onImportComplete({
          importedCount,
          duplicateCount,
          errorCount,
          batchId,
        });
      }

      // Automatically refresh logs
      loadDatabaseLogs();
    } catch (err: any) {
      console.error('Import batch failure:', err);
      alert(`Import error: ${err.message || 'Failed to persist records to Supabase'}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Filtered rows for the review table
  const filteredReviewRows = useMemo(() => {
    return parsedRows.filter((row) => {
      // Status filter
      if (statusFilter === 'valid' && row.status !== 'valid') return false;
      if (statusFilter === 'duplicate' && row.status !== 'duplicate') return false;
      if (statusFilter === 'error' && row.status !== 'error') return false;
      if (statusFilter === 'selected' && !row.selected) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.name.toLowerCase().includes(q);
        const matchIndustry = row.industry?.toLowerCase().includes(q);
        const matchDomain = row.website?.toLowerCase().includes(q);
        const matchLoc = row.location?.toLowerCase().includes(q);
        const matchError = row.validationErrors.some((e) => e.toLowerCase().includes(q));
        const matchDup = row.duplicateReason?.toLowerCase().includes(q);
        return matchName || matchIndustry || matchDomain || matchLoc || matchError || matchDup;
      }

      return true;
    });
  }, [parsedRows, statusFilter, searchQuery]);

  // Filtered historical logs from Supabase
  const filteredDbLogs = useMemo(() => {
    return dbLogs.filter((log) => {
      if (logsFilterStatus !== 'all' && log.import_status !== logsFilterStatus) return false;
      if (logsSearch.trim()) {
        const q = logsSearch.toLowerCase();
        const matchName = log.name?.toLowerCase().includes(q);
        const matchError = log.error_log?.toLowerCase().includes(q);
        const matchBatch = log.batch_id?.toLowerCase().includes(q);
        const matchWeb = log.website?.toLowerCase().includes(q);
        return matchName || matchError || matchBatch || matchWeb;
      }
      return true;
    });
  }, [dbLogs, logsFilterStatus, logsSearch]);

  // Counters
  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;
  const selectedCount = parsedRows.filter((r) => r.selected).length;

  if (!isOpen && !isEmbedded) return null;

  return (
    <div
      className={
        isEmbedded
          ? 'w-full space-y-6'
          : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200'
      }
    >
      <div
        className={
          isEmbedded
            ? 'w-full rounded-3xl bg-gray-950 border border-amber-800/40 shadow-2xl p-5 sm:p-7 space-y-6'
            : 'w-full max-w-6xl max-h-[92vh] flex flex-col rounded-3xl bg-gray-950 border border-amber-700/60 shadow-2xl overflow-hidden'
        }
      >
        {/* HEADER BAR */}
        <div className="p-5 sm:p-6 border-b border-amber-800/40 bg-gradient-to-r from-amber-950/80 via-gray-950 to-amber-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Building2 className="h-5 w-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Bulk Company Importer</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Admin Panel
                </span>
              </h2>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Database className="h-3 w-3" />
                <span>Table: total_company_list</span>
              </div>
            </div>
            <p className="text-xs text-amber-200/70 max-w-3xl">
              Mass-import enterprise organizations from CSV/Excel with row-by-row field validation, duplicate detection
              against master directories, and automated audit error logging into Supabase.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'sql'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-amber-950/50 text-amber-300 hover:bg-amber-900/50 border border-amber-800/40'
              }`}
              title="View Supabase SQL Table Schema"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>SQL Schema</span>
            </button>

            {!isEmbedded && onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-amber-800/30 bg-amber-950/20 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 font-bold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
              activeTab === 'upload'
                ? 'border-amber-400 text-amber-300 bg-amber-950/60'
                : 'border-transparent text-amber-200/60 hover:text-amber-200'
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            <span>1. Upload & Options</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2.5 font-bold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
              activeTab === 'review'
                ? 'border-amber-400 text-amber-300 bg-amber-950/60'
                : 'border-transparent text-amber-200/60 hover:text-amber-200'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>2. Validation Review ({parsedRows.length})</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {errorCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 font-bold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap border-b-2 ${
              activeTab === 'logs'
                ? 'border-amber-400 text-amber-300 bg-amber-950/60'
                : 'border-transparent text-amber-200/60 hover:text-amber-200'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>3. Database & Error Logs ({dbLogs.length})</span>
          </button>
        </div>

        {/* BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: UPLOAD & CONFIGURATION */}
          {/* ========================================================================= */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Batch Settings Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs">
                <div>
                  <label className="block text-amber-200 font-semibold mb-1">Uploaded By (Admin / SPOC)</label>
                  <input
                    type="text"
                    value={enteredByName}
                    onChange={(e) => setEnteredByName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-amber-700/50 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    placeholder="e.g. Aravind Reddy"
                  />
                </div>

                <div>
                  <label className="block text-amber-200 font-semibold mb-1">Duplicate Policy</label>
                  <select
                    value={duplicatePolicy}
                    onChange={(e) => setDuplicatePolicy(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-950 border border-amber-700/50 rounded-xl text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="skip">Skip duplicates (Log to error report & table)</option>
                    <option value="allow_update">Allow updates (Merge into existing record)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-amber-200 font-semibold mb-1">Source Identifier</label>
                  <input
                    type="text"
                    value={sourceTag}
                    onChange={(e) => setSourceTag(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-amber-700/50 rounded-xl text-white focus:outline-none focus:border-amber-500"
                    placeholder="admin_bulk_importer"
                  />
                </div>
              </div>

              {/* Server Validation Progress Banner */}
              {isParsing && (
                <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-600/60 flex items-center gap-3.5 text-xs animate-pulse">
                  <RefreshCw className="h-5 w-5 text-amber-400 animate-spin shrink-0" />
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-2">
                      <span>Server Validation Active</span>
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-amber-500/20 text-amber-300">
                        POST /api/v1/total-companies/validate
                      </span>
                    </div>
                    <p className="text-amber-200/80 mt-0.5">
                      {parsingProgressMsg || 'Checking required fields and querying company database for duplicates...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Mode Switcher */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUploadMode('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    uploadMode === 'file'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
                      : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 border border-amber-800/40'
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload CSV / Excel File</span>
                </button>
                <button
                  onClick={() => setUploadMode('paste')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    uploadMode === 'paste'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
                      : 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 border border-amber-800/40'
                  }`}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  <span>Paste Tabular Data</span>
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleLoadDemoData}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Load sample dataset with valid, duplicate, and invalid test rows"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Load Demo Sample (Test Rows)</span>
                  </button>
                </div>
              </div>

              {/* FILE UPLOAD DROPZONE */}
              {uploadMode === 'file' && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileProcess(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-10 rounded-3xl border-2 border-dashed transition flex flex-col items-center justify-center gap-4 text-center cursor-pointer ${
                    isDragOver
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-amber-800/60 bg-amber-950/20 hover:border-amber-600 hover:bg-amber-950/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileProcess(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <FileSpreadsheet className="h-10 w-10 animate-bounce" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      Drag & Drop your Company CSV or Excel file here
                    </p>
                    <p className="text-xs text-amber-200/60">
                      Supports <span className="text-amber-300 font-mono">.csv</span>,{' '}
                      <span className="text-amber-300 font-mono">.xlsx</span>, and{' '}
                      <span className="text-amber-300 font-mono">.xls</span> files
                    </p>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg transition">
                      Browse File
                    </span>
                  </div>
                </div>
              )}

              {/* PASTE TABULAR DATA */}
              {uploadMode === 'paste' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200/80 flex items-center gap-2">
                    <Info className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      Copy cells directly from Google Sheets or Excel and paste below. The first row should contain header labels.
                    </span>
                  </div>

                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Company Name&#9;Industry&#9;Website&#9;LinkedIn URL&#9;Headcount&#9;Location&#10;Google LLC&#9;Technology&#9;https://google.com&#9;https://linkedin.com/company/google&#9;10000+&#9;Mountain View"
                    className="w-full p-4 rounded-2xl bg-gray-950 border border-amber-700/50 text-white font-mono text-xs focus:outline-none focus:border-amber-500 leading-relaxed"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handlePasteProcess}
                      disabled={isParsing || !pastedText.trim()}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>Parse & Validate Pasted Rows</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sample Templates Download Box */}
              <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-amber-400" />
                    <span>Download Pre-Formatted Starter Templates</span>
                  </div>
                  <p className="text-[11px] text-amber-200/60">
                    Includes required and optional columns (<span className="text-amber-300">Company Name</span>,{' '}
                    <span className="text-amber-300">Industry</span>, <span className="text-amber-300">Website</span>,{' '}
                    <span className="text-amber-300">LinkedIn URL</span>, <span className="text-amber-300">Employee Count</span>,{' '}
                    <span className="text-amber-300">Location</span>, <span className="text-amber-300">Notes</span>).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownloadTemplate('csv')}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-amber-300 border border-amber-700/50 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-amber-300 border border-amber-700/50 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Excel (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: ROW-BY-ROW VALIDATION & REVIEW */}
          {/* ========================================================================= */}
          {activeTab === 'review' && (
            <div className="space-y-5">
              {/* Server-Side Validation Engine Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-gray-950 to-amber-950/50 border border-emerald-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">Server-Side Validation Engine</span>
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        {validationEngine === 'server' ? 'Server Connected (Express MVC + DB)' : 'Client Fallback Mode'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        Target: total_company_list
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300/80 mt-1">
                      {serverFeedbackSummary ||
                        'Verified required fields (non-empty company name, syntax format) and detected duplicates against the company database.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-amber-300 border border-amber-800/40 text-xs font-semibold transition"
                  >
                    Upload New File
                  </button>
                </div>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/40">
                  <div className="text-[10px] text-amber-300/70 font-semibold uppercase">Total Rows</div>
                  <div className="text-xl font-bold text-white mt-1">{parsedRows.length}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/40">
                  <div className="text-[10px] text-emerald-300/70 font-semibold uppercase flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>Valid & Ready</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{validCount}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-600/40">
                  <div className="text-[10px] text-amber-300/70 font-semibold uppercase flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span>Duplicates</span>
                  </div>
                  <div className="text-xl font-bold text-amber-400 mt-1">{duplicateCount}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/40">
                  <div className="text-[10px] text-rose-300/70 font-semibold uppercase flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-rose-400" />
                    <span>Validation Errors</span>
                  </div>
                  <div className="text-xl font-bold text-rose-400 mt-1">{errorCount}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/40">
                  <div className="text-[10px] text-cyan-300/70 font-semibold uppercase flex items-center gap-1">
                    <CheckSquare className="h-3 w-3 text-cyan-400" />
                    <span>Selected to Import</span>
                  </div>
                  <div className="text-xl font-bold text-cyan-400 mt-1">{selectedCount}</div>
                </div>
              </div>

              {/* Filters & Actions Bar */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
                {/* Search & Status Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-amber-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search row details, company, errors..."
                      className="w-56 bg-gray-950 border border-amber-700/50 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-amber-400/40 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-amber-800/50">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        statusFilter === 'all' ? 'bg-amber-600 text-white' : 'text-amber-300/70 hover:text-white'
                      }`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('valid')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        statusFilter === 'valid' ? 'bg-emerald-600 text-white' : 'text-emerald-400/70 hover:text-white'
                      }`}
                    >
                      Valid ({validCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('duplicate')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        statusFilter === 'duplicate' ? 'bg-amber-600 text-white' : 'text-amber-400/70 hover:text-white'
                      }`}
                    >
                      Duplicates ({duplicateCount})
                    </button>
                    <button
                      onClick={() => setStatusFilter('error')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                        statusFilter === 'error' ? 'bg-rose-600 text-white' : 'text-rose-400/70 hover:text-white'
                      }`}
                    >
                      Errors ({errorCount})
                    </button>
                  </div>
                </div>

                {/* Quick Selection Shortcuts */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleSelectValidOnly}
                    className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-emerald-400 border border-emerald-800/50 rounded-xl font-semibold transition"
                  >
                    Select Valid Only
                  </button>
                  <button
                    onClick={handleDeselectDuplicates}
                    className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-amber-300 border border-amber-800/50 rounded-xl font-semibold transition"
                  >
                    Deselect Duplicates
                  </button>
                  {(errorCount > 0 || duplicateCount > 0) && (
                    <button
                      onClick={() => handleDownloadErrorReport()}
                      className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 rounded-xl font-semibold transition flex items-center gap-1.5"
                      title="Download CSV report of validation errors and duplicates"
                    >
                      <Download className="h-3 w-3" />
                      <span>Export Error CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ROW TABLE */}
              <div className="border border-amber-800/40 rounded-2xl overflow-hidden bg-gray-950/70 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs text-amber-100">
                  <thead className="bg-amber-900/40 text-amber-300 font-semibold border-b border-amber-800/60 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === parsedRows.length && parsedRows.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-amber-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-12 text-center">Row</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Industry</th>
                      <th className="py-2.5 px-3">Website</th>
                      <th className="py-2.5 px-3">LinkedIn URL</th>
                      <th className="py-2.5 px-3">Headcount</th>
                      <th className="py-2.5 px-3">Validation & Duplicate Diagnostics</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-800/30">
                    {filteredReviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-amber-300/60">
                          No company rows match current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredReviewRows.map((row, idx) => {
                        const originalIndex = parsedRows.findIndex((r) => r.rowNumber === row.rowNumber);
                        const isEditing = editingRowIndex === originalIndex;

                        return (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-amber-900/20 transition ${
                              row.status === 'error'
                                ? 'bg-rose-950/20'
                                : row.status === 'duplicate'
                                ? 'bg-amber-950/20'
                                : ''
                            } ${!row.selected ? 'opacity-60' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(e) => {
                                  const updated = [...parsedRows];
                                  updated[originalIndex].selected = e.target.checked;
                                  setParsedRows(updated);
                                }}
                                className="rounded border-amber-600 text-amber-500 focus:ring-amber-500 cursor-pointer"
                              />
                            </td>

                            {/* Row Number */}
                            <td className="py-2.5 px-3 text-center font-mono text-[11px] text-amber-400/60">
                              #{row.rowNumber}
                            </td>

                            {/* Status Badge */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {row.status === 'valid' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                  <span>Valid</span>
                                </span>
                              )}
                              {row.status === 'duplicate' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                                  <span>Duplicate</span>
                                </span>
                              )}
                              {row.status === 'error' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  <AlertCircle className="h-3 w-3 text-rose-400" />
                                  <span>Error</span>
                                </span>
                              )}
                            </td>

                            {/* Company Name */}
                            <td className="py-2.5 px-3 font-bold text-white">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData.name !== undefined ? editFormData.name : row.name}
                                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                  className="w-36 bg-amber-950 border border-amber-600 rounded px-2 py-1 text-xs text-white"
                                />
                              ) : (
                                <div>
                                  <span>{row.name || '(Missing Name)'}</span>
                                  {row.isEdited && (
                                    <span className="ml-1 text-[9px] text-cyan-400 font-mono">[Edited]</span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Industry */}
                            <td className="py-2.5 px-3 text-amber-200/80">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData.industry !== undefined ? editFormData.industry : row.industry}
                                  onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                                  className="w-28 bg-amber-950 border border-amber-600 rounded px-2 py-1 text-xs text-white"
                                />
                              ) : (
                                row.industry || '—'
                              )}
                            </td>

                            {/* Website */}
                            <td className="py-2.5 px-3 text-amber-200/80">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData.website !== undefined ? editFormData.website : row.website}
                                  onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                                  className="w-32 bg-amber-950 border border-amber-600 rounded px-2 py-1 text-xs text-white font-mono"
                                />
                              ) : row.website ? (
                                <a
                                  href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-amber-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                                >
                                  <span>{extractRootDomain(row.website) || row.website}</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* LinkedIn URL */}
                            <td className="py-2.5 px-3 text-amber-200/80">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData.linkedin_url !== undefined ? editFormData.linkedin_url : row.linkedin_url}
                                  onChange={(e) => setEditFormData({ ...editFormData, linkedin_url: e.target.value })}
                                  className="w-32 bg-amber-950 border border-amber-600 rounded px-2 py-1 text-xs text-white font-mono"
                                />
                              ) : row.linkedin_url ? (
                                <span className="text-cyan-400 font-mono text-[11px]">
                                  {row.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/company\//, '').slice(0, 16)}...
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* Headcount */}
                            <td className="py-2.5 px-3 text-amber-300/80">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editFormData.employee_count !== undefined ? editFormData.employee_count : row.employee_count}
                                  onChange={(e) => setEditFormData({ ...editFormData, employee_count: e.target.value })}
                                  className="w-20 bg-amber-950 border border-amber-600 rounded px-2 py-1 text-xs text-white"
                                />
                              ) : (
                                row.employee_count || '—'
                              )}
                            </td>

                            {/* Validation & Duplicate Diagnostics */}
                            <td className="py-2.5 px-3 max-w-xs">
                              {row.status === 'valid' && (
                                <span className="text-[11px] text-emerald-400/80">
                                  All checks passed. Ready for master database insertion.
                                </span>
                              )}
                              {row.status === 'duplicate' && (
                                <div className="space-y-0.5">
                                  <div className="text-[11px] font-semibold text-amber-300">
                                    {row.duplicateReason}
                                  </div>
                                </div>
                              )}
                              {row.status === 'error' && (
                                <div className="space-y-0.5">
                                  {row.validationErrors.map((err, eIdx) => (
                                    <div key={eIdx} className="text-[11px] text-rose-300 flex items-center gap-1">
                                      <span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-2.5 px-3 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleSaveInlineEdit(originalIndex)}
                                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow"
                                    title="Save row changes"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingRowIndex(null);
                                      setEditFormData({});
                                    }}
                                    className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingRowIndex(originalIndex);
                                    setEditFormData({ ...row });
                                  }}
                                  className="p-1 hover:bg-amber-900/50 rounded text-amber-300 hover:text-white transition"
                                  title="Edit row inline to fix validation error"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* EXECUTE IMPORT BAR */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-gray-950 to-amber-950/80 border border-amber-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-amber-400" />
                    <span>Ready to Process Batch Import</span>
                  </div>
                  <p className="text-xs text-amber-200/70">
                    Will import <strong className="text-emerald-400">{selectedCount}</strong> company accounts and log
                    complete row audit records (including duplicates and errors) to Supabase table{' '}
                    <code className="text-amber-300 font-mono">total_company_list</code>.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-amber-300 rounded-xl text-xs font-semibold border border-amber-800/40"
                  >
                    Back to Upload
                  </button>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedCount === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-amber-900/50 transition flex items-center gap-2 cursor-pointer"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Logging & Importing ({importProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Import & Log to total_company_list</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Import Progress Bar */}
              {isImporting && (
                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-amber-800/40">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              )}

              {/* Success Notification & Summary */}
              {lastBatchSummary && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 text-xs space-y-3 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span>Batch {lastBatchSummary.batchId} Executed Successfully!</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {commitLogs.length > 0 && (
                        <button
                          onClick={() => setShowCommitLogsModal(true)}
                          className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Terminal className="h-3.5 w-3.5 text-amber-400" />
                          <span>Inspect Commit Logs ({commitLogs.length})</span>
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab('logs')}
                        className="px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800/60 text-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <span>View in Database Logs</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-gray-950 border border-emerald-800/30">
                      <div className="text-gray-400 text-[10px]">Total Processed</div>
                      <div className="font-bold text-white text-base">{lastBatchSummary.totalRows}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-950 border border-emerald-800/30">
                      <div className="text-emerald-400 text-[10px]">Active Companies Added</div>
                      <div className="font-bold text-emerald-400 text-base">{lastBatchSummary.imported}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-950 border border-emerald-800/30">
                      <div className="text-amber-400 text-[10px]">Duplicates Logged</div>
                      <div className="font-bold text-amber-400 text-base">{lastBatchSummary.duplicates}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-gray-950 border border-emerald-800/30">
                      <div className="text-rose-400 text-[10px]">Validation Errors Logged</div>
                      <div className="font-bold text-rose-400 text-base">{lastBatchSummary.errors}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: DATABASE AUDIT & ERROR LOGS (total_company_list) */}
          {/* ========================================================================= */}
          {activeTab === 'logs' && (
            <div className="space-y-5">
              {/* Header Info Banner */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Database className="h-4 w-4 text-amber-400" />
                    <span>Supabase table: total_company_list</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Audit Log
                    </span>
                  </div>
                  <p className="text-amber-200/70">
                    Contains master records of all imported companies along with skipped duplicates, raw row payloads,
                    and validation error logs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDatabaseLogs}
                    disabled={isLoadingLogs}
                    className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-amber-300 border border-amber-700/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleDownloadHistoricalLogs}
                    disabled={dbLogs.length === 0}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Audit CSV</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (confirm('Clear validation error and failed logs from total_company_list?')) {
                        await api.clearTotalCompanyErrorLogs();
                        loadDatabaseLogs();
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    title="Remove error logs while preserving successfully imported company records"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Purge Error Logs</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-amber-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={logsSearch}
                      onChange={(e) => setLogsSearch(e.target.value)}
                      placeholder="Search company, error reason, batch ID..."
                      className="w-64 bg-gray-950 border border-amber-700/50 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-amber-400/40 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-amber-200">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Status:</span>
                    <select
                      value={logsFilterStatus}
                      onChange={(e) => setLogsFilterStatus(e.target.value)}
                      className="bg-gray-950 border border-amber-700/50 text-white rounded-lg px-2.5 py-1 text-xs"
                    >
                      <option value="all">All Records ({dbLogs.length})</option>
                      <option value="imported">Imported ({dbLogs.filter((l) => l.import_status === 'imported').length})</option>
                      <option value="duplicate_skipped">Duplicates Skipped ({dbLogs.filter((l) => l.import_status === 'duplicate_skipped').length})</option>
                      <option value="error">Errors & Failed ({dbLogs.filter((l) => l.import_status === 'error' || l.import_status === 'invalid').length})</option>
                    </select>
                  </div>
                </div>

                <div className="text-amber-300/70 text-xs">
                  Showing {filteredDbLogs.length} record(s)
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-amber-800/40 rounded-2xl overflow-hidden bg-gray-950/70 max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs text-amber-100">
                  <thead className="bg-amber-900/40 text-amber-300 font-semibold border-b border-amber-800/60 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Import Status</th>
                      <th className="py-2.5 px-3">Error / Duplicate Reason Log</th>
                      <th className="py-2.5 px-3">Batch ID</th>
                      <th className="py-2.5 px-3">Imported By</th>
                      <th className="py-2.5 px-3">Logged Date</th>
                      <th className="py-2.5 px-3 text-right">Raw Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-800/30">
                    {filteredDbLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-amber-300/60">
                          {isLoadingLogs ? 'Loading total_company_list records...' : 'No audit records match the current filter.'}
                        </td>
                      </tr>
                    ) : (
                      filteredDbLogs.map((log) => (
                        <tr
                          key={log.id}
                          className={`hover:bg-amber-900/20 transition ${
                            log.import_status === 'error' || log.import_status === 'invalid'
                              ? 'bg-rose-950/20'
                              : log.import_status === 'duplicate_skipped'
                              ? 'bg-amber-950/20'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-white">
                            <div>{log.name || '(Missing Name)'}</div>
                            {log.website && (
                              <div className="text-[10px] text-amber-400/60 font-mono truncate max-w-[150px]">
                                {log.website}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {log.import_status === 'imported' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span>Imported</span>
                              </span>
                            )}
                            {log.import_status === 'duplicate_skipped' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <AlertTriangle className="h-3 w-3 text-amber-400" />
                                <span>Duplicate</span>
                              </span>
                            )}
                            {(log.import_status === 'error' || log.import_status === 'invalid') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                <AlertCircle className="h-3 w-3 text-rose-400" />
                                <span>Validation Error</span>
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 max-w-sm">
                            {log.error_log ? (
                              <p className="text-[11px] text-rose-300/90 leading-tight">{log.error_log}</p>
                            ) : (
                              <span className="text-[11px] text-emerald-400/70">Verified & successfully stored</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px] text-amber-300/80">
                            {log.batch_id || 'manual'}
                          </td>

                          <td className="py-2.5 px-3 text-amber-200/80">
                            {log.imported_by || 'Admin'}
                          </td>

                          <td className="py-2.5 px-3 text-amber-300/70 text-[11px]">
                            {formatIndianDate(log.created_at)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => setSelectedLogRow(log)}
                              className="px-2 py-1 bg-gray-900 hover:bg-gray-800 text-amber-300 rounded text-[11px] font-mono border border-amber-800/40"
                              title="Inspect raw row details and payload"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Log Detail Modal */}
              {selectedLogRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-3xl bg-gray-950 border border-amber-700/60 p-6 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-800/40 pb-3">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Database className="h-4 w-4 text-amber-400" />
                          <span>Audit Row Inspection: {selectedLogRow.name}</span>
                        </h3>
                        <div className="text-xs text-amber-400/60 font-mono">Record ID: {selectedLogRow.id}</div>
                      </div>
                      <button
                        onClick={() => setSelectedLogRow(null)}
                        className="p-1 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30">
                        <div className="text-amber-400/60 text-[10px] uppercase">Status</div>
                        <div className="font-bold text-white capitalize mt-0.5">{selectedLogRow.import_status}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30">
                        <div className="text-amber-400/60 text-[10px] uppercase">Batch ID</div>
                        <div className="font-mono text-white mt-0.5">{selectedLogRow.batch_id || 'manual'}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30">
                        <div className="text-amber-400/60 text-[10px] uppercase">Imported By</div>
                        <div className="text-white mt-0.5">{selectedLogRow.imported_by || 'Admin'}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/30">
                        <div className="text-amber-400/60 text-[10px] uppercase">Created At</div>
                        <div className="text-white mt-0.5">{selectedLogRow.created_at}</div>
                      </div>
                    </div>

                    {selectedLogRow.error_log && (
                      <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 space-y-1">
                        <div className="text-xs font-bold text-rose-300">Error / Duplicate Reason Logged:</div>
                        <p className="text-xs text-rose-200/90 font-mono leading-relaxed">{selectedLogRow.error_log}</p>
                      </div>
                    )}

                    {selectedLogRow.raw_row_data && (
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-amber-200">Original Row Data (CSV/Excel payload):</div>
                        <pre className="p-3 rounded-xl bg-gray-900 border border-amber-800/40 text-[11px] text-amber-100 font-mono max-h-40 overflow-y-auto">
                          {JSON.stringify(selectedLogRow.raw_row_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="flex justify-end pt-2 border-t border-amber-800/30">
                      <button
                        onClick={() => setSelectedLogRow(null)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: SUPABASE SQL TABLE SCHEMA HELPER */}
          {/* ========================================================================= */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-amber-400" />
                    <span>Supabase SQL DDL Script (total_company_list)</span>
                  </div>
                  <p className="text-amber-200/70">
                    If this table does not yet exist in your Supabase project, copy and run this script in your{' '}
                    <span className="text-amber-300 font-semibold">Supabase Dashboard &gt; SQL Editor</span>.
                  </p>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(TOTAL_COMPANY_LIST_SCHEMA_SQL);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow shrink-0"
                >
                  {copiedSql ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy SQL Script</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-2xl bg-gray-900 border border-amber-800/50 text-xs font-mono text-amber-200/90 overflow-x-auto leading-relaxed">
                  {TOTAL_COMPANY_LIST_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ROW-BY-ROW COMMIT FEEDBACK LOGS MODAL */}
        {/* ========================================================================= */}
        {showCommitLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl bg-gray-950 border border-amber-600/60 shadow-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-amber-800/40 bg-gradient-to-r from-amber-950/80 to-gray-950 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Terminal className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Row-by-Row Commit Feedback Logs</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-amber-500/20 text-amber-300">
                        Batch: {lastBatchSummary?.batchId || 'Latest'}
                      </span>
                    </h3>
                    <p className="text-xs text-amber-200/70">
                      Audit feedback trail logged to Supabase table <code className="text-amber-300">total_company_list</code>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCommitLogsModal(false)}
                  className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {commitLogs.length === 0 ? (
                  <div className="text-center py-8 text-amber-300/60 text-xs">
                    No detailed commit logs captured for this session.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commitLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                          log.status === 'imported'
                            ? 'bg-emerald-950/30 border-emerald-800/40'
                            : log.status === 'duplicate_skipped'
                            ? 'bg-amber-950/30 border-amber-800/40'
                            : 'bg-rose-950/30 border-rose-800/40'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-mono text-[11px] text-amber-400/70 pt-0.5">#{log.row_number}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{log.company_name}</span>
                              <span
                                className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase font-mono ${
                                  log.status === 'imported'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : log.status === 'duplicate_skipped'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {log.status}
                              </span>
                            </div>
                            <p className="text-amber-200/80 mt-1">{log.message}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-400/50 font-mono whitespace-nowrap shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-amber-800/40 bg-gray-950 flex items-center justify-between text-xs">
                <span className="text-amber-300/70">
                  Showing {commitLogs.length} logged record operations
                </span>
                <button
                  onClick={() => setShowCommitLogsModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 text-white font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
