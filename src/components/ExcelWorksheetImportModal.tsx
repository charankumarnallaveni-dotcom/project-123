import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  UserCheck,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  Table,
} from 'lucide-react';
import { api } from '../services/api';

interface ExcelWorksheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (count: number) => void;
  currentUser?: { name: string };
  defaultSpoc?: string;
  adminMode?: boolean;
}

interface ParsedSheetData {
  name: string;
  headers: string[];
  rawRows: Record<string, any>[];
}

const KNOWN_SPOC_LIST = [
  'Namitha',
  'Harish',
  'Pavithra',
  'Mansi',
  'Vineela',
  'Aravind',
  'Deepak',
  'Kavya',
  'Sandeep',
  'General',
];

export const ExcelWorksheetImportModal: React.FC<ExcelWorksheetImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  currentUser,
  defaultSpoc = 'Namitha',
  adminMode = false,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<ParsedSheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [importAllSheets, setImportAllSheets] = useState(false);
  const [enteredByName, setEnteredByName] = useState(currentUser?.name || 'Aravind Reddy');
  const [selectedDefaultSpoc, setSelectedDefaultSpoc] = useState(
    defaultSpoc !== 'all' ? defaultSpoc : 'Namitha'
  );

  // Column Mappings for active sheet: targetField -> excelColumnName
  const [columnMap, setColumnMap] = useState<{
    company_name: string;
    hr_name: string;
    title: string;
    phone: string;
    email: string;
    spoc: string;
    domain: string;
    employee_count: string;
    website: string;
    linkedin_url: string;
    location: string;
    remarks: string;
  }>({
    company_name: '',
    hr_name: '',
    title: '',
    phone: '',
    email: '',
    spoc: '',
    domain: '',
    employee_count: '',
    website: '',
    linkedin_url: '',
    location: '',
    remarks: '',
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    count: number;
    companiesCreated: number;
    contactsCreated: number;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Auto-detect best column matches based on header strings
  const autoDetectMappings = (headers: string[]) => {
    const findBestMatch = (candidates: string[]): string => {
      for (const candidate of candidates) {
        const found = headers.find((h) =>
          h.toLowerCase().trim().replace(/[^a-z0-9]/g, '').includes(candidate.replace(/[^a-z0-9]/g, ''))
        );
        if (found) return found;
      }
      return '';
    };

    return {
      company_name: findBestMatch(['companyname', 'company', 'organization', 'client', 'firm', 'employer']),
      hr_name: findBestMatch(['hrname', 'contactname', 'recruitername', 'name', 'hr', 'contact', 'person']),
      title: findBestMatch(['designation', 'title', 'role', 'position', 'jobtitle']),
      phone: findBestMatch(['phone', 'mobile', 'contactno', 'phonenumber', 'tel', 'cell', 'calling', 'contactnumber']),
      email: findBestMatch(['email', 'mail', 'emailaddress', 'emailid', 'workemail']),
      spoc: findBestMatch(['spoc', 'assignedto', 'owner', 'assigned', 'cra', 'teammember']),
      domain: findBestMatch(['domain', 'industry', 'sector', 'technology', 'vertical']),
      employee_count: findBestMatch(['employeecount', 'headcount', 'size', 'employees', 'strength', 'companysize']),
      website: findBestMatch(['website', 'url', 'web', 'link', 'site']),
      linkedin_url: findBestMatch(['linkedin', 'companylinkedin', 'hrlinkedin', 'linkedinurl']),
      location: findBestMatch(['location', 'city', 'state', 'address', 'place']),
      remarks: findBestMatch(['remarks', 'status', 'notes', 'feedback', 'outcome', 'response']),
    };
  };

  const handleFile = async (selectedFile: File) => {
    try {
      setError(null);
      setImportResult(null);

      // Handle PDF Sourcing Sheet files gracefully
      if (selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.type === 'application/pdf') {
        setIsProcessing(true);
        try {
          const parseRes = await api.parseDocumentHR({
            file: selectedFile,
            entered_by_name: enteredByName,
          });

          const leadsList: Record<string, any>[] = [];
          const contacts = parseRes.contacts || [];

          contacts.forEach((c) => {
            leadsList.push({
              'Company Name': c.company?.name || parseRes.company?.name || 'Partner Company',
              'HR Name': c.name,
              'Designation': c.title || 'HR Lead',
              'Phone Number': c.phone || '',
              'Email': c.email || '',
              'SPOC': c.spoc || selectedDefaultSpoc,
              'Domain': c.domain || 'Technology',
              'Employee Count': c.company?.employee_count || '100-500 employees',
              'Website': c.company?.website || '',
              'Company LinkedIn': c.company?.linkedin_url || '',
              'Location': c.location || 'Hyderabad',
              'Remarks': c.remarks || 'Imported from Sourcing Sheet',
            });
          });

          if (leadsList.length === 0 && parseRes.company) {
            leadsList.push({
              'Company Name': parseRes.company.name,
              'HR Name': 'HR Executive',
              'Designation': 'Talent Acquisition Lead',
              'Phone Number': '',
              'Email': '',
              'SPOC': selectedDefaultSpoc,
              'Domain': parseRes.company.industry || 'Technology',
              'Employee Count': parseRes.company.employee_count || '100-500 employees',
              'Website': parseRes.company.website || '',
              'Company LinkedIn': parseRes.company.linkedin_url || '',
              'Location': 'Hyderabad',
              'Remarks': 'Imported from Sourcing Sheet',
            });
          }

          if (leadsList.length === 0) {
            throw new Error('No contacts or companies could be parsed from this PDF file.');
          }

          const headers = Object.keys(leadsList[0]);
          const pdfSheet: ParsedSheetData = {
            name: selectedFile.name.replace(/\.[^/.]+$/, ''),
            headers,
            rawRows: leadsList,
          };

          setFile(selectedFile);
          setSheets([pdfSheet]);
          setActiveSheetIndex(0);
          const detected = autoDetectMappings(headers);
          setColumnMap(detected);
          setIsProcessing(false);
          return;
        } catch (pdfErr: any) {
          setIsProcessing(false);
          throw new Error(pdfErr.message || 'Failed to extract data from PDF');
        }
      }

      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No worksheets found in this Excel file.');
      }

      const parsedSheets: ParsedSheetData[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        // Convert to array of objects with raw headers preserved
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
        });

        // Determine all unique header keys
        let headers: string[] = [];
        if (rows.length > 0) {
          headers = Object.keys(rows[0]).map((h) => h.trim());
        }

        parsedSheets.push({
          name: sheetName,
          headers,
          rawRows: rows,
        });
      });

      if (parsedSheets.length === 0 || parsedSheets.every((s) => s.rawRows.length === 0)) {
        throw new Error('The uploaded Excel file has no data rows to import.');
      }

      setFile(selectedFile);
      setSheets(parsedSheets);
      setActiveSheetIndex(0);

      // Auto-detect columns for the first sheet
      const detected = autoDetectMappings(parsedSheets[0].headers);
      setColumnMap(detected);
    } catch (err: any) {
      console.error('File parse error:', err);
      setError(err.message || 'Failed to read file. Please ensure it is a valid Excel (.xlsx, .xls), CSV (.csv), or PDF sourcing sheet.');
      setFile(null);
      setSheets([]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSheetChange = (index: number) => {
    setActiveSheetIndex(index);
    if (sheets[index]) {
      const detected = autoDetectMappings(sheets[index].headers);
      setColumnMap(detected);
    }
  };

  // Build the list of leads ready to import from active sheet or all sheets
  const preparedLeads = useMemo(() => {
    if (!sheets.length) return [];

    const sheetsToProcess = importAllSheets ? sheets : [sheets[activeSheetIndex]];
    const leadsList: Array<{
      company_name: string;
      website?: string;
      linkedin_url?: string;
      employee_count?: string;
      industry?: string;
      hr_name: string;
      title?: string;
      phone?: string;
      email?: string;
      hr_linkedin?: string;
      domain?: string;
      location?: string;
      remarks?: string;
      spoc?: string;
      entered_by_name?: string;
    }> = [];

    sheetsToProcess.forEach((sheet) => {
      // If sheet name matches a known SPOC, we can use that as the sheet-level default SPOC
      const sheetNameMatch = KNOWN_SPOC_LIST.find(
        (s) => s.toLowerCase() === sheet.name.toLowerCase()
      );
      const sheetDefaultSpoc = sheetNameMatch || selectedDefaultSpoc;

      sheet.rawRows.forEach((row) => {
        const compVal = String(row[columnMap.company_name] || '').trim();
        const hrVal = String(row[columnMap.hr_name] || '').trim();

        // Must have at least company or HR name
        if (!compVal && !hrVal) return;

        const spocVal = columnMap.spoc && row[columnMap.spoc]
          ? String(row[columnMap.spoc]).trim()
          : sheetDefaultSpoc;

        leadsList.push({
          company_name: compVal || 'Unknown Company',
          website: columnMap.website ? String(row[columnMap.website] || '').trim() : undefined,
          linkedin_url: columnMap.linkedin_url ? String(row[columnMap.linkedin_url] || '').trim() : undefined,
          employee_count: columnMap.employee_count ? String(row[columnMap.employee_count] || '').trim() : '100-500 employees',
          industry: columnMap.domain ? String(row[columnMap.domain] || '').trim() : 'Technology',
          hr_name: hrVal || 'Talent Acquisition Team',
          title: columnMap.title ? String(row[columnMap.title] || '').trim() : 'HR Lead',
          phone: columnMap.phone ? String(row[columnMap.phone] || '').trim() : '',
          email: columnMap.email ? String(row[columnMap.email] || '').trim() : '',
          hr_linkedin: columnMap.linkedin_url ? String(row[columnMap.linkedin_url] || '').trim() : '',
          domain: columnMap.domain ? String(row[columnMap.domain] || '').trim() : 'Technology',
          location: columnMap.location ? String(row[columnMap.location] || '').trim() : '',
          remarks: columnMap.remarks ? String(row[columnMap.remarks] || '').trim() : 'Imported via Excel',
          spoc: spocVal || 'Namitha',
          entered_by_name: enteredByName.trim() || 'Aravind Reddy',
        });
      });
    });

    return leadsList;
  }, [sheets, activeSheetIndex, importAllSheets, columnMap, selectedDefaultSpoc, enteredByName]);

  const handleExecuteImport = async () => {
    if (!preparedLeads.length) {
      setError('No valid leads detected with company and contact information. Please check your column mappings.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await api.bulkImportWorksheetLeads(preparedLeads);
      setImportResult({
        count: result.count,
        companiesCreated: result.companies_created,
        contactsCreated: result.contacts_created,
        message: result.message || `Successfully imported ${result.count} leads into the worksheet!`,
      });
      onImportSuccess(result.count);
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message || 'Failed to import worksheet leads. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Company Name': 'TechNova Solutions',
        'HR Contact Name': 'Kavita Iyer',
        'Designation': 'Head of Talent Acquisition',
        'Phone Number': '+91 98765 43210',
        'Email Address': 'kavita.i@technova.example.com',
        'SPOC': 'Namitha',
        'Domain / Industry': 'IT Services & Cloud',
        'Employee Headcount': '500-1000 employees',
        'Website': 'https://technova.example.com',
        'LinkedIn URL': 'https://linkedin.com/company/technova-solutions',
        'Location': 'Bengaluru',
        'Remarks': 'Responded',
      },
      {
        'Company Name': 'AeroSphere Robotics',
        'HR Contact Name': 'Rajesh Sharma',
        'Designation': 'Senior Technical Recruiter',
        'Phone Number': '+91 91234 56789',
        'Email Address': 'rajesh@aerosphere.example.com',
        'SPOC': 'Harish',
        'Domain / Industry': 'Robotics & Hardware',
        'Employee Headcount': '200-500 employees',
        'Website': 'https://aerosphere.example.com',
        'LinkedIn URL': 'https://linkedin.com/company/aerosphere-robotics',
        'Location': 'Hyderabad',
        'Remarks': 'Mail Sent',
      },
      {
        'Company Name': 'QuantumSec Labs',
        'HR Contact Name': 'Ananya Desai',
        'Designation': 'Talent Partner - Cyber Security',
        'Phone Number': '+91 99887 76655',
        'Email Address': 'ananya.d@quantumsec.example.com',
        'SPOC': 'Pavithra',
        'Domain / Industry': 'Cyber Security',
        'Employee Headcount': '100-250 employees',
        'Website': 'https://quantumsec.example.com',
        'LinkedIn URL': 'https://linkedin.com/company/quantumsec-labs',
        'Location': 'Pune',
        'Remarks': 'Pending',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Worksheet_Leads_Template');
    XLSX.writeFile(wb, 'Placemein_Worksheet_Leads_Template.xlsx');
  };

  const currentSheet = sheets[activeSheetIndex];
  const activeHeaders = currentSheet?.headers || [];

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-emerald-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/40 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-emerald-950/30 to-gray-900 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Import Excel & CSV to Worksheet
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  Excel Engine
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Upload <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> spreadsheets. Auto-detects columns, assigns SPOC sheets, and updates your live database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg border border-gray-700 transition"
              title="Download standard template with sample rows"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sample Template</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3.5 flex items-start gap-3 text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold">Import Notification</p>
                <p className="mt-0.5 text-rose-200">{error}</p>
              </div>
            </div>
          )}

          {importResult ? (
            /* Success State */
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 animate-scale-up">
              <div className="h-16 w-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Excel Import Complete!</h3>
                <p className="text-xs text-gray-300 mt-1 max-w-md mx-auto">
                  {importResult.message}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto py-2">
                <div className="bg-gray-900/90 border border-emerald-500/30 rounded-xl p-3">
                  <span className="block text-2xl font-black text-emerald-400">{importResult.count}</span>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Leads Imported</span>
                </div>
                <div className="bg-gray-900/90 border border-emerald-500/30 rounded-xl p-3">
                  <span className="block text-2xl font-black text-white">{importResult.companiesCreated}</span>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Companies Added</span>
                </div>
                <div className="bg-gray-900/90 border border-emerald-500/30 rounded-xl p-3">
                  <span className="block text-2xl font-black text-indigo-400">{importResult.contactsCreated}</span>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Contacts Synced</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setFile(null);
                    setSheets([]);
                    setImportResult(null);
                  }}
                  className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition"
                >
                  Import Another File
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-900/40 transition flex items-center gap-2"
                >
                  <span>View Updated Worksheets</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: File Dropzone / Selector */}
              {!file ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 hover:border-emerald-500/80 rounded-2xl p-8 sm:p-10 text-center bg-gray-900/60 hover:bg-emerald-950/10 transition-all cursor-pointer group flex flex-col items-center justify-center"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv, .pdf, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all shadow-lg mb-4">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">
                    Choose Excel, CSV, or PDF Sourcing Sheet
                  </h3>
                  <p className="text-xs text-gray-400 max-w-sm mb-4">
                    Drag and drop your spreadsheet or sourcing sheet here. Supports <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, and <strong>.pdf</strong> sourcing sheets.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-500">
                    <span className="px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-emerald-400 font-mono font-bold">.XLSX</span>
                    <span className="px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-emerald-400 font-mono font-bold">.XLS</span>
                    <span className="px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-emerald-400 font-mono font-bold">.CSV</span>
                    <span className="px-2.5 py-1 rounded-md bg-purple-900/40 border border-purple-700/60 text-purple-300 font-mono font-bold">.PDF</span>
                  </div>
                </div>
              ) : (
                /* File Selected Banner */
                <div className="bg-gray-800/90 border border-emerald-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{file.name}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Detected <strong>{sheets.length} worksheet tab{sheets.length > 1 ? 's' : ''}</strong> · Total {preparedLeads.length} valid lead rows
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setFile(null);
                      setSheets([]);
                    }}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold rounded-lg transition"
                  >
                    Change File
                  </button>
                </div>
              )}

              {file && sheets.length > 0 && (
                <>
                  {/* Step 2: Sheet Selector (if workbook has multiple sheets) */}
                  {sheets.length > 1 && (
                    <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                          <Layers className="h-4 w-4 text-emerald-400" />
                          <span>Select Worksheet Tab</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                          <input
                            type="checkbox"
                            checked={importAllSheets}
                            onChange={(e) => setImportAllSheets(e.target.checked)}
                            className="rounded border-gray-700 text-emerald-500 focus:ring-0"
                          />
                          <span>Import All Sheets Simultaneously</span>
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {sheets.map((sheet, idx) => (
                          <button
                            key={sheet.name}
                            type="button"
                            onClick={() => handleSheetChange(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 border ${
                              activeSheetIndex === idx && !importAllSheets
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                                : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            <span>{sheet.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-black/40 text-gray-300">
                              {sheet.rawRows.length} rows
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Assignment & Attribution Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-gray-800/60 border border-gray-700/80 rounded-xl p-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Data Sourced / Entered By (Your Name) *</span>
                      </label>
                      <input
                        type="text"
                        value={enteredByName}
                        onChange={(e) => setEnteredByName(e.target.value)}
                        placeholder="e.g. Aravind Reddy"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Saved on each contact & company as "Entered by: [Name]".
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-amber-400" />
                        <span>Default SPOC Sheet (for unassigned rows)</span>
                      </label>
                      <select
                        value={selectedDefaultSpoc}
                        onChange={(e) => setSelectedDefaultSpoc(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {KNOWN_SPOC_LIST.map((spoc) => (
                          <option key={spoc} value={spoc}>
                            {spoc} Sheet
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Rows without an explicit SPOC column will route to this sheet.
                      </p>
                    </div>
                  </div>

                  {/* Step 4: Column Mapping Configuration */}
                  <div className="bg-gray-800/60 border border-gray-700/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                        <Table className="h-4 w-4 text-emerald-400" />
                        <span>Column Mapping (Spreadsheet Header → Worksheet Field)</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setColumnMap(autoDetectMappings(activeHeaders))}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Auto-Detect Again</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {/* Company Name (Required) */}
                      <div>
                        <label className="block text-[11px] font-bold text-white mb-1">
                          Company Name <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={columnMap.company_name}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, company_name: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Select Column --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* HR Contact Name (Required) */}
                      <div>
                        <label className="block text-[11px] font-bold text-white mb-1">
                          HR Contact Name <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={columnMap.hr_name}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, hr_name: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Select Column --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Designation / Title */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          Designation / Title
                        </label>
                        <select
                          value={columnMap.title}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None (Defaults to 'HR Lead') --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-emerald-400" />
                          <span>Phone / Contact Number</span>
                        </label>
                        <select
                          value={columnMap.phone}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, phone: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-indigo-400" />
                          <span>Email Address</span>
                        </label>
                        <select
                          value={columnMap.email}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, email: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* SPOC / Assigned To */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          SPOC / Assigned Team Member
                        </label>
                        <select
                          value={columnMap.spoc}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, spoc: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Use Default SPOC ({selectedDefaultSpoc}) --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Domain / Industry */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          Domain / Industry
                        </label>
                        <select
                          value={columnMap.domain}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, domain: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None (Defaults to 'Technology') --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Employee Headcount */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          Employee Headcount
                        </label>
                        <select
                          value={columnMap.employee_count}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, employee_count: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None (Defaults to '100-500') --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Remarks / Status */}
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                          Remarks / Outreach Status
                        </label>
                        <select
                          value={columnMap.remarks}
                          onChange={(e) => setColumnMap((prev) => ({ ...prev, remarks: e.target.value }))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None (Defaults to 'Imported via Excel') --</option>
                          {activeHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Step 5: Live Data Preview Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-200">
                          Data Preview ({preparedLeads.length} valid rows found)
                        </span>
                        <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                          Showing first {Math.min(5, preparedLeads.length)} rows
                        </span>
                      </div>
                    </div>

                    <div className="border border-gray-800 rounded-xl overflow-x-auto bg-gray-950/70">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-gray-800/90 text-[10px] uppercase font-bold text-gray-400 border-b border-gray-700">
                          <tr>
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">HR Contact</th>
                            <th className="px-3 py-2">Phone</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2">SPOC</th>
                            <th className="px-3 py-2">Domain</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {preparedLeads.slice(0, 5).map((lead, i) => (
                            <tr key={i} className="hover:bg-gray-800/40">
                              <td className="px-3 py-2 font-bold text-white whitespace-nowrap">
                                {lead.company_name}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="text-gray-200 font-semibold">{lead.hr_name}</span>
                                {lead.title && (
                                  <span className="block text-[10px] text-gray-400">{lead.title}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {lead.phone ? (
                                  <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                                    {lead.phone}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 italic text-[10px]">No phone</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {lead.email ? (
                                  <span className="text-indigo-300 text-[11px] font-mono">
                                    {lead.email}
                                  </span>
                                ) : (
                                  <span className="text-gray-500 italic text-[10px]">No email</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {lead.spoc}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-[11px] text-gray-400">
                                {lead.domain || 'Technology'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="p-4 sm:p-5 border-t border-gray-800 bg-gray-900/90 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-400">
              {file && (
                <span>
                  Ready to import <strong className="text-emerald-400">{preparedLeads.length} leads</strong> into your worksheet.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!file || preparedLeads.length === 0 || isProcessing}
                onClick={handleExecuteImport}
                className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl transition shadow-lg ${
                  !file || preparedLeads.length === 0 || isProcessing
                    ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 cursor-pointer'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-white" />
                    <span>Importing Rows...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Import {preparedLeads.length} Leads to Worksheet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
