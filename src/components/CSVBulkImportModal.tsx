import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  Download,
  Loader2,
  FileCheck,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';

interface CSVBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  teamMembers: Array<{ name: string; role: string; avatarBg: string }>;
}

export const CSVBulkImportModal: React.FC<CSVBulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  teamMembers,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedUploader, setSelectedUploader] = useState<string>('Aravind Reddy');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    report: {
      total_rows: number;
      companies_created: number;
      companies_existing: number;
      roles_created: number;
      roles_duplicate_skipped: number;
      records: Array<{
        company_name: string;
        status: 'created' | 'existing';
        role_status: 'created' | 'duplicate_skipped' | 'none';
        role_title?: string;
        uploader: string;
      }>;
    };
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.endsWith('.csv')) {
        setErrorMessage('Please select a valid .csv file.');
        return;
      }
      setFile(selected);
      setErrorMessage(null);
      setUploadResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (!dropped.name.endsWith('.csv')) {
        setErrorMessage('Please select a valid .csv file.');
        return;
      }
      setFile(dropped);
      setErrorMessage(null);
      setUploadResult(null);
    }
  };

  const handleDownloadSampleCSV = () => {
    const sampleHeaders = 'company_name,role,headcount,industry,website,linkedin_url,opportunity_type,uploaded_by\n';
    const sampleRows = [
      'TechNova Solutions,Full Stack Developer,100-500 employees,Software & Cloud,https://technova.io,https://linkedin.com/company/technova-solutions,existing_post,Aravind Reddy',
      'CyberShield Labs,Cyber Security Analyst,50-200 employees,Cybersecurity,https://cybershield.in,https://linkedin.com/company/cybershield-labs,cold_outreach,Harish Reddy',
      'DataPulse Analytics,Data Analyst,500+ employees,Data Science,https://datapulse.com,https://linkedin.com/company/datapulse-analytics,existing_post,Charan',
      'CloudForge Systems,Cloud DevOps Engineer,50-200 employees,IT Services,https://cloudforge.io,https://linkedin.com/company/cloudforge,existing_post,Mansi',
    ].join('\n');

    const blob = new Blob([sampleHeaders + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'crm_bulk_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadSubmit = async () => {
    if (!file) {
      setErrorMessage('Please select or drop a CSV file to upload.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await api.uploadCSVCompanies({
        file,
        entered_by_name: selectedUploader,
      });

      setUploadResult(res);
      onImportComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Server error while parsing and uploading CSV.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setUploadResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Bulk CSV Company & Role Import
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Server-Side Duplicate Check
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Upload a spreadsheet to bulk-add companies with duplicate protection and CRA leaderboard attribution.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Instructions & Sample Download */}
          <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-200">
                Supported columns: <span className="text-emerald-400">company_name</span> (required),{' '}
                <span className="text-gray-300">role, headcount, industry, website, linkedin_url, uploaded_by</span>
              </p>
              <p className="text-[11px] text-gray-400">
                Duplicate Rule: If company exists, identical roles are skipped; new roles are added to the existing company.
              </p>
            </div>
            <button
              onClick={handleDownloadSampleCSV}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5 shrink-0 border border-gray-600"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Sample CSV</span>
            </button>
          </div>

          {!uploadResult ? (
            <>
              {/* Uploader Attribution Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Default Team Member Attribution (if column omitted in CSV):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {teamMembers.map((member) => (
                    <button
                      key={member.name}
                      type="button"
                      onClick={() => setSelectedUploader(member.name)}
                      className={`p-2 rounded-xl text-left border transition flex items-center gap-2 ${
                        selectedUploader === member.name
                          ? 'border-emerald-500 bg-emerald-500/10 text-white font-bold'
                          : 'border-gray-800 bg-gray-800/40 text-gray-400 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${member.avatarBg}`}>
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs truncate">{member.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
                  file
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-gray-700 hover:border-emerald-500/50 hover:bg-gray-800/40 bg-gray-850/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className={`p-4 rounded-full mb-3 ${file ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                  {file ? <FileCheck className="h-8 w-8" /> : <Upload className="h-8 w-8" />}
                </div>

                {file ? (
                  <div>
                    <p className="text-sm font-bold text-white">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB — Click or drop another to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-gray-200">
                      Click to browse or drop your CSV file here
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Comma-separated values (.csv) up to 15MB</p>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          ) : (
            /* Upload Results Summary */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>CSV Processing Complete</span>
                </div>
                <p className="text-xs text-emerald-200">{uploadResult.message}</p>
              </div>

              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-400 font-medium">New Companies</p>
                  <p className="text-xl font-extrabold text-emerald-400 mt-0.5">
                    {uploadResult.report.companies_created}
                  </p>
                </div>
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-400 font-medium">Existing Companies</p>
                  <p className="text-xl font-extrabold text-indigo-400 mt-0.5">
                    {uploadResult.report.companies_existing}
                  </p>
                </div>
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-400 font-medium">New Roles Added</p>
                  <p className="text-xl font-extrabold text-purple-400 mt-0.5">
                    {uploadResult.report.roles_created}
                  </p>
                </div>
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-gray-400 font-medium">Duplicates Skipped</p>
                  <p className="text-xl font-extrabold text-amber-400 mt-0.5">
                    {uploadResult.report.roles_duplicate_skipped}
                  </p>
                </div>
              </div>

              {/* Preview of Processed Records */}
              <div className="border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-800/60 px-4 py-2 text-xs font-semibold text-gray-300 border-b border-gray-800 flex justify-between">
                  <span>Processed Rows ({uploadResult.report.records.length})</span>
                  <span>Duplicate Status</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-800/60 text-xs">
                  {uploadResult.report.records.map((rec, idx) => (
                    <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-800/40">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-semibold text-white truncate">{rec.company_name}</span>
                          <span className="text-[10px] text-gray-400">by {rec.uploader}</span>
                        </div>
                        {rec.role_title && (
                          <p className="text-[11px] text-gray-400 ml-5 truncate">
                            Role: {rec.role_title}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'created'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          }`}
                        >
                          {rec.status === 'created' ? '+ Company' : 'Existing'}
                        </span>
                        {rec.role_status === 'duplicate_skipped' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Duplicate Role Skipped
                          </span>
                        )}
                        {rec.role_status === 'created' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            + Role Added
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between">
          {!uploadResult ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={!file || isUploading}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  !file || isUploading
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 cursor-pointer'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing & Checking Duplicates...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Start Bulk Import</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white rounded-xl hover:bg-gray-800 transition"
              >
                Upload Another File
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-900/30"
              >
                <span>Done</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
