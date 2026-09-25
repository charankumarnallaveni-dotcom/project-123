import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  X,
  Building2,
  Sparkles,
} from 'lucide-react';
import { Company, HRContact } from '../types';
import { parseHRContactsCSV, generateSampleCSV, ParsedContactRow } from '../utils/csvParser';
import { api } from '../services/api';

interface BulkContactUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactsImported: (newContacts: HRContact[]) => void;
  availableCompanies: Company[];
  defaultCompany?: Company;
}

export const BulkContactUploadModal: React.FC<BulkContactUploadModalProps> = ({
  isOpen,
  onClose,
  onContactsImported,
  availableCompanies,
  defaultCompany,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedContactRow[]>([]);
  const [selectedDefaultCompanyId, setSelectedDefaultCompanyId] = useState<string>(
    defaultCompany?.id || availableCompanies[0]?.id || ''
  );
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'warnings'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const defaultCompObj = availableCompanies.find((c) => c.id === selectedDefaultCompanyId) || defaultCompany;

  // Process text or file content
  const handleProcessContent = (content: string, name?: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!content.trim()) {
      setParsedRows([]);
      setFileName(null);
      return;
    }

    try {
      const { contacts } = parseHRContactsCSV(
        content,
        defaultCompObj ? { id: defaultCompObj.id, name: defaultCompObj.name } : undefined
      );

      if (contacts.length === 0) {
        setErrorMessage('No valid contact rows could be extracted. Please check the file format or try our sample template.');
      } else {
        setParsedRows(contacts);
        if (name) setFileName(name);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to parse file: ${err.message || 'Unknown parsing error'}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessContent(content, file.name);
    };
    reader.onerror = () => {
      setErrorMessage('Could not read file. Please ensure it is a valid text/CSV file.');
    };
    reader.readAsText(file);

    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessContent(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const sample = generateSampleCSV();
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'placemein_hr_contacts_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpdateRow = (id: string, field: keyof ParsedContactRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        // Re-evaluate validity
        updated.isValid = Boolean(updated.name && updated.name.trim().length >= 2);
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddNewRow = () => {
    const newRow: ParsedContactRow = {
      id: `manual_${Date.now()}`,
      name: '',
      title: 'Talent Acquisition',
      company_name: defaultCompObj?.name || 'Company Name',
      company_id: defaultCompObj?.id,
      isValid: false,
      warnings: ['Please enter contact name'],
    };
    setParsedRows((prev) => [newRow, ...prev]);
  };

  const handleFinalSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.name && r.name.trim().length >= 2);
    if (validRows.length === 0) {
      setErrorMessage('No valid contacts to import. Each contact must have at least a Name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = validRows.map((r) => ({
        name: r.name.trim(),
        title: r.title?.trim() || 'Talent Acquisition',
        company_id: r.company_id || selectedDefaultCompanyId || undefined,
        company_name: r.company_name?.trim(),
        email: r.email?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        linkedin_url: r.linkedin_url?.trim() || undefined,
        source: 'import' as const,
      }));

      const res = await api.bulkCreateContacts(selectedDefaultCompanyId || undefined, payload);
      setSuccessMessage(`Successfully imported ${res.count} HR contacts!`);
      onContactsImported(res.created);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to bulk import contacts. Please check your data and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const warningsCount = parsedRows.filter((r) => r.warnings.length > 0).length;

  const filteredRows = parsedRows.filter((r) => {
    if (filterMode === 'valid') return r.isValid;
    if (filterMode === 'warnings') return r.warnings.length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-gray-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Bulk HR Contact Importer</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  CSV / TSV / Excel
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload or paste multi-column recruiter lists. Fields, delimiters, and headers are auto-detected.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-semibold transition"
              title="Download sample CSV template"
            >
              <Download className="h-3.5 w-3.5 text-purple-400" />
              <span>Download Sample CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Top Control Bar: Default Company Assignment & Input Method Toggle */}
        <div className="px-6 py-3 bg-gray-950/40 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-purple-400" />
              <span>Default Company for unassigned rows:</span>
            </span>
            <select
              value={selectedDefaultCompanyId}
              onChange={(e) => setSelectedDefaultCompanyId(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none"
            >
              {availableCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-500">
              (Rows with a company in the CSV will automatically map to that company)
            </span>
          </div>

          {/* Toggle between File Upload & Direct Paste */}
          <div className="flex items-center gap-1 bg-gray-800/80 p-1 rounded-lg border border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'file'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Paste Directly</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Input Method 1: File Drop Zone */}
          {activeTab === 'file' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
                isDragging
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 hover:border-purple-500/70 bg-gray-950/60'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-3 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="text-sm font-semibold text-white">
                {fileName ? (
                  <span className="text-purple-300">Selected file: {fileName}</span>
                ) : (
                  <span>Click to browse or drag and drop your contact file</span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Supports CSV, TSV (tab-separated from Google Sheets / Excel), or plain text files.
              </p>
            </div>
          )}

          {/* Input Method 2: Direct Text Paste */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Paste comma- or tab-delimited contacts copied from Excel or Sheets:</span>
                <span className="text-[11px] text-purple-400 font-mono">
                  Company, Name, Title, Email, Phone, LinkedIn
                </span>
              </div>
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  handleProcessContent(e.target.value);
                }}
                placeholder={`Palo Alto Networks, Radhika Sharma, Senior Recruiter, radhika@paloaltonetworks.com, 9876543210, https://linkedin.com/in/radhika\nOATI, Vikram Patel, Talent Lead, vikram@oati.com, 9876543211, https://linkedin.com/in/vikram`}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Parsed Results & Interactive Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-white">
                    Parsed Contacts ({parsedRows.length})
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                      {validCount} Ready to Import
                    </span>
                    {warningsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        {warningsCount} with Warnings
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`px-2 py-0.5 rounded ${
                        filterMode === 'all' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('valid')}
                      className={`px-2 py-0.5 rounded ${
                        filterMode === 'valid' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Valid ({validCount})
                    </button>
                    {warningsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode('warnings')}
                        className={`px-2 py-0.5 rounded ${
                          filterMode === 'warnings' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Warnings ({warningsCount})
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNewRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition border border-gray-700"
                  >
                    <Plus className="h-3.5 w-3.5 text-purple-400" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950 shadow-inner">
                <div className="overflow-x-auto max-h-[320px]">
                  <table className="w-full text-left text-xs text-gray-300 border-collapse">
                    <thead className="bg-gray-900/90 text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-800 sticky top-0 z-10 backdrop-blur-xs">
                      <tr>
                        <th className="p-2.5 font-semibold">Contact Name *</th>
                        <th className="p-2.5 font-semibold">Company</th>
                        <th className="p-2.5 font-semibold">Title / Role</th>
                        <th className="p-2.5 font-semibold">Email</th>
                        <th className="p-2.5 font-semibold">Phone</th>
                        <th className="p-2.5 font-semibold">LinkedIn URL</th>
                        <th className="p-2.5 font-semibold text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {filteredRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-900/40 transition">
                          {/* Name */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                              placeholder="Required Name"
                              className={`w-full bg-gray-900 border rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 ${
                                row.isValid
                                  ? 'border-gray-700 focus:ring-purple-400'
                                  : 'border-rose-500/70 focus:ring-rose-400 bg-rose-500/5'
                              }`}
                            />
                          </td>

                          {/* Company */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.company_name || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'company_name', e.target.value)}
                              placeholder="Company"
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                          </td>

                          {/* Title */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.title || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'title', e.target.value)}
                              placeholder="Title"
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                          </td>

                          {/* Email */}
                          <td className="p-2">
                            <input
                              type="email"
                              value={row.email || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'email', e.target.value)}
                              placeholder="name@company.com"
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                          </td>

                          {/* Phone */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.phone || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'phone', e.target.value)}
                              placeholder="+91 98765 43210"
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                          </td>

                          {/* LinkedIn */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.linkedin_url || ''}
                              onChange={(e) => handleUpdateRow(row.id, 'linkedin_url', e.target.value)}
                              placeholder="https://linkedin.com/in/..."
                              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                          </td>

                          {/* Delete */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {validCount} of {parsedRows.length} contacts eligible for import
            </span>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || validCount === 0}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-purple-900/30 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{isSubmitting ? 'Importing...' : `Import ${validCount} Contacts Now`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
