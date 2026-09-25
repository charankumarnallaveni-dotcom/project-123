import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Building2,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  AlertTriangle,
  Sparkles,
  ClipboardPaste,
  ShieldCheck,
  Check,
  Info,
  Phone,
  Linkedin,
  Calendar,
  User,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import { Company, HRContact, CRA } from '../types';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';

export interface CompanyImportRow {
  rowNumber: number;
  date?: string;
  name: string; // Company Name
  hr_name?: string; // HR Recruiter / Contact Name
  phone_number?: string; // Contact Phone Number
  linkedin_url?: string; // LinkedIn Profile Link
  industry?: string;
  website?: string;
  employee_count?: string;
  location?: string;
  notes?: string;
  hasContact: boolean;
  status: 'valid' | 'duplicate' | 'error';
  actionType: 'create_both' | 'create_company_only' | 'link_contact_to_existing' | 'duplicate' | 'error';
  errorMessage?: string;
  existingMatchedName?: string;
  existingCompanyId?: string;
  selected: boolean;
}

interface BulkCompanyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (createdCompaniesCount: number, createdContactsCount?: number) => void;
  currentUser?: CRA | null;
}

export const BulkCompanyImportModal: React.FC<BulkCompanyImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvPasteText, setCsvPasteText] = useState('');
  const [enteredByName, setEnteredByName] = useState(currentUser?.name || 'Aravind Reddy');

  const [parsedRows, setParsedRows] = useState<CompanyImportRow[]>([]);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'duplicate' | 'error'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    createdCompanies: number;
    createdContacts: number;
    skippedDuplicates: number;
    errors: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const normalizeDomain = (url?: string): string => {
    if (!url) return '';
    try {
      const formatted = url.startsWith('http') ? url : `https://${url}`;
      const hostname = new URL(formatted).hostname.replace(/^www\./, '').toLowerCase();
      return hostname;
    } catch {
      return url.toLowerCase().trim();
    }
  };

  const parseDateValue = (val: any): string => {
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number') {
      try {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) {
          return date.toISOString().slice(0, 10);
        }
      } catch (_) {}
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const parts = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (parts) {
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      const year = parseInt(parts[3], 10);
      const day = p1 > 12 ? p1 : p1;
      const month = p1 > 12 ? p2 : p2;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return str;
  };

  const cleanPhoneNumber = (val: any): string => {
    if (!val) return '';
    let s = String(val).trim();
    s = s.replace(/\.0$/, '');
    return s;
  };

  const cleanLinkedIn = (val: any): string => {
    if (!val) return '';
    let s = String(val).trim();
    if (s && !s.startsWith('http://') && !s.startsWith('https://')) {
      if (s.startsWith('linkedin.com') || s.startsWith('www.linkedin.com')) {
        s = `https://${s}`;
      }
    }
    return s;
  };

  const processRawData = (rows: Record<string, any>[]) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setImportResult(null);

    try {
      const existingCompanies = clientFallbackStore.getCompanies();
      const existingNames = new Map<string, string>();
      const existingDomains = new Map<string, string>();

      existingCompanies.forEach((c) => {
        existingNames.set(c.name.trim().toLowerCase(), c.name);
        if (c.website) {
          const dom = normalizeDomain(c.website);
          if (dom) existingDomains.set(dom, c.name);
        }
      });

      const batchCompanyMap = new Map<string, number>();
      const validated: CompanyImportRow[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 1;

        // Flexible key finder supporting multiple header naming conventions
        const findVal = (candidates: string[]): string => {
          for (const c of candidates) {
            if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
              return String(row[c]).trim();
            }
          }
          const rowKeys = Object.keys(row);
          for (const c of candidates) {
            const cleanCand = c.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchedKey = rowKeys.find(
              (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanCand
            );
            if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
              const val = String(row[matchedKey]).trim();
              if (val) return val;
            }
          }
          return '';
        };

        const rawDate = findVal([
          'date', 'Date', 'DATE', 'dated', 'Dated', 'created_at', 'entry_date',
          'added_date', 'created_date', 'timestamp', 'lead_date', 'upload_date'
        ]);
        const date = parseDateValue(rawDate);

        let companyName = findVal([
          'company_name', 'Company Name', 'company', 'Company', 'organization',
          'Organization', 'client', 'firm', 'account', 'employer'
        ]);

        const hrName = findVal([
          'hr_name', 'HR Name', 'hr', 'HR', 'recruiter', 'Recruiter', 'contact_name',
          'Contact Name', 'contact_person', 'Contact Person', 'hr_person', 'hr_lead',
          'person_name', 'lead_name', 'poc'
        ]);

        // Fallback for general 'name' column if company name was not explicitly titled
        if (!companyName && row['name'] && !hrName) {
          companyName = String(row['name']).trim();
        }

        const phone = cleanPhoneNumber(findVal([
          'phone_number', 'Phone Number', 'phone', 'Phone', 'mobile', 'Mobile',
          'contact_number', 'Contact Number', 'hr_phone', 'HR Phone', 'hr_mobile',
          'mobile_number', 'telephone', 'tel', 'whatsapp', 'contact_no', 'phone_no'
        ]));

        const rawLinkedIn = findVal([
          'linkedin_profile_link', 'LinkedIn Profile Link', 'linkedin_profile', 'LinkedIn Profile',
          'linkedin_url', 'LinkedIn URL', 'linkedin', 'LinkedIn', 'profile_link', 'Profile Link',
          'hr_linkedin', 'HR LinkedIn', 'linkedin_link', 'profile_url'
        ]);
        const linkedinUrl = cleanLinkedIn(rawLinkedIn);

        const website = findVal([
          'website', 'Website', 'url', 'URL', 'domain_url', 'site', 'web', 'domain'
        ]);

        const industry = findVal([
          'industry', 'Industry', 'sector', 'Sector', 'vertical', 'business'
        ]) || 'Information Technology';

        const employeeCount = findVal([
          'employee_count', 'headcount', 'Headcount', 'size', 'Size', 'employees', 'strength'
        ]) || '100-500 employees';

        const location = findVal([
          'location', 'Location', 'city', 'City', 'headquarters', 'hq', 'state'
        ]) || 'Hyderabad';

        const notes = findVal([
          'notes', 'Notes', 'remarks', 'Remarks', 'description', 'tier', 'comment'
        ]);

        const cleanCompName = companyName.trim();
        const hasContact = Boolean(hrName || phone || (linkedinUrl && linkedinUrl.includes('/in/')));

        // 1. Validation Rule: Company Name is mandatory
        if (!cleanCompName || cleanCompName.length < 2) {
          validated.push({
            rowNumber,
            date,
            name: cleanCompName || '(Missing Company Name)',
            hr_name: hrName,
            phone_number: phone,
            linkedin_url: linkedinUrl,
            industry,
            website,
            employee_count: employeeCount,
            location,
            notes,
            hasContact,
            status: 'error',
            actionType: 'error',
            errorMessage: 'Missing required company name in this row',
            selected: false,
          });
          return;
        }

        const lowerCompName = cleanCompName.toLowerCase();
        const normDom = normalizeDomain(website);

        // 2. Check against Existing Companies in CRM Directory
        const matchedExistingName = existingNames.get(lowerCompName) || (normDom ? existingDomains.get(normDom) : undefined);
        const existingCompObj = matchedExistingName
          ? existingCompanies.find((c) => c.name.toLowerCase() === matchedExistingName.toLowerCase())
          : undefined;

        if (matchedExistingName) {
          if (hasContact) {
            // Company exists, but this row has an HR contact -> valid operation to attach contact
            validated.push({
              rowNumber,
              date,
              name: cleanCompName,
              hr_name: hrName,
              phone_number: phone,
              linkedin_url: linkedinUrl,
              industry,
              website,
              employee_count: employeeCount,
              location,
              notes,
              hasContact: true,
              status: 'valid',
              actionType: 'link_contact_to_existing',
              existingMatchedName: matchedExistingName,
              existingCompanyId: existingCompObj?.id,
              selected: true,
            });
          } else {
            // Company exists, and no new HR contact is provided in this row -> duplicate skip
            validated.push({
              rowNumber,
              date,
              name: cleanCompName,
              hr_name: hrName,
              phone_number: phone,
              linkedin_url: linkedinUrl,
              industry,
              website,
              employee_count: employeeCount,
              location,
              notes,
              hasContact: false,
              status: 'duplicate',
              actionType: 'duplicate',
              existingMatchedName: matchedExistingName,
              errorMessage: `Company already exists in CRM Directory as "${matchedExistingName}"`,
              selected: false,
            });
          }
        } else if (batchCompanyMap.has(lowerCompName)) {
          // Company was already encountered earlier in this exact upload batch
          if (hasContact) {
            validated.push({
              rowNumber,
              date,
              name: cleanCompName,
              hr_name: hrName,
              phone_number: phone,
              linkedin_url: linkedinUrl,
              industry,
              website,
              employee_count: employeeCount,
              location,
              notes,
              hasContact: true,
              status: 'valid',
              actionType: 'link_contact_to_existing',
              selected: true,
            });
          } else {
            validated.push({
              rowNumber,
              date,
              name: cleanCompName,
              hr_name: hrName,
              phone_number: phone,
              linkedin_url: linkedinUrl,
              industry,
              website,
              employee_count: employeeCount,
              location,
              notes,
              hasContact: false,
              status: 'duplicate',
              actionType: 'duplicate',
              errorMessage: `Repeated company without new contact info (seen in Row #${batchCompanyMap.get(lowerCompName)})`,
              selected: false,
            });
          }
        } else {
          // Brand new company
          batchCompanyMap.set(lowerCompName, rowNumber);
          validated.push({
            rowNumber,
            date,
            name: cleanCompName,
            hr_name: hrName,
            phone_number: phone,
            linkedin_url: linkedinUrl,
            industry,
            website,
            employee_count: employeeCount,
            location,
            notes,
            hasContact,
            status: 'valid',
            actionType: hasContact ? 'create_both' : 'create_company_only',
            selected: true,
          });
        }
      });

      setParsedRows(validated);
    } catch (err: any) {
      setErrorMessage(`Failed to scan records: ${err.message || 'Error occurred'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErrorMessage(null);

    const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls');
    const isCsv = f.name.endsWith('.csv') || f.name.endsWith('.txt');

    if (!isExcel && !isCsv) {
      setErrorMessage('Please select a valid .xlsx, .xls, or .csv file.');
      return;
    }

    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
          if (rows.length === 0) {
            setErrorMessage('The selected Excel worksheet contains no data rows.');
            return;
          }
          processRawData(rows);
        } catch (err: any) {
          setErrorMessage(`Error parsing Excel workbook: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const workbook = XLSX.read(text, { type: 'string' });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
          processRawData(rows);
        } catch (err: any) {
          setErrorMessage(`Error parsing CSV file: ${err.message}`);
        }
      };
      reader.readAsText(f);
    }
  };

  const handleParsePaste = () => {
    if (!csvPasteText.trim()) {
      setErrorMessage('Please paste company data (CSV or tab-delimited).');
      return;
    }
    try {
      const workbook = XLSX.read(csvPasteText, { type: 'string' });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (rows.length === 0) {
        setErrorMessage(
          'Could not detect headers and rows in pasted text. Make sure first line contains headers like "date,company_name,hr_name,phone_number,linkedin_url".'
        );
        return;
      }
      processRawData(rows);
    } catch (err: any) {
      setErrorMessage(`Failed to parse pasted data: ${err.message}`);
    }
  };

  // Download Sample Excel (.xlsx) file
  const handleDownloadSampleExcel = () => {
    const data = [
      ['Date', 'Company Name', 'HR Name', 'Phone Number', 'LinkedIn Profile Link', 'Website', 'Industry', 'Location'],
      ['2025-05-10', 'Zenith Robotics', 'Pooja Sharma', '+91 98765 43210', 'https://www.linkedin.com/in/pooja-sharma-hr', 'https://zenithrobotics.io', 'Artificial Intelligence & Robotics', 'Bengaluru'],
      ['2025-05-11', 'NexusFin Payments', 'Rajesh Verma', '+91 98450 12345', 'https://www.linkedin.com/in/rajesh-verma-recruiter', 'https://nexusfin.com', 'Fintech & Banking Services', 'Mumbai'],
      ['2025-05-12', 'Apex Cloud Security', 'Ananya Roy', '+91 99887 76655', 'https://www.linkedin.com/in/ananya-roy-cloud', 'https://apexcloud.in', 'Cybersecurity & Cloud', 'Hyderabad'],
      ['2025-05-13', 'QuantumLogic Systems', 'Vikram Seth', '+91 97112 33445', 'https://www.linkedin.com/in/vikram-seth-tech', 'https://quantumlogic.org', 'Software Engineering', 'Pune'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CRM_Import_Template');
    XLSX.writeFile(wb, 'placemein_company_hr_importer_sample.xlsx');
  };

  // Download Sample CSV
  const handleDownloadSampleCSV = () => {
    const sampleHeaders = 'Date,Company Name,HR Name,Phone Number,LinkedIn Profile Link,Website,Industry,Location\n';
    const sampleRows = [
      '2025-05-10,Zenith Robotics,Pooja Sharma,+91 98765 43210,https://www.linkedin.com/in/pooja-sharma-hr,https://zenithrobotics.io,Artificial Intelligence,Bengaluru',
      '2025-05-11,NexusFin Payments,Rajesh Verma,+91 98450 12345,https://www.linkedin.com/in/rajesh-verma-recruiter,https://nexusfin.com,Fintech,Mumbai',
      '2025-05-12,Apex Cloud Security,Ananya Roy,+91 99887 76655,https://www.linkedin.com/in/ananya-roy-cloud,https://apexcloud.in,Cybersecurity,Hyderabad',
      '2025-05-13,QuantumLogic Systems,Vikram Seth,+91 97112 33445,https://www.linkedin.com/in/vikram-seth-tech,https://quantumlogic.org,Software Engineering,Pune',
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'placemein_company_hr_importer_sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCommitValidCompanies = async () => {
    const validToImport = parsedRows.filter((r) => r.selected && r.status === 'valid');
    if (validToImport.length === 0) {
      setErrorMessage('No valid rows selected for import.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const timestamp = new Date().toISOString();
      const existingCompanies = clientFallbackStore.getCompanies();
      const existingContacts = clientFallbackStore.getContacts();

      const newCompanies: Company[] = [];
      const newContacts: HRContact[] = [];
      const companyMap = new Map<string, string>(); // lowerName -> companyId

      existingCompanies.forEach((c) => {
        companyMap.set(c.name.toLowerCase().trim(), c.id);
      });

      for (let i = 0; i < validToImport.length; i++) {
        const r = validToImport[i];
        const compName = r.name.trim();
        const lowerName = compName.toLowerCase();

        let companyId = r.existingCompanyId || companyMap.get(lowerName);

        // 1. If company does not exist yet, create company
        if (!companyId) {
          companyId = `comp_bulk_${Date.now()}_${i}`;
          const newComp: Company = {
            id: companyId,
            name: compName,
            industry: r.industry?.trim() || 'Information Technology',
            website: r.website?.trim() || '',
            linkedin_url:
              r.linkedin_url && !r.linkedin_url.includes('/in/')
                ? r.linkedin_url.trim()
                : `https://www.linkedin.com/company/${compName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            employee_count: r.employee_count?.trim() || '100-500 employees',
            location: r.location?.trim() || 'Hyderabad',
            notes: r.notes?.trim() || `Imported via Bulk Importer (${r.date || 'Active'})`,
            entered_by_name: enteredByName.trim() || currentUser?.name || 'Aravind Reddy',
            source: 'import',
            created_at: r.date ? new Date(r.date).toISOString() : timestamp,
          };
          newCompanies.push(newComp);
          existingCompanies.unshift(newComp);
          companyMap.set(lowerName, companyId);
        }

        // 2. If HR Contact details exist, create and store HR Contact linked to company
        if (r.hr_name || r.phone_number || r.linkedin_url) {
          const contactName = r.hr_name?.trim() || `${compName} HR Recruiter`;
          const contactPhone = r.phone_number?.trim() || '';
          const contactLinkedIn = r.linkedin_url?.trim() || '';

          const newContact: HRContact = {
            id: `cont_bulk_${Date.now()}_${i}`,
            company_id: companyId,
            company_name: compName,
            name: contactName,
            title: 'HR Manager / Talent Acquisition',
            email: '',
            phone: contactPhone,
            linkedin_url: contactLinkedIn,
            domain: r.industry || 'Information Technology',
            location: r.location || 'Hyderabad',
            remarks: r.notes || `Scanned from Excel file (${r.date || new Date().toISOString().slice(0, 10)})`,
            spoc: currentUser?.name || 'Aravind Reddy',
            entered_by_name: enteredByName.trim() || currentUser?.name || 'Aravind Reddy',
            source: 'import',
            created_at: r.date ? new Date(r.date).toISOString() : timestamp,
          };
          newContacts.push(newContact);
          existingContacts.unshift(newContact);
        }
      }

      // Commit to client store
      if (newCompanies.length > 0) {
        clientFallbackStore.saveCompanies(existingCompanies);
      }
      if (newContacts.length > 0) {
        clientFallbackStore.saveContacts(existingContacts);
      }

      // Attempt background backend API synchronization
      try {
        if (newCompanies.length > 0) {
          await api.bulkCreateCompanies(
            newCompanies.map((c) => ({
              name: c.name,
              industry: c.industry,
              website: c.website,
              linkedin_url: c.linkedin_url,
              employee_count: c.employee_count,
              location: c.location,
              notes: c.notes,
              entered_by_name: c.entered_by_name,
              source: 'import',
            }))
          );
        }
      } catch (backendErr) {
        console.warn('Backend bulkCreateCompanies note:', backendErr);
      }

      const duplicatesCount = parsedRows.filter((r) => r.status === 'duplicate').length;
      const errorsCount = parsedRows.filter((r) => r.status === 'error').length;

      setImportResult({
        createdCompanies: newCompanies.length,
        createdContacts: newContacts.length,
        skippedDuplicates: duplicatesCount,
        errors: errorsCount,
      });

      onImportComplete(newCompanies.length, newContacts.length);
      setTimeout(() => {
        onClose();
      }, 2400);
    } catch (err: any) {
      setErrorMessage(`Failed to commit records to CRM Directory: ${err.message || 'Error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRows = parsedRows.filter((row) => {
    if (filterView === 'all') return true;
    return row.status === filterView;
  });

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;
  const contactsCount = parsedRows.filter((r) => r.selected && r.status === 'valid' && r.hasContact).length;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-amber-600/40 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-amber-950/20 to-gray-900 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Bulk Company & HR Importer</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Excel (.xlsx / .xls) & CSV
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  CRM Directory
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload or drop an Excel spreadsheet containing <strong>Date, Company Name, HR Name, Phone Number, and LinkedIn Profile Link</strong>. Scans and stores companies and recruiter contacts directly into the CRM directory.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSampleExcel}
              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Download sample formatted Excel .xlsx workbook"
            >
              <FileDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Sample Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Download sample CSV file"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>Sample CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Informational Guidance Notice */}
        <div className="bg-amber-950/30 border-b border-amber-800/40 px-5 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Smart Auto-Scanning:</strong> Automatically detects columns: <code>Date</code>, <code>Company Name</code>, <code>HR Name</code>, <code>Phone Number</code>, and <code>LinkedIn Profile Link</code>. Duplicate companies are safely identified, and new HR contacts attach directly to existing company records.
            </span>
          </div>
          <span className="text-[11px] text-amber-400/80 font-mono">Format: .xlsx, .xls, .csv</span>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Metadata Bar */}
          <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Uploader / Entered By (Recorded in CRM audit trail)
              </label>
              <input
                type="text"
                value={enteredByName}
                onChange={(e) => setEnteredByName(e.target.value)}
                placeholder="e.g. Aravind Reddy / Team"
                className="w-72 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="text-xs text-gray-400 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Auto-scans 5 Primary Columns:
              </span>
              <span className="px-1.5 py-0.5 bg-gray-700/60 rounded text-[11px] font-mono text-gray-200">Date</span>
              <span className="px-1.5 py-0.5 bg-gray-700/60 rounded text-[11px] font-mono text-amber-300 font-bold">Company Name*</span>
              <span className="px-1.5 py-0.5 bg-gray-700/60 rounded text-[11px] font-mono text-purple-300">HR Name</span>
              <span className="px-1.5 py-0.5 bg-gray-700/60 rounded text-[11px] font-mono text-blue-300">Phone Number</span>
              <span className="px-1.5 py-0.5 bg-gray-700/60 rounded text-[11px] font-mono text-cyan-300">LinkedIn Link</span>
            </div>
          </div>

          {/* Input Method Selector */}
          <div className="flex bg-gray-800/80 p-1 rounded-xl border border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload Excel / CSV File (.xlsx, .xls, .csv)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ClipboardPaste className="h-4 w-4" />
              <span>Paste Excel / CSV Table Data</span>
            </button>
          </div>

          {/* Upload Panel */}
          {activeTab === 'upload' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileSpreadsheet className="h-10 w-10 text-amber-400 animate-pulse" />
              <p className="text-xs font-semibold text-white">
                {file ? file.name : 'Select or drop your Excel (.xlsx / .xls) or CSV company file here'}
              </p>
              <p className="text-[11px] text-gray-400">
                Scans columns for: Date, Company Name, HR Name, Phone Number, LinkedIn Profile Link, Website, Location.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={csvPasteText}
                onChange={(e) => setCsvPasteText(e.target.value)}
                rows={5}
                placeholder="Date,Company Name,HR Name,Phone Number,LinkedIn Profile Link,Website&#10;2025-05-15,Zenith Robotics,Pooja Sharma,+91 98765 43210,https://www.linkedin.com/in/pooja-sharma-hr,https://zenithrobotics.io"
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500 resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParsePaste}
                  disabled={isProcessing || !csvPasteText.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-900/30"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Scan & Parse Data Rows</span>
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-950/50 border border-red-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {importResult && (
            <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-4 space-y-1 text-xs text-emerald-200">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span>Bulk Import Successfully Stored in CRM Directory!</span>
              </div>
              <p>
                <strong>{importResult.createdCompanies}</strong> new companies added to Company Directory.
                {importResult.createdContacts > 0 && (
                  <span>
                    {' '}• <strong>{importResult.createdContacts}</strong> verified HR contacts stored in Contacts CRM directory.
                  </span>
                )}
                {importResult.skippedDuplicates > 0 && ` (${importResult.skippedDuplicates} duplicates safely skipped)`}
                {importResult.errors > 0 && ` (${importResult.errors} invalid rows ignored)`}
              </p>
            </div>
          )}

          {/* Parsed Results Overview & Verification Matrix */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              {/* Summary Metric Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase text-gray-300">
                    Scan Report ({parsedRows.length} Rows):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterView('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                        filterView === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterView('valid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                        filterView === 'valid'
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Ready ({validCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterView('duplicate')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                        filterView === 'duplicate'
                          ? 'bg-amber-600 text-white'
                          : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      <span>Duplicates ({duplicateCount})</span>
                    </button>
                    {errorCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterView('error')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                          filterView === 'error'
                            ? 'bg-red-600 text-white'
                            : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                        }`}
                      >
                        <AlertCircle className="h-3 w-3" />
                        <span>Errors ({errorCount})</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">{validCount} valid companies</span>
                  <span>•</span>
                  <span className="text-purple-400 font-semibold">{contactsCount} HR contacts with phone/LinkedIn</span>
                </div>
              </div>

              {/* Table of Parsed Rows */}
              <div className="border border-gray-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-800/95 text-gray-400 sticky top-0 border-b border-gray-700">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Row</th>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Company Name</th>
                      <th className="p-2.5">HR Name</th>
                      <th className="p-2.5">Phone Number</th>
                      <th className="p-2.5">LinkedIn Profile Link</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Scan Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 bg-gray-950/60">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-gray-800/30 transition ${
                          row.status === 'valid'
                            ? ''
                            : row.status === 'duplicate'
                            ? 'bg-amber-950/10'
                            : 'bg-red-950/15'
                        }`}
                      >
                        <td className="p-2.5 text-center text-gray-500 font-mono text-[11px]">
                          {row.rowNumber}
                        </td>
                        <td className="p-2.5 text-gray-300 font-mono text-[11px] whitespace-nowrap">
                          {row.date ? (
                            <span className="flex items-center gap-1 text-gray-300">
                              <Calendar className="h-3 w-3 text-amber-400" />
                              {row.date}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span>{row.name}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-purple-300 font-medium whitespace-nowrap">
                          {row.hr_name ? (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-purple-400 shrink-0" />
                              <span>{row.hr_name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-blue-300 font-mono text-[11px] whitespace-nowrap">
                          {row.phone_number ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-blue-400 shrink-0" />
                              <span>{row.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-cyan-300 font-mono text-[11px] max-w-[160px] truncate">
                          {row.linkedin_url ? (
                            <a
                              href={row.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline flex items-center gap-1 truncate"
                              title={row.linkedin_url}
                            >
                              <Linkedin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{row.linkedin_url}</span>
                            </a>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-gray-300 whitespace-nowrap">
                          {row.location || '—'}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {row.status === 'valid' ? (
                            row.actionType === 'create_both' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Store Company + HR Contact
                              </span>
                            ) : row.actionType === 'link_contact_to_existing' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
                                <User className="h-2.5 w-2.5" />
                                Add HR to Existing Company
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Valid Company
                              </span>
                            )
                          ) : row.status === 'duplicate' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Duplicate (Skipped)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" />
                              {row.errorMessage || 'Invalid Row'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/95 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCommitValidCompanies}
            disabled={isSubmitting || validCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-900/40 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>
              {isSubmitting
                ? 'Storing Records into CRM Directory...'
                : `Store ${validCount} Company Record(s) in CRM Directory`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
