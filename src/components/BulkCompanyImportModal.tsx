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
  ArrowRight,
  Sparkles,
  ClipboardPaste,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Company, CRA } from '../types';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';

export interface CompanyImportRow {
  rowNumber: number;
  name: string;
  industry?: string;
  website?: string;
  linkedin_url?: string;
  employee_count?: string;
  location?: string;
  notes?: string;
  status: 'valid' | 'duplicate' | 'error';
  errorMessage?: string;
  existingMatchedName?: string;
  selected: boolean;
}

interface BulkCompanyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (createdCount: number) => void;
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
    created: number;
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

      const batchNames = new Set<string>();
      const validated: CompanyImportRow[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 1;
        // Key matching: tolerate multiple header naming conventions
        const name =
          row['company_name'] ||
          row['Company Name'] ||
          row['company'] ||
          row['Company'] ||
          row['name'] ||
          row['Name'] ||
          row['organization'] ||
          row['Organization'] ||
          '';

        const cleanName = String(name).trim();

        const industry =
          row['industry'] ||
          row['Industry'] ||
          row['sector'] ||
          row['Sector'] ||
          row['domain'] ||
          row['Domain'] ||
          'Information Technology';

        const website =
          row['website'] ||
          row['Website'] ||
          row['url'] ||
          row['URL'] ||
          row['domain_url'] ||
          '';

        const linkedin =
          row['linkedin_url'] ||
          row['LinkedIn'] ||
          row['linkedin'] ||
          row['LinkedIn URL'] ||
          '';

        const employee_count =
          row['employee_count'] ||
          row['headcount'] ||
          row['Headcount'] ||
          row['size'] ||
          row['Size'] ||
          row['employees'] ||
          '100-500 employees';

        const location =
          row['location'] ||
          row['Location'] ||
          row['city'] ||
          row['City'] ||
          row['headquarters'] ||
          '';

        const notes =
          row['notes'] ||
          row['Notes'] ||
          row['description'] ||
          row['tier'] ||
          row['Tier'] ||
          '';

        // Validation Rules:
        if (!cleanName || cleanName.length < 2) {
          validated.push({
            rowNumber,
            name: cleanName || '(Blank Name)',
            industry,
            website,
            linkedin_url: linkedin,
            employee_count,
            location,
            notes,
            status: 'error',
            errorMessage: 'Missing required company name',
            selected: false,
          });
          return;
        }

        const lowerName = cleanName.toLowerCase();
        const normDom = normalizeDomain(website);

        // Check if duplicate against existing DB or in current batch
        const matchedExistingName = existingNames.get(lowerName) || (normDom ? existingDomains.get(normDom) : undefined);

        if (matchedExistingName) {
          validated.push({
            rowNumber,
            name: cleanName,
            industry,
            website,
            linkedin_url: linkedin,
            employee_count,
            location,
            notes,
            status: 'duplicate',
            existingMatchedName: matchedExistingName,
            errorMessage: `Already exists in Master Directory as "${matchedExistingName}"`,
            selected: false, // Default unselected so duplicates are skipped
          });
        } else if (batchNames.has(lowerName)) {
          validated.push({
            rowNumber,
            name: cleanName,
            industry,
            website,
            linkedin_url: linkedin,
            employee_count,
            location,
            notes,
            status: 'duplicate',
            errorMessage: 'Duplicate entry repeated within this import file',
            selected: false,
          });
        } else {
          batchNames.add(lowerName);
          validated.push({
            rowNumber,
            name: cleanName,
            industry,
            website: website.trim(),
            linkedin_url: linkedin.trim(),
            employee_count,
            location: location.trim(),
            notes: notes.trim(),
            status: 'valid',
            selected: true,
          });
        }
      });

      setParsedRows(validated);
    } catch (err: any) {
      setErrorMessage(`Failed to process records: ${err.message || 'Error occurred'}`);
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
      setErrorMessage('Please select a valid .csv, .xlsx, or .xls file.');
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
            setErrorMessage('The selected worksheet contains no data rows.');
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
        setErrorMessage('Could not detect headers and rows in pasted text. Make sure first line contains headers like "company_name,website,industry".');
        return;
      }
      processRawData(rows);
    } catch (err: any) {
      setErrorMessage(`Failed to parse pasted data: ${err.message}`);
    }
  };

  const handleDownloadSample = () => {
    const sampleHeaders = 'company_name,industry,website,headcount,location,linkedin_url,notes\n';
    const sampleRows = [
      'Zenith Robotics,Artificial Intelligence & Robotics,https://zenithrobotics.io,100-500 employees,Bengaluru,https://linkedin.com/company/zenith-robotics,Tier 1 Target Client',
      'NexusFin Payments,Fintech & Banking Services,https://nexusfin.com,500+ employees,Mumbai,https://linkedin.com/company/nexusfin,Active Hiring Sourced',
      'Apex Cloud Security,Cybersecurity & Cloud,https://apexcloud.in,50-200 employees,Hyderabad,https://linkedin.com/company/apexcloud,High priority JD drive',
      'QuantumLogic Systems,Software Engineering,https://quantumlogic.org,200-500 employees,Pune,https://linkedin.com/company/quantumlogic,Enterprise Partner',
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'placemein_total_companies_sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCommitValidCompanies = async () => {
    const validToImport = parsedRows.filter((r) => r.selected && r.status === 'valid');
    if (validToImport.length === 0) {
      setErrorMessage('No valid companies selected for import. Only valid rows with company names can be committed.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const timestamp = new Date().toISOString();
      const newCompanies: Company[] = validToImport.map((r, idx) => ({
        id: `comp_bulk_${Date.now()}_${idx}`,
        name: r.name.trim(),
        industry: r.industry?.trim() || 'Information Technology',
        website: r.website?.trim() || '',
        linkedin_url:
          r.linkedin_url?.trim() ||
          `https://www.linkedin.com/company/${r.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        employee_count: r.employee_count?.trim() || '100-500 employees',
        location: r.location?.trim() || 'Hyderabad',
        notes: r.notes?.trim() || 'Imported via Bulk Company Importer',
        entered_by_name: enteredByName.trim() || 'Admin Leadership',
        source: 'import',
        created_at: timestamp,
      }));

      // Commit to master company list in store and Supabase
      const existing = clientFallbackStore.getCompanies();
      clientFallbackStore.saveCompanies([...newCompanies, ...existing]);

      // Attempt backend API commit
      try {
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
      } catch (backendErr) {
        console.warn('Backend bulkCreateCompanies note:', backendErr);
      }

      const duplicatesCount = parsedRows.filter((r) => r.status === 'duplicate').length;
      const errorsCount = parsedRows.filter((r) => r.status === 'error').length;

      setImportResult({
        created: newCompanies.length,
        skippedDuplicates: duplicatesCount,
        errors: errorsCount,
      });

      onImportComplete(newCompanies.length);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMessage(`Failed to commit companies to Master Directory: ${err.message || 'Error'}`);
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
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Bulk Company Import</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Total Company List
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Admin Directory Master
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload or paste multi-row company records into the master Total Company Directory with automated duplicate detection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
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
              <strong>Master Company Pipeline:</strong> Records imported here become part of the central <em>Total Company List</em>. Duplicates against existing entries are automatically identified and skipped.
            </span>
          </div>
          <span className="text-[11px] text-amber-400/80 font-mono">Format: CSV, XLSX, XLS</span>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Metadata Bar */}
          <div className="bg-gray-800/60 p-4 rounded-xl border border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Uploader / Entered By (Recorded for audit log)
              </label>
              <input
                type="text"
                value={enteredByName}
                onChange={(e) => setEnteredByName(e.target.value)}
                placeholder="e.g. Aravind Reddy / Admin"
                className="w-72 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="text-xs text-gray-400 flex items-center gap-4">
              <span>Required: <strong>Company Name</strong></span>
              <span>•</span>
              <span>Optional: Industry, Website, Headcount, Location</span>
            </div>
          </div>

          {/* Input Method Selector */}
          <div className="flex bg-gray-800/80 p-1 rounded-xl border border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload CSV / Excel File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                activeTab === 'paste'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ClipboardPaste className="h-4 w-4" />
              <span>Paste CSV Data</span>
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
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileSpreadsheet className="h-8 w-8 text-amber-400" />
              <p className="text-xs font-semibold text-white">
                {file ? file.name : 'Select or drop your Company Directory CSV or Excel file'}
              </p>
              <p className="text-[11px] text-gray-400">
                Supports .csv, .xlsx, .xls with multiple columns. First row is treated as column headers.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={csvPasteText}
                onChange={(e) => setCsvPasteText(e.target.value)}
                rows={5}
                placeholder="company_name,industry,website,headcount,location&#10;Acme Corp,Software,https://acme.com,100-500 employees,Bengaluru"
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
                  <span>Parse Company Rows</span>
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
                <span>Import Operation Completed Successfully!</span>
              </div>
              <p>
                <strong>{importResult.created}</strong> new companies added to Total Company List.
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
                    Audit Report ({parsedRows.length} Rows Parsed):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterView('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        filterView === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterView('valid')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                        filterView === 'valid'
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Valid New ({validCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterView('duplicate')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
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
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
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

                <span className="text-[11px] text-gray-400">
                  {validCount} ready to commit to master directory
                </span>
              </div>

              {/* Table of Parsed Rows */}
              <div className="border border-gray-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-800/95 text-gray-400 sticky top-0 border-b border-gray-700">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Row</th>
                      <th className="p-2.5">Company Name</th>
                      <th className="p-2.5">Industry</th>
                      <th className="p-2.5">Website / Domain</th>
                      <th className="p-2.5">Headcount</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Audit Status / Error Note</th>
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
                        <td className="p-2.5 font-bold text-white">
                          {row.name}
                        </td>
                        <td className="p-2.5 text-gray-300">
                          {row.industry || '—'}
                        </td>
                        <td className="p-2.5 text-gray-400 font-mono text-[11px]">
                          {row.website ? (
                            <a
                              href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-400 hover:underline"
                            >
                              {row.website}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-2.5 text-gray-300">
                          {row.employee_count || '—'}
                        </td>
                        <td className="p-2.5 text-gray-300">
                          {row.location || '—'}
                        </td>
                        <td className="p-2.5">
                          {row.status === 'valid' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Valid New Company
                            </span>
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
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCommitValidCompanies}
            disabled={isSubmitting || validCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-900/40 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>
              {isSubmitting
                ? 'Writing to Total Company Directory...'
                : `Commit ${validCount} Company(s) to Master List`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
