import React, { useState, useRef } from 'react';
import {
  X,
  Code2,
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Phone,
  Mail,
  Linkedin,
  ArrowRight,
  ClipboardPaste,
  UploadCloud,
  Check,
  Trash2,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { Company, HRContact } from '../types';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';

interface ParsedLeadItem {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin_url: string;
  company_id: string;
  company_name: string;
  domain: string;
  location: string;
  selected: boolean;
  isValid: boolean;
  validationNote: string;
}

interface HTMLLeadsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsImported: (count: number) => void;
  availableCompanies: Company[];
  currentUser?: { name: string; role?: string };
}

export const HTMLLeadsImportModal: React.FC<HTMLLeadsImportModalProps> = ({
  isOpen,
  onClose,
  onLeadsImported,
  availableCompanies,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [htmlContent, setHtmlContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedDefaultCompanyId, setSelectedDefaultCompanyId] = useState<string>(
    availableCompanies[0]?.id || ''
  );
  const [spocName, setSpocName] = useState(currentUser?.name || 'Aravind Reddy');

  const [parsedLeads, setParsedLeads] = useState<ParsedLeadItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Clean and parse HTML to extract individual HR / Recruiter leads
  const parseHtmlIntoLeads = (html: string) => {
    if (!html.trim()) {
      setErrorMessage('Please paste or upload HTML content containing recruiter/HR leads.');
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);
    setSuccessCount(null);

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const extracted: ParsedLeadItem[] = [];
      const seenNames = new Set<string>();
      const existingContacts = clientFallbackStore.getContacts();

      // Find candidate blocks, tables, lists, or structured divs
      const candidateBlocks = Array.from(
        doc.querySelectorAll(
          'tr, li, .artdeco-entity-lockup, [data-chameleon-result], .search-result, .lead-row, .contact-card, .org-people-profile-card, div[class*="entity"], div[class*="result"]'
        )
      );

      // Helper regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const phoneRegex = /(?:\+91[\s-]?)?[6789]\d{9}|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\d{10}\b/;
      const linkedinRegex = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i;

      const fallbackCompany = availableCompanies.find((c) => c.id === selectedDefaultCompanyId) || availableCompanies[0];

      // Try block-level parsing first
      if (candidateBlocks.length > 0) {
        candidateBlocks.forEach((block, idx) => {
          const text = block.textContent?.trim() || '';
          if (text.length < 5) return;

          // Attempt name extraction
          let name = '';
          const nameEl = block.querySelector(
            'h1, h2, h3, h4, .artdeco-entity-lockup__title, span[class*="name"], [data-anonymize="person-name"], strong, a[href*="/in/"]'
          );
          if (nameEl) {
            name = nameEl.textContent?.trim() || '';
          }

          // If no specific nameEl, look for first line
          if (!name || name.length > 50) {
            const firstLine = text.split('\n')[0]?.trim();
            if (firstLine && firstLine.length <= 40 && !firstLine.includes('http') && !firstLine.includes('@')) {
              name = firstLine;
            }
          }

          // Clean name
          name = name.replace(/\s+/g, ' ').replace(/[•·|,].*$/, '').trim();

          // Title / designation
          let title = '';
          const titleEl = block.querySelector(
            '.artdeco-entity-lockup__subtitle, [data-anonymize="headline"], .title, .subline, span[class*="title"], p'
          );
          if (titleEl && titleEl !== nameEl) {
            title = titleEl.textContent?.trim() || '';
          }
          if (!title) {
            const match = text.match(/\b(HR|Talent Acquisition|Recruiter|Hiring Manager|Lead HR|People Ops|HRBP)\b[^\n,.]*/i);
            if (match) title = match[0].trim();
            else title = 'HR / Talent Acquisition';
          }

          // Email & Phone & LinkedIn
          const emailMatch = text.match(emailRegex) || (block.innerHTML.match(emailRegex));
          const email = emailMatch ? emailMatch[0] : '';

          const phoneMatch = text.match(phoneRegex);
          const phone = phoneMatch ? phoneMatch[0] : '';

          let linkedin = '';
          const linkEl = block.querySelector('a[href*="linkedin.com/in/"]');
          if (linkEl) {
            linkedin = linkEl.getAttribute('href') || '';
          } else {
            const liMatch = text.match(linkedinRegex) || block.innerHTML.match(linkedinRegex);
            if (liMatch) linkedin = liMatch[0];
          }

          if (name && name.length >= 2 && !seenNames.has(name.toLowerCase())) {
            seenNames.add(name.toLowerCase());
            const isDuplicate = existingContacts.some(
              (ec) => ec.name.toLowerCase() === name.toLowerCase() || (email && ec.email?.toLowerCase() === email.toLowerCase())
            );

            extracted.push({
              id: `html_lead_${Date.now()}_${idx}`,
              name,
              title: title.slice(0, 80),
              email,
              phone,
              linkedin_url: linkedin,
              company_id: fallbackCompany?.id || '',
              company_name: fallbackCompany?.name || 'Assigned Company',
              domain: 'Recruitment & Sourcing',
              location: 'India',
              selected: !isDuplicate,
              isValid: Boolean(name && name.length >= 2),
              validationNote: isDuplicate ? 'Already in CRM (Duplicate)' : (phone || email) ? 'Valid Lead' : 'Missing direct contact info',
            });
          }
        });
      }

      // If block parsing didn't find enough, try regex fallback on raw HTML
      if (extracted.length === 0) {
        const fullText = doc.body.textContent || '';
        const lines = fullText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);

        // Scan lines for potential names
        for (let i = 0; i < Math.min(lines.length, 60); i++) {
          const line = lines[i];
          if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(line)) {
            if (!seenNames.has(line.toLowerCase())) {
              seenNames.add(line.toLowerCase());
              extracted.push({
                id: `html_lead_${Date.now()}_${i}`,
                name: line,
                title: 'Talent Acquisition / HR',
                email: '',
                phone: '',
                linkedin_url: '',
                company_id: fallbackCompany?.id || '',
                company_name: fallbackCompany?.name || 'Assigned Company',
                domain: 'Recruitment & Sourcing',
                location: 'India',
                selected: true,
                isValid: true,
                validationNote: 'Extracted from text block',
              });
            }
          }
        }
      }

      if (extracted.length === 0) {
        setErrorMessage('No recruiter or lead records could be identified in the provided HTML. Please verify the HTML snippet has contact or profile markup.');
      } else {
        setParsedLeads(extracted);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to parse HTML: ${err.message || 'Unknown error'}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setHtmlContent(content);
          parseHtmlIntoLeads(content);
        }
      };
      reader.readAsText(f);
    }
  };

  const handleUpdateLead = (id: string, field: keyof ParsedLeadItem, value: any) => {
    setParsedLeads((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'company_id') {
          const comp = availableCompanies.find((c) => c.id === value);
          if (comp) updated.company_name = comp.name;
        }
        return updated;
      })
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setParsedLeads((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  // Submit leads STRICTLY to contacts/leads store (never writes to companies master table)
  const handleCommitLeads = async () => {
    const leadsToImport = parsedLeads.filter((l) => l.selected && l.name.trim().length >= 2);
    if (leadsToImport.length === 0) {
      setErrorMessage('Please select at least one lead with a valid name to import.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const timestamp = new Date().toISOString();
      const newContacts: HRContact[] = leadsToImport.map((item) => ({
        id: `cont_html_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: item.name.trim(),
        title: item.title.trim() || 'HR Recruiter',
        company_id: item.company_id || availableCompanies[0]?.id || 'comp_unassigned',
        email: item.email.trim() || undefined,
        phone: item.phone.trim() || undefined,
        linkedin_url: item.linkedin_url.trim() || undefined,
        domain: item.domain || 'Information Technology',
        location: item.location || 'India',
        remarks: 'Imported from HTML Lead Parser',
        source: 'import',
        spoc: spocName,
        entered_by_name: spocName,
        created_at: timestamp,
      }));

      // Commit to contacts database & client fallback
      const existing = clientFallbackStore.getContacts();
      clientFallbackStore.saveContacts([...newContacts, ...existing]);

      // If backend API supports bulk contact creation:
      try {
        await api.bulkCreateContacts(
          undefined,
          newContacts.map((c) => ({
            name: c.name,
            title: c.title,
            company_id: c.company_id,
            email: c.email,
            phone: c.phone,
            linkedin_url: c.linkedin_url,
            source: 'import',
            spoc: c.spoc,
            entered_by_name: c.entered_by_name,
            domain: c.domain,
            location: c.location,
            remarks: c.remarks,
          }))
        );
      } catch (e) {
        console.warn('Backend bulkCreateContacts notice:', e);
      }

      setSuccessCount(newContacts.length);
      onLeadsImported(newContacts.length);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(`Failed to commit leads to CRM: ${err.message || 'Error occurred'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 bg-gray-900/95 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">HTML Lead & Contact Importer</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Leads Only
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Target: Contacts CRM
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Extract individual recruiter & hiring leads from scraped or pasted HTML into your outreach pipeline.
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

        {/* Scope Safeguard Banner (Per Prompt Section 2) */}
        <div className="bg-purple-950/40 border-b border-purple-800/40 px-5 py-2.5 flex items-center gap-2 text-xs text-purple-200">
          <Info className="h-4 w-4 text-purple-400 shrink-0" />
          <span>
            <strong>Pipeline Separation Rule:</strong> This tool only writes to the <em>Leads & Contacts CRM</em> table. It does not alter or bulk-import the Master Company Directory.
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Controls: Assign to Company & Sourced By */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-800/60 p-4 rounded-xl border border-gray-700/60">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>Link Extracted Leads to Company (from Master Directory)</span>
              </label>
              <select
                value={selectedDefaultCompanyId}
                onChange={(e) => {
                  setSelectedDefaultCompanyId(e.target.value);
                  const c = availableCompanies.find((comp) => comp.id === e.target.value);
                  if (c) {
                    setParsedLeads((prev) =>
                      prev.map((item) => ({ ...item, company_id: c.id, company_name: c.name }))
                    );
                  }
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-purple-500"
              >
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.industry ? `(${c.industry})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>Sourced By / Assigned CRA SPOC *</span>
              </label>
              <input
                type="text"
                value={spocName}
                onChange={(e) => setSpocName(e.target.value)}
                placeholder="e.g. Aravind Reddy"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Input Method Tabs */}
          <div className="flex bg-gray-800/80 p-1 rounded-xl border border-gray-700">
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
              <span>Paste Scraped HTML</span>
            </button>
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
              <span>Upload HTML File (.html / .txt)</span>
            </button>
          </div>

          {activeTab === 'paste' ? (
            <div className="space-y-2">
              <textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={6}
                placeholder="Paste scraped HTML snippets here (e.g. LinkedIn People search results, Apollo HTML, job board candidate cards)..."
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-purple-500 resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => parseHtmlIntoLeads(htmlContent)}
                  disabled={isParsing || !htmlContent.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-900/30"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isParsing ? 'Parsing HTML...' : 'Extract Leads from HTML'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileCode className="h-8 w-8 text-purple-400" />
              <p className="text-xs font-semibold text-white">
                {file ? file.name : 'Select or drop an HTML file (.html, .htm, .txt)'}
              </p>
              <p className="text-[11px] text-gray-400">
                File will be parsed immediately for HR and recruiter lead profiles.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-950/50 border border-red-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Successfully added {successCount} lead(s) to the Contacts CRM directory!</span>
            </div>
          )}

          {/* Parsed Leads Preview Table */}
          {parsedLeads.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Extracted Leads ({parsedLeads.length})
                  </h3>
                  <span className="text-[11px] text-purple-400 font-medium">
                    ({parsedLeads.filter((l) => l.selected).length} selected)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">•</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-gray-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-800/90 text-gray-400 sticky top-0 border-b border-gray-700">
                    <tr>
                      <th className="p-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={parsedLeads.every((l) => l.selected)}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-0"
                        />
                      </th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Title / Role</th>
                      <th className="p-2.5">Contact Info (Phone / Email)</th>
                      <th className="p-2.5">Company Association</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 bg-gray-950/50">
                    {parsedLeads.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-800/30 transition ${item.selected ? '' : 'opacity-50'}`}
                      >
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => handleUpdateLead(item.id, 'selected', e.target.checked)}
                            className="rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-0"
                          />
                        </td>
                        <td className="p-2.5 font-medium text-white">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateLead(item.id, 'name', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-purple-500 focus:bg-gray-900 px-1 py-0.5 rounded text-xs text-white w-full"
                          />
                        </td>
                        <td className="p-2.5 text-gray-300">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateLead(item.id, 'title', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-purple-500 focus:bg-gray-900 px-1 py-0.5 rounded text-xs text-gray-300 w-full"
                          />
                        </td>
                        <td className="p-2.5 text-gray-400 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-emerald-400" />
                            <input
                              type="text"
                              value={item.phone}
                              placeholder="No phone"
                              onChange={(e) => handleUpdateLead(item.id, 'phone', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-purple-500 focus:bg-gray-900 px-1 py-0.5 rounded text-[11px] text-gray-300 w-28"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-blue-400" />
                            <input
                              type="text"
                              value={item.email}
                              placeholder="No email"
                              onChange={(e) => handleUpdateLead(item.id, 'email', e.target.value)}
                              className="bg-transparent border-b border-transparent hover:border-gray-700 focus:border-purple-500 focus:bg-gray-900 px-1 py-0.5 rounded text-[11px] text-gray-300 w-36"
                            />
                          </div>
                        </td>
                        <td className="p-2.5 text-gray-300">
                          <select
                            value={item.company_id}
                            onChange={(e) => handleUpdateLead(item.id, 'company_id', e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
                          >
                            {availableCompanies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.validationNote.includes('Duplicate')
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : item.validationNote.includes('Valid')
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {item.validationNote}
                          </span>
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
        <div className="p-4 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCommitLeads}
            disabled={isSubmitting || parsedLeads.filter((l) => l.selected).length === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>
              {isSubmitting
                ? 'Importing Leads to CRM...'
                : `Commit ${parsedLeads.filter((l) => l.selected).length} Lead(s) to Contacts CRM`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
