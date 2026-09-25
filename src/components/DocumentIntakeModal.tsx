import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Linkedin,
  Phone,
  Mail,
  UserCheck,
  ArrowRight,
  ClipboardPaste,
} from 'lucide-react';
import { Company, HRContact } from '../types';
import { api } from '../services/api';

interface DocumentIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataStored: (company: Company, contacts: HRContact[]) => void;
  onViewCompany?: (company: Company) => void;
  currentUser?: { name: string };
}

export const DocumentIntakeModal: React.FC<DocumentIntakeModalProps> = ({
  isOpen,
  onClose,
  onDataStored,
  onViewCompany,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [enteredByName, setEnteredByName] = useState(currentUser?.name || 'Aravind Reddy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    company: Company;
    contacts: HRContact[];
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const detectNameFromFile = (f: File) => {
    if (currentUser?.name) return; // Preserve logged-in user's ownership
    const match = f.name.match(/\b(aravind|namitha|harish|pavithra|mansi|vineela|deepak|kavya|sandeep)\b/i);
    if (match) {
      const spocName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      setEnteredByName(`${spocName} Reddy`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      detectNameFromFile(f);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      detectNameFromFile(f);
      setError(null);
    }
  };

  const handleProcessAndStore = async () => {
    if (activeTab === 'upload' && !file) {
      setError('Please select or drop a PDF or document file to process.');
      return;
    }
    if (activeTab === 'paste' && !rawText.trim()) {
      setError('Please paste the company and HR data text.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessResult(null);

    try {
      const response = await api.parseDocumentHR({
        file: activeTab === 'upload' && file ? file : undefined,
        raw_text: activeTab === 'paste' ? rawText : undefined,
        entered_by_name: enteredByName.trim() || undefined,
      });

      if (response.success && (response.company || (response.contacts && response.contacts.length > 0))) {
        setSuccessResult({
          company: response.company,
          contacts: response.contacts || [],
          message: response.message,
        });
        onDataStored(response.company, response.contacts || []);
      } else {
        throw new Error(response.message || 'Could not parse document data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process and store document data');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setRawText('');
    setError(null);
    setSuccessResult(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-gray-900/90 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>PDF & Document Intake (Company & HR Numbers)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI Parser
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Upload your PDF or paste data to extract and store company details, headcount, LinkedIn page, and HR phone numbers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Sourced / Entered By Input (Crucial requirement: show who entered it!) */}
          <div className="bg-gray-800/80 border border-gray-700/70 rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-gray-200 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              <span>Who is entering this data? (Name Mentioned in PDF / CRA Name) *</span>
            </label>
            <input
              type="text"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="e.g. Aravind Reddy (or person mentioned in the PDF)"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-gray-400">
              This name will be saved and displayed on the company and each HR contact as <strong>"Entered by: [Name]"</strong>.
            </p>
          </div>

          {!successResult ? (
            <>
              {/* Tab Selector */}
              <div className="flex bg-gray-800/80 p-1 rounded-xl border border-gray-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                    activeTab === 'upload'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload PDF / Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 ${
                    activeTab === 'paste'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ClipboardPaste className="h-4 w-4" />
                  <span>Paste PDF Text / Data</span>
                </button>
              </div>

              {/* Tab 1: Upload PDF */}
              {activeTab === 'upload' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                    file
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.docx,.doc,image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="h-14 w-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-purple-400 shadow-inner">
                    {file ? (
                      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    ) : (
                      <UploadCloud className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    {file ? (
                      <>
                        <p className="text-sm font-bold text-emerald-300">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(file.size / 1024).toFixed(1)} KB • Ready for extraction
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-white">
                          Click to select or drag and drop your PDF, Excel, or Document
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Supports PDF, Excel (.xlsx, .xls, .csv), Word (.docx), and plain text
                        </p>
                      </>
                    )}
                  </div>
                  {file && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-xs text-rose-400 hover:underline mt-1"
                    >
                      Remove file
                    </button>
                  )}
                </div>
              ) : (
                /* Tab 2: Paste Raw Text */
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-300">
                    Paste content from your PDF or spreadsheet here:
                  </label>
                  <textarea
                    rows={7}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`e.g.
Company: Innovatech Solutions
Headcount: 500-1000 employees
LinkedIn: https://www.linkedin.com/company/innovatech
HR Lead: Priya Sharma
Phone: 9876543210
Email: priya.s@innovatech.com
Entered by: Aravind Reddy`}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-gray-500">
                    Our AI automatically identifies company name, headcount, LinkedIn URL, HR numbers, and entered by name.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProcessAndStore}
                  disabled={isProcessing || (activeTab === 'upload' && !file) || (activeTab === 'paste' && !rawText.trim())}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Extracting with Gemini & Storing Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Extract & Store in Company and HR Numbers</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Success State Preview */
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">Successfully Stored in Database!</h4>
                  <p className="text-xs text-gray-300 mt-0.5">{successResult.message}</p>
                </div>
              </div>

              {/* Stored Company Summary Card */}
              <div className="bg-gray-800/90 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-5 w-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">{successResult.company.name}</h3>
                      <p className="text-xs text-gray-400">{successResult.company.industry || 'Technology'}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[11px] rounded font-semibold border border-indigo-500/30">
                    Saved
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-700/60 text-xs">
                  <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-blue-400" />
                      People Working:
                    </span>
                    <p className="font-bold text-white mt-1">
                      {successResult.company.employee_count || '100-500 employees'}
                    </p>
                  </div>

                  <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Linkedin className="h-3.5 w-3.5 text-sky-400" />
                      LinkedIn Page:
                    </span>
                    <a
                      href={successResult.company.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sky-400 hover:underline truncate block mt-1"
                    >
                      {successResult.company.linkedin_url ? 'Visit LinkedIn' : 'Auto-generated'}
                    </a>
                  </div>

                  <div className="bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Entered By:
                    </span>
                    <p className="font-bold text-emerald-300 mt-1">
                      {successResult.company.entered_by_name || enteredByName}
                    </p>
                  </div>
                </div>

                {/* Stored HR Contacts list */}
                <div className="pt-2">
                  <h5 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-400" />
                    <span>HR Numbers & Contacts Saved ({successResult.contacts.length})</span>
                  </h5>
                  <div className="space-y-2">
                    {successResult.contacts.map((contact, idx) => (
                      <div
                        key={contact.id || idx}
                        className="bg-gray-900/90 border border-gray-800 p-2.5 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">{contact.name}</p>
                          <p className="text-[11px] text-gray-400">{contact.title || 'HR Lead'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.phone && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded font-mono font-bold text-xs flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.email && (
                            <span className="text-gray-400 text-[11px] flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons after save */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition"
                >
                  Import Another Document
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onViewCompany && successResult.company) {
                      onViewCompany(successResult.company);
                    }
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-900/30"
                >
                  <span>View Company Details</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!successResult && (
          <div className="p-4 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between text-xs text-gray-400">
            <span>Powered by Placemein Intelligent Document Parser</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
