import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Users,
  Building2,
  FileText,
  Send,
  Calendar,
  Search,
  Download,
  Filter,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Phone,
  Mail,
  Linkedin,
  Clock,
  Sparkles,
  Plus,
  Edit2,
  Lock,
} from 'lucide-react';
import { Company, HRContact, JD, OutreachChannel, CRA } from '../types';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';
import { formatIndianDate, formatIndianPhone } from '../utils/formatters';
import { BulkCompanyImporter } from '../components/BulkCompanyImporter';
import { CompanyDetailsModal } from '../components/CompanyDetailsModal';

interface AdminFullDataPageProps {
  currentUser?: CRA | null;
}

export const AdminFullDataPage: React.FC<AdminFullDataPageProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'contacts' | 'companies' | 'jds' | 'outreach'>('contacts');
  const [loading, setLoading] = useState(true);

  // Raw datasets (superset)
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jds, setJds] = useState<JD[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<OutreachChannel[]>([]);
  const [users, setUsers] = useState<CRA[]>([]);

  // Modals
  const [showBulkCompanyImport, setShowBulkCompanyImport] = useState(false);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState<Company | null>(null);

  // Global search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpoc, setFilterSpoc] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [contList, compList, jdList, outList, uList] = await Promise.all([
        api.getContacts().catch(() => clientFallbackStore.getContacts()),
        api.getCompanies().catch(() => clientFallbackStore.getCompanies()),
        api.getJDs().catch(() => clientFallbackStore.getJDs()),
        api.getOutreachChannels().catch(() => clientFallbackStore.getOutreachChannels()),
        api.getAdminUsers().catch(() => clientFallbackStore.getUsers(true)),
      ]);
      setContacts(contList || []);
      setCompanies(compList || []);
      setJds(jdList || []);
      setOutreachLogs(outList || []);
      setUsers(uList || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.company?.name.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q);

      const matchSpoc =
        filterSpoc === 'all' ||
        c.spoc?.toLowerCase() === filterSpoc.toLowerCase() ||
        c.entered_by_name?.toLowerCase() === filterSpoc.toLowerCase();

      return matchSearch && matchSpoc;
    });
  }, [contacts, searchQuery, filterSpoc]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.website?.toLowerCase().includes(q) ||
        c.entered_by_name?.toLowerCase().includes(q);

      const matchIndustry = filterIndustry === 'all' || c.industry === filterIndustry;

      return matchSearch && matchIndustry;
    });
  }, [companies, searchQuery, filterIndustry]);

  // Filtered JDs
  const filteredJds = useMemo(() => {
    return jds.filter((j) => {
      const q = searchQuery.toLowerCase();
      return (
        !searchQuery ||
        j.title.toLowerCase().includes(q) ||
        j.company?.name.toLowerCase().includes(q) ||
        j.raw_text.toLowerCase().includes(q)
      );
    });
  }, [jds, searchQuery]);

  // Export functions
  const handleExportContacts = () => {
    const headers = 'Name,Title,Company,Email,Phone,LinkedIn,SPOC,Entered By,Domain,Location\n';
    const rows = filteredContacts
      .map((c) =>
        [
          `"${c.name}"`,
          `"${c.title || ''}"`,
          `"${c.company?.name || ''}"`,
          `"${c.email || ''}"`,
          `"${c.phone || ''}"`,
          `"${c.linkedin_url || ''}"`,
          `"${c.spoc || ''}"`,
          `"${c.entered_by_name || ''}"`,
          `"${c.domain || ''}"`,
          `"${c.location || ''}"`,
        ].join(',')
      )
      .join('\n');
    downloadCSV(headers + rows, 'placemein_master_all_contacts.csv');
  };

  const handleExportCompanies = () => {
    const headers = 'Company Name,Industry,Headcount,Website,Location,LinkedIn URL,Entered By,Created At\n';
    const rows = filteredCompanies
      .map((c) =>
        [
          `"${c.name}"`,
          `"${c.industry || ''}"`,
          `"${c.employee_count || ''}"`,
          `"${c.website || ''}"`,
          `"${c.location || ''}"`,
          `"${c.linkedin_url || ''}"`,
          `"${c.entered_by_name || ''}"`,
          `"${c.created_at || ''}"`,
        ].join(',')
      )
      .join('\n');
    downloadCSV(headers + rows, 'placemein_total_company_directory.csv');
  };

  const handleExportJDs = () => {
    const headers = 'JD Title,Company,Verification Status,Opportunity Type,Date Found,Created By\n';
    const rows = filteredJds
      .map((j) =>
        [
          `"${j.title}"`,
          `"${j.company?.name || ''}"`,
          j.is_verified ? 'Verified' : 'Pending',
          j.opportunity_type,
          j.date_found,
          `"${j.creator?.name || j.created_by || ''}"`,
        ].join(',')
      )
      .join('\n');
    downloadCSV(headers + rows, 'placemein_all_jds_opportunities.csv');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const allIndustries = Array.from(new Set(companies.map((c) => c.industry).filter(Boolean)));
  const allSpocs = Array.from(
    new Set(contacts.map((c) => c.spoc || c.entered_by_name).filter(Boolean))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in text-gray-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-gray-900 to-amber-950/30 p-6 rounded-3xl border border-amber-800/40 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Admin Full Data Visibility
            </span>
            <span className="text-xs text-amber-400/80 font-mono">Unrestricted Superset View</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Database className="h-7 w-7 text-amber-400" />
            <span>Master CRM Explorer</span>
          </h1>
          <p className="text-xs text-amber-200/70 mt-1 max-w-2xl">
            Complete, unfiltered visibility across all contacts, companies, campaigns, JDs, and team activities with export tools.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeTab === 'companies' && (
            <button
              onClick={() => setShowBulkCompanyImport(true)}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-900/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Bulk Import Companies</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeTab === 'contacts') handleExportContacts();
              else if (activeTab === 'companies') handleExportCompanies();
              else if (activeTab === 'jds') handleExportJDs();
            }}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4 text-amber-400" />
            <span>Export View to CSV</span>
          </button>
        </div>
      </div>

      {/* Dataset Tabs */}
      <div className="flex bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'contacts'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>All Master Contacts ({contacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'companies'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Total Company List ({companies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('jds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'jds'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>All JDs & Opportunities ({jds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('outreach')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'outreach'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Send className="h-4 w-4" />
          <span>All Outreach Activities ({outreachLogs.length})</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full sm:w-72 bg-gray-950 border border-gray-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {activeTab === 'contacts' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Filter className="h-3.5 w-3.5" />
              <span>SPOC:</span>
              <select
                value={filterSpoc}
                onChange={(e) => setFilterSpoc(e.target.value)}
                className="bg-gray-950 border border-gray-700 text-white rounded-lg px-2.5 py-1 text-xs"
              >
                <option value="all">All SPOCs</option>
                {allSpocs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Filter className="h-3.5 w-3.5" />
              <span>Industry:</span>
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="bg-gray-950 border border-gray-700 text-white rounded-lg px-2.5 py-1 text-xs"
              >
                <option value="all">All Industries</option>
                {allIndustries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <span className="text-xs text-gray-400 self-center">
          Showing {activeTab === 'contacts' ? filteredContacts.length : activeTab === 'companies' ? filteredCompanies.length : activeTab === 'jds' ? filteredJds.length : outreachLogs.length} record(s)
        </span>
      </div>

      {/* TAB 1: ALL CONTACTS */}
      {activeTab === 'contacts' && (
        <div className="border border-gray-800 rounded-2xl overflow-hidden bg-gray-900/60 shadow-xl">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-800/90 text-gray-300 font-bold uppercase tracking-wider text-[11px] sticky top-0 border-b border-gray-700">
                <tr>
                  <th className="p-3.5">Contact Name & Role</th>
                  <th className="p-3.5">Associated Company</th>
                  <th className="p-3.5">Direct Contact</th>
                  <th className="p-3.5">Assigned SPOC</th>
                  <th className="p-3.5">Sourced By</th>
                  <th className="p-3.5">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{contact.name}</div>
                      <div className="text-[11px] text-gray-400">{contact.title || 'HR Recruiter'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-indigo-300">
                        {contact.company?.name || 'Company'}
                      </span>
                    </td>
                    <td className="p-3.5 space-y-1">
                      {contact.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                          <Phone className="h-3 w-3 text-emerald-400" />
                          <span>{formatIndianPhone(contact.phone)}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-blue-300">
                          <Mail className="h-3 w-3 text-blue-400" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                        >
                          <Linkedin className="h-3 w-3" />
                          <span>Profile</span>
                        </a>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-300 font-medium">
                      {contact.spoc || 'Aravind Reddy'}
                    </td>
                    <td className="p-3.5 text-gray-400 text-[11px]">
                      {contact.entered_by_name || 'System'}
                    </td>
                    <td className="p-3.5 text-gray-400 text-[11px]">
                      {contact.created_at ? formatIndianDate(contact.created_at) : 'Recent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TOTAL COMPANY DIRECTORY */}
      {activeTab === 'companies' && (
        <div className="border border-gray-800 rounded-2xl overflow-hidden bg-gray-900/60 shadow-xl">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-800/90 text-gray-300 font-bold uppercase tracking-wider text-[11px] sticky top-0 border-b border-gray-700">
                <tr>
                  <th className="p-3.5">Company Name</th>
                  <th className="p-3.5">Industry</th>
                  <th className="p-3.5">Headcount</th>
                  <th className="p-3.5">Website</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Entered By</th>
                  <th className="p-3.5 text-center">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{company.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {company.id}</div>
                    </td>
                    <td className="p-3.5 text-gray-300">
                      {company.industry || 'Information Technology'}
                    </td>
                    <td className="p-3.5 text-gray-300 font-medium">
                      {company.employee_count || '100-500 employees'}
                    </td>
                    <td className="p-3.5 text-gray-400">
                      {company.website ? (
                        <a
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate max-w-[150px]">{company.website}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3.5 text-gray-300">
                      {company.location || 'Hyderabad'}
                    </td>
                    <td className="p-3.5 text-emerald-300 text-[11px] font-medium">
                      {company.entered_by_name || 'Admin'}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setSelectedCompanyForEdit(company)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                        title="Edit company profile (Admin Only)"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit Company</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL JDS & OPPORTUNITIES */}
      {activeTab === 'jds' && (
        <div className="border border-gray-800 rounded-2xl overflow-hidden bg-gray-900/60 shadow-xl">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-800/90 text-gray-300 font-bold uppercase tracking-wider text-[11px] sticky top-0 border-b border-gray-700">
                <tr>
                  <th className="p-3.5">Job Title</th>
                  <th className="p-3.5">Company</th>
                  <th className="p-3.5">Verification</th>
                  <th className="p-3.5">Opportunity Type</th>
                  <th className="p-3.5">Date Sourced</th>
                  <th className="p-3.5">Sourced By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredJds.map((jd) => (
                  <tr key={jd.id} className="hover:bg-gray-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{jd.title}</div>
                      <div className="text-[11px] text-gray-400 line-clamp-1">{jd.raw_text}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-indigo-300">
                      {jd.company?.name || 'Company'}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          jd.is_verified
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {jd.is_verified ? 'Verified JD' : 'Pending Verification'}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-300 capitalize">
                      {jd.opportunity_type?.replace('_', ' ')}
                    </td>
                    <td className="p-3.5 text-gray-400 text-[11px]">
                      {jd.date_found ? formatIndianDate(jd.date_found) : 'Recent'}
                    </td>
                    <td className="p-3.5 text-gray-300 font-medium">
                      {jd.creator?.name || 'CRA'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: OUTREACH ACTIVITIES */}
      {activeTab === 'outreach' && (
        <div className="border border-gray-800 rounded-2xl overflow-hidden bg-gray-900/60 shadow-xl">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-800/90 text-gray-300 font-bold uppercase tracking-wider text-[11px] sticky top-0 border-b border-gray-700">
                <tr>
                  <th className="p-3.5">Contact & Company</th>
                  <th className="p-3.5">Channel</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Notes / Call Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {outreachLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/30 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{log.contact?.name || 'Contact'}</div>
                      <div className="text-[11px] text-gray-400">{log.contact?.company?.name || 'Company'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {log.channel}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'replied'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : log.status === 'sent'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-400 text-[11px]">
                      {log.timestamp ? formatIndianDate(log.timestamp) : 'Recent'}
                    </td>
                    <td className="p-3.5 text-gray-300 text-[11px]">
                      {log.call_outcome || log.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Company Importer Modal */}
      <BulkCompanyImporter
        isOpen={showBulkCompanyImport}
        onClose={() => setShowBulkCompanyImport(false)}
        onImportComplete={() => {
          loadAllData();
        }}
        currentUser={currentUser}
      />

      {/* Admin Company Details & Edit Modal */}
      {selectedCompanyForEdit && (
        <CompanyDetailsModal
          company={selectedCompanyForEdit}
          isOpen={Boolean(selectedCompanyForEdit)}
          onClose={() => setSelectedCompanyForEdit(null)}
          onUpdateCompany={(updated) => {
            setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setSelectedCompanyForEdit(updated);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
