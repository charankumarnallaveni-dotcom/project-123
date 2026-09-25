import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';
import { Company, JD, HRContact } from '../types';
import { formatIndianDate, formatIndianPhone } from '../utils/formatters';
import { parseHRContactsCSV, generateSampleCSV, ParsedContactRow } from '../utils/csvParser';
import { BulkContactUploadModal } from '../components/BulkContactUploadModal';
import { CompanyDetailsModal } from '../components/CompanyDetailsModal';
import { DocumentIntakeModal } from '../components/DocumentIntakeModal';
import { HTMLLeadsImportModal } from '../components/HTMLLeadsImportModal';
import {
  Search,
  ExternalLink,
  Building2,
  ShieldCheck,
  AlertTriangle,
  UserPlus,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  X,
  UploadCloud,
  FileText,
  Sparkles,
  FileSpreadsheet,
  Plus,
  Mail,
  Phone,
  Globe,
  RotateCcw,
  Check,
  Layers,
  Briefcase,
  Copy,
  Download,
  Trash2,
  Clock,
  MapPin,
} from 'lucide-react';

interface HRSourcingPageProps {
  onNavigateToJDIntake?: () => void;
}

type SortField = 'date' | 'contacts' | 'company' | 'status';
type SortDirection = 'asc' | 'desc';

interface SourcingOpportunity {
  jd: JD;
  company: Company | undefined;
  contacts: HRContact[];
  contactsCount: number;
}

export const HRSourcingPage: React.FC<HRSourcingPageProps> = ({ onNavigateToJDIntake }) => {
  const [jds, setJds] = useState<JD[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'needs_review'>('all');
  const [contactFilter, setContactFilter] = useState<'all' | 'unassigned' | 'sourced'>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Expanded Row IDs
  const [expandedJdIds, setExpandedJdIds] = useState<Set<string>>(new Set());

  // Sourcing Panel (Modal) for a specific opportunity
  const [activeOpportunity, setActiveOpportunity] = useState<SourcingOpportunity | null>(null);
  const [sourcingModalInitialMode, setSourcingModalInitialMode] = useState<
    'google_search' | 'bulk' | 'quick_paste' | 'single_apollo'
  >('google_search');

  // Universal Bulk CSV Upload Modal state
  const [universalBulkOpen, setUniversalBulkOpen] = useState(false);

  // Toast / Notification banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Copied state for feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Company Details & Document Intake Modals
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyDetailsOpen, setIsCompanyDetailsOpen] = useState(false);
  const [isDocIntakeOpen, setIsDocIntakeOpen] = useState(false);
  const [isHTMLLeadsModalOpen, setIsHTMLLeadsModalOpen] = useState(false);

  // Load all data
  const fetchData = async () => {
    try {
      const [fetchedJds, fetchedCompanies, fetchedContacts] = await Promise.all([
        api.getJDs(),
        api.getCompanies(),
        api.getContacts(),
      ]);
      setJds(fetchedJds);
      setCompanies(fetchedCompanies);
      setContacts(fetchedContacts);
    } catch (err) {
      console.error('Failed to load HR Sourcing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map opportunities with their respective company and contacts
  const opportunities = useMemo<SourcingOpportunity[]>(() => {
    return jds.map((jd) => {
      const comp = companies.find((c) => c.id === jd.company_id) || jd.company;
      const companyContacts = contacts.filter((c) => c.company_id === jd.company_id);
      return {
        jd,
        company: comp,
        contacts: companyContacts,
        contactsCount: companyContacts.length,
      };
    });
  }, [jds, companies, contacts]);

  // Keep activeOpportunity in sync with latest contacts if updated
  useEffect(() => {
    if (activeOpportunity) {
      const latest = opportunities.find((opp) => opp.jd.id === activeOpportunity.jd.id);
      if (latest) {
        setActiveOpportunity(latest);
      }
    }
  }, [opportunities]);

  // Sorting and Filtering
  const filteredAndSortedOpportunities = useMemo(() => {
    let result = opportunities.filter((opp) => {
      const compName = opp.company?.name || '';
      const role = opp.jd.title || '';
      const rawText = opp.jd.raw_text || '';
      const industry = opp.company?.industry || '';

      // Search matching
      const matchesSearch =
        !searchQuery.trim() ||
        compName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rawText.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      const isAutoVerified = opp.jd.is_verified || opp.jd.verification_source === 'html_url_parser';
      if (statusFilter === 'verified' && !isAutoVerified) return false;
      if (statusFilter === 'needs_review' && isAutoVerified) return false;

      // Contact count filter
      if (contactFilter === 'unassigned' && opp.contactsCount > 0) return false;
      if (contactFilter === 'sourced' && opp.contactsCount === 0) return false;

      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        const dateA = new Date(a.jd.created_at || a.jd.date_found).getTime();
        const dateB = new Date(b.jd.created_at || b.jd.date_found).getTime();
        comparison = dateA - dateB;
      } else if (sortField === 'contacts') {
        comparison = a.contactsCount - b.contactsCount;
      } else if (sortField === 'company') {
        const nameA = (a.company?.name || '').toLowerCase();
        const nameB = (b.company?.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'status') {
        const statusA = a.jd.is_verified || a.jd.verification_source === 'html_url_parser' ? 1 : 0;
        const statusB = b.jd.is_verified || b.jd.verification_source === 'html_url_parser' ? 1 : 0;
        comparison = statusA - statusB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [opportunities, searchQuery, statusFilter, contactFilter, sortField, sortDirection]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleRowExpansion = (jdId: string) => {
    setExpandedJdIds((prev) => {
      const next = new Set(prev);
      if (next.has(jdId)) {
        next.delete(jdId);
      } else {
        next.add(jdId);
      }
      return next;
    });
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to generate LinkedIn recruiter search URL
  const getLinkedInRecruiterUrl = (companyName: string) => {
    const query = `(HR OR "Talent Acquisition" OR Recruiter OR "Human Resources" OR "Head of People") "${companyName}"`;
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  };

  // Stats calculation
  const totalOpps = opportunities.length;
  const verifiedCount = opportunities.filter((o) => o.jd.is_verified || o.jd.verification_source === 'html_url_parser').length;
  const needContactsCount = opportunities.filter((o) => o.contactsCount === 0).length;
  const totalContactsCount = contacts.length;

  return (
    <div className="space-y-6" id="hr-sourcing-container">
      {/* Top Header & Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">
            <Building2 className="h-4 w-4 text-purple-400" />
            <span>Outreach Execution Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            HR Sourcing & Worklist
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Verified corporate opportunities ready for recruiter identification and contact acquisition. Select a target company to source HRs or launch direct LinkedIn People Search.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Global Pipeline Counters */}
          <div className="flex flex-wrap items-center gap-2 bg-gray-900/90 border border-gray-800 p-1.5 rounded-xl shadow-inner">
            <div className="px-3 py-1.5 bg-gray-800/80 rounded-lg text-center">
              <div className="text-xs text-gray-400 font-medium">Opportunities</div>
              <div className="text-base font-bold text-white">{totalOpps}</div>
            </div>
            <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
              <div className="text-xs text-emerald-400 font-medium">Auto-Verified</div>
              <div className="text-base font-bold text-emerald-300">{verifiedCount}</div>
            </div>
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
              <div className="text-xs text-amber-400 font-medium">Need Contacts</div>
              <div className="text-base font-bold text-amber-300">{needContactsCount}</div>
            </div>
            <div className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
              <div className="text-xs text-purple-400 font-medium">Total HRs Sourced</div>
              <div className="text-base font-bold text-purple-300">{totalContactsCount}</div>
            </div>
          </div>

          {/* Action Buttons: HTML Lead Import, PDF Intake, Bulk CSV & Enter HR Contacts */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHTMLLeadsModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-purple-900/30 hover:scale-[1.02] active:scale-[0.98]"
              title="Extract candidate & HR recruiter leads from scraped/pasted HTML into Contacts CRM"
            >
              <Sparkles className="h-4 w-4" />
              <span>Import Leads (HTML)</span>
              <span className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] uppercase font-extrabold">Leads</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDocIntakeOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-bold transition shadow-md hover:scale-[1.02] active:scale-[0.98]"
              title="Import company details, headcount, and HR phone numbers from PDF or text"
            >
              <FileText className="h-4 w-4 text-purple-400" />
              <span>Import from PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setUniversalBulkOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-bold transition shadow-md hover:scale-[1.02] active:scale-[0.98]"
              title="Bulk import contacts across any companies via CSV, TSV, or spreadsheet paste"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Bulk Upload CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (opportunities.length > 0) {
                  setActiveOpportunity(opportunities[0]);
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-bold transition hover:scale-[1.02] active:scale-[0.98]"
              title="Open single contact entry & AI search enrichment modal"
            >
              <UserPlus className="h-4 w-4 text-purple-400" />
              <span>+ Add HR Contact</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies, job titles, technologies, or keywords..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800/80 border border-gray-700/80 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Verification Status Filter */}
            <div className="flex items-center bg-gray-800/80 border border-gray-700/80 rounded-lg p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  statusFilter === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('verified')}
                className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                  statusFilter === 'verified'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-emerald-400'
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Verified</span>
              </button>
              <button
                onClick={() => setStatusFilter('needs_review')}
                className={`px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 ${
                  statusFilter === 'needs_review'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-amber-400'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Review</span>
              </button>
            </div>

            {/* Contacts Filter */}
            <div className="flex items-center bg-gray-800/80 border border-gray-700/80 rounded-lg p-1 text-xs">
              <button
                onClick={() => setContactFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  contactFilter === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All Contacts
              </button>
              <button
                onClick={() => setContactFilter('unassigned')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  contactFilter === 'unassigned'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-amber-400'
                }`}
              >
                Needs Contacts (0)
              </button>
              <button
                onClick={() => setContactFilter('sourced')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  contactFilter === 'sourced'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-purple-400'
                }`}
              >
                Sourced (1+)
              </button>
            </div>

            {(searchQuery || statusFilter !== 'all' || contactFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setContactFilter('all');
                }}
                className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white flex items-center gap-1 border border-gray-700 rounded-lg hover:bg-gray-800 transition"
                title="Reset all filters"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Filter Summary Bar */}
        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-800/80 pt-2.5">
          <span>
            Showing <strong className="text-white">{filteredAndSortedOpportunities.length}</strong> of{' '}
            <strong className="text-white">{totalOpps}</strong> opportunities
          </span>
          <span className="hidden sm:inline-block text-gray-500">
            Tip: Click any row to view full job description & existing contact cards
          </span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          /* Loading Skeletons */
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-gray-800/60 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-2 w-full md:w-1/3">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700/60 rounded w-1/2"></div>
                </div>
                <div className="h-4 bg-gray-700/60 rounded w-1/4"></div>
                <div className="h-6 bg-gray-700/40 rounded-full w-24"></div>
                <div className="flex gap-2 w-full md:w-auto justify-end">
                  <div className="h-8 bg-gray-700 rounded-lg w-28"></div>
                  <div className="h-8 bg-gray-700 rounded-lg w-32"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedOpportunities.length === 0 ? (
          /* Empty States */
          <div className="p-12 text-center space-y-4">
            {totalOpps === 0 ? (
              <div className="max-w-md mx-auto space-y-4">
                <div className="inline-flex p-4 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Building2 className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-white">No Verified Opportunities Yet</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Every JD uploaded or parsed via JD Intake automatically appears here in your working list so you can begin sourcing HRs.
                </p>
                {onNavigateToJDIntake && (
                  <button
                    onClick={onNavigateToJDIntake}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition shadow-md"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Go to JD Intake to Add First JD</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-3">
                <div className="inline-flex p-3 rounded-full bg-gray-800 text-gray-400">
                  <Filter className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Opportunities Match Current Filters</h3>
                <p className="text-xs text-gray-400">
                  Try adjusting your search keywords or switching filter pills above to see more opportunities.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setContactFilter('all');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded-lg transition"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Table for Desktop & Tablet */
          <div>
            <div className="md:hidden px-3.5 py-2 bg-purple-950/40 border-b border-gray-800 flex items-center justify-between text-xs text-purple-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span>👉 Swipe sideways to view all columns</span>
              </span>
              <span className="text-[10px] text-purple-300/80 font-semibold px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700/50">
                Scrollable
              </span>
            </div>
            <div className="overflow-x-auto w-full touch-pan-x scrollbar-thin scrollbar-thumb-gray-700">
              <table className="w-full min-w-[760px] text-left text-sm text-gray-300 border-collapse">
              <thead className="bg-gray-950/80 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-800 select-none">
                <tr>
                  <th
                    className="px-4 py-3.5 cursor-pointer hover:text-white transition group"
                    onClick={() => toggleSort('company')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Company Name</span>
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'company' ? 'text-purple-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                    </div>
                  </th>
                  <th className="px-4 py-3.5">
                    <span>Job Title / Role</span>
                  </th>
                  <th
                    className="px-4 py-3.5 cursor-pointer hover:text-white transition group"
                    onClick={() => toggleSort('status')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Verification Status</span>
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'status' ? 'text-purple-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3.5 cursor-pointer hover:text-white transition group"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date Added</span>
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'date' ? 'text-purple-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3.5 cursor-pointer hover:text-white transition group"
                    onClick={() => toggleSort('contacts')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Contacts Found</span>
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === 'contacts' ? 'text-purple-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center">
                    <span>Find Recruiter</span>
                  </th>
                  <th className="px-4 py-3.5 text-right">
                    <span>Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredAndSortedOpportunities.map((opp) => {
                  const { jd, company, contactsCount, contacts: oppContacts } = opp;
                  const isExpanded = expandedJdIds.has(jd.id);
                  const isAutoVerified = jd.is_verified || jd.verification_source === 'html_url_parser';
                  const compName = company?.name || 'Company Not Specified';
                  const recruiterSearchUrl = getLinkedInRecruiterUrl(compName);

                  return (
                    <React.Fragment key={jd.id}>
                      {/* Main Table Row */}
                      <tr
                        onClick={() => toggleRowExpansion(jd.id)}
                        className={`group cursor-pointer transition-colors duration-150 ${
                          isExpanded ? 'bg-gray-800/60 border-l-2 border-l-purple-500' : 'hover:bg-gray-800/40'
                        }`}
                      >
                        {/* Column 1: Company Name */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(jd.id);
                              }}
                              className="text-gray-500 hover:text-gray-300 transition"
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-purple-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (company) {
                                      setSelectedCompany({
                                        ...company,
                                        contacts: oppContacts,
                                        jds: [jd],
                                      });
                                      setIsCompanyDetailsOpen(true);
                                    }
                                  }}
                                  className="font-bold text-white text-sm hover:text-purple-300 hover:underline transition text-left"
                                  title="Click to view company headcount, LinkedIn page, and HR details"
                                >
                                  {compName}
                                </button>
                                {company?.linkedin_url && (
                                  <a
                                    href={company.linkedin_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="View Company LinkedIn Page"
                                    className="text-sky-400 hover:text-sky-300 transition p-0.5"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                              {company?.industry && (
                                <span className="text-xs text-gray-400 block mt-0.5">
                                  {company.industry}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Job Title / Role */}
                        <td className="px-4 py-4">
                          <div className="font-semibold text-gray-100 text-sm max-w-xs truncate" title={jd.title}>
                            {jd.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 capitalize flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400/80"></span>
                            <span>{jd.opportunity_type?.replace(/_/g, ' ') || 'Opportunity'}</span>
                          </div>
                        </td>

                        {/* Column 3: Verification Status Badge */}
                        <td className="px-4 py-4">
                          {(() => {
                            const isPdfSource = jd.verification_source === 'pdf_upload' || jd.raw_text?.toLowerCase().includes('.pdf');
                            if (isAutoVerified) {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-xs">
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                  {isPdfSource ? 'Manager Approved' : 'Auto-Verified'}
                                </span>
                              );
                            }
                            if (isPdfSource) {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-xs" title="PDFs require manual manager/admin approval">
                                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                  PDF · Needs Approval
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-xs">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                Needs Review
                              </span>
                            );
                          })()}
                        </td>

                        {/* Column 4: Date Added */}
                        <td className="px-4 py-4 text-xs text-gray-400 whitespace-nowrap">
                          {formatIndianDate(jd.created_at || jd.date_found)}
                        </td>

                        {/* Column 5: Contacts Found */}
                        <td className="px-4 py-4">
                          {contactsCount === 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-amber-400/90 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              0 Contacts
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                              <Users className="h-3.5 w-3.5 text-purple-400" />
                              {contactsCount} {contactsCount === 1 ? 'Contact' : 'Contacts'}
                            </span>
                          )}
                        </td>

                        {/* Column 6: Google Search HR & Recruiter Finder */}
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSourcingModalInitialMode('google_search');
                                setActiveOpportunity(opp);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-semibold transition-all shadow-xs group/btn"
                              title={`Autofill HR details from Google Search for ${compName} (leaves phone empty for manual entry)`}
                            >
                              <Search className="h-3.5 w-3.5 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                              <span>Google Search HR</span>
                            </button>
                            <a
                              href={recruiterSearchUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-700/60 text-xs transition"
                              title={`Search recruiters at ${compName} on LinkedIn`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </td>

                        {/* Column 7: Action Button (Source Contacts) */}
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSourcingModalInitialMode('google_search');
                              setActiveOpportunity(opp);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition shadow-md shadow-purple-900/30 hover:scale-[1.02] active:scale-[0.98]"
                            title={`Source and upload HR contacts for ${compName}`}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>Source Contacts</span>
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Detail View */}
                      {isExpanded && (
                        <tr className="bg-gray-950/60 border-b border-gray-800">
                          <td colSpan={7} className="px-6 py-5">
                            <div className="space-y-4">
                              {/* Metadata Strip */}
                              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-gray-900/90 border border-gray-800 p-3 rounded-lg">
                                <div className="flex flex-wrap items-center gap-4">
                                  {company?.website && (
                                    <div className="flex items-center gap-1 text-gray-300">
                                      <Globe className="h-3.5 w-3.5 text-purple-400" />
                                      <a
                                        href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:underline text-purple-300"
                                      >
                                        {company.website.replace(/^https?:\/\//, '')}
                                      </a>
                                    </div>
                                  )}
                                  {company?.notes && (
                                    <div className="text-gray-400">
                                      <strong className="text-gray-300">Company Notes:</strong> {company.notes}
                                    </div>
                                  )}
                                  <div className="text-gray-400">
                                    <strong className="text-gray-300">Verification Source:</strong>{' '}
                                    <span className="capitalize">{jd.verification_source || 'manual'}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleCopyText(jd.raw_text || '', `jd-${jd.id}`)}
                                    className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex items-center gap-1 transition"
                                  >
                                    {copiedId === `jd-${jd.id}` ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-400" />
                                        <span className="text-emerald-400">Copied JD Text</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3" />
                                        <span>Copy JD Text</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* JD Text Preview */}
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-gray-400" />
                                  <span>Job Description Details</span>
                                </div>
                                <div className="bg-gray-900/90 border border-gray-800 rounded-lg p-3.5 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                  {jd.raw_text || 'No raw job description text stored for this record.'}
                                </div>
                              </div>

                              {/* Existing Contacts Section */}
                              <div className="space-y-2 pt-2 border-t border-gray-800/80">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5 text-purple-400" />
                                    <span>Existing Contacts Sourced for {compName} ({oppContacts.length})</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveOpportunity(opp)}
                                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Add More Contacts</span>
                                  </button>
                                </div>

                                {oppContacts.length === 0 ? (
                                  <div className="bg-gray-900/50 border border-gray-800/80 rounded-lg p-4 text-center">
                                    <p className="text-xs text-gray-400">
                                      No HR or talent acquisition contacts logged for <strong className="text-gray-300">{compName}</strong> yet.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setActiveOpportunity(opp)}
                                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition"
                                    >
                                      <UserPlus className="h-3.5 w-3.5" />
                                      <span>Source Contacts Now</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {oppContacts.map((contact) => (
                                      <div
                                        key={contact.id}
                                        className="bg-gray-900/90 border border-gray-800 rounded-lg p-3 space-y-2 hover:border-gray-700 transition"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="font-semibold text-white text-xs">{contact.name}</div>
                                            <div className="text-[11px] text-gray-400 truncate max-w-[180px]">
                                              {contact.title || 'Talent Acquisition'}
                                            </div>
                                          </div>
                                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                                            {contact.source}
                                          </span>
                                        </div>

                                        <div className="space-y-1 text-[11px] text-gray-300 border-t border-gray-800/80 pt-2">
                                          {contact.email && (
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-1.5 truncate">
                                                <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                                                <span className="truncate">{contact.email}</span>
                                              </div>
                                              <button
                                                onClick={() => handleCopyText(contact.email!, contact.id + '-email')}
                                                className="text-gray-400 hover:text-white p-0.5"
                                                title="Copy email"
                                              >
                                                {copiedId === contact.id + '-email' ? (
                                                  <Check className="h-3 w-3 text-emerald-400" />
                                                ) : (
                                                  <Copy className="h-3 w-3" />
                                                )}
                                              </button>
                                            </div>
                                          )}

                                          {contact.phone && (
                                            <div className="flex items-center justify-between gap-1.5 font-mono font-bold text-emerald-300">
                                              <div className="flex items-center gap-1.5">
                                                <Phone className="h-3 w-3 text-emerald-400 shrink-0" />
                                                <span>{formatIndianPhone(contact.phone)}</span>
                                              </div>
                                              <button
                                                onClick={() => handleCopyText(contact.phone!, contact.id + '-phone')}
                                                className="text-gray-400 hover:text-white p-0.5"
                                                title="Copy HR phone number"
                                              >
                                                {copiedId === contact.id + '-phone' ? (
                                                  <Check className="h-3 w-3 text-emerald-400" />
                                                ) : (
                                                  <Copy className="h-3 w-3" />
                                                )}
                                              </button>
                                            </div>
                                          )}

                                          {contact.linkedin_url && (
                                            <div className="pt-1">
                                              <a
                                                href={contact.linkedin_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                                              >
                                                <span>LinkedIn Profile</span>
                                                <ExternalLink className="h-2.5 w-2.5" />
                                              </a>
                                            </div>
                                          )}

                                          <div className="mt-1 pt-1 border-t border-gray-800/60 text-[10px] text-gray-500">
                                            Entered by: <span className="text-gray-300 font-medium">{contact.entered_by_name || (contact.creator ? contact.creator.name : 'Aravind Reddy')}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Sourcing Panel Slide-Over / Modal */}
      {activeOpportunity && (
        <SourcingModal
          opportunity={activeOpportunity}
          allOpportunities={opportunities}
          companies={companies}
          initialMode={sourcingModalInitialMode}
          onSelectOpportunity={setActiveOpportunity}
          onClose={() => setActiveOpportunity(null)}
          onContactsAdded={(newlyAdded) => {
            setContacts((prev) => [...newlyAdded, ...prev]);
            setNotification({
              type: 'success',
              message: `Successfully sourced ${newlyAdded.length} contact${newlyAdded.length === 1 ? '' : 's'} for ${activeOpportunity.company?.name || 'Company'}! Live count updated.`,
            });
            // Refresh in background
            fetchData();
          }}
        />
      )}

      {/* Universal Multi-Company Bulk Contact Upload Modal */}
      {universalBulkOpen && (
        <BulkContactUploadModal
          isOpen={universalBulkOpen}
          onClose={() => setUniversalBulkOpen(false)}
          availableCompanies={companies}
          onContactsImported={(newlyAdded) => {
            setContacts((prev) => [...newlyAdded, ...prev]);
            setNotification({
              type: 'success',
              message: `Successfully bulk imported ${newlyAdded.length} HR contact${newlyAdded.length === 1 ? '' : 's'} into the database!`,
            });
            fetchData();
          }}
        />
      )}

      {/* Company Details Modal */}
      <CompanyDetailsModal
        company={selectedCompany}
        isOpen={isCompanyDetailsOpen}
        currentUser={clientFallbackStore.getCurrentUser()}
        onClose={() => {
          setIsCompanyDetailsOpen(false);
          setSelectedCompany(null);
        }}
        onUpdateCompany={(updated) => {
          setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelectedCompany(updated);
        }}
        onContactAdded={(newContact) => {
          setContacts((prev) => [newContact, ...prev]);
          fetchData();
        }}
      />

      {/* Document Intake Modal */}
      <DocumentIntakeModal
        isOpen={isDocIntakeOpen}
        onClose={() => setIsDocIntakeOpen(false)}
        onDataStored={(newComp, newContacts) => {
          setCompanies((prev) => [newComp, ...prev.filter((c) => c.id !== newComp.id)]);
          setContacts((prev) => [...newContacts, ...prev]);
          setNotification({
            type: 'success',
            message: `Extracted and stored "${newComp.name}" with ${newContacts.length} HR contact(s). Entered by: ${newComp.entered_by_name}`,
          });
          fetchData();
        }}
        onViewCompany={(comp) => {
          setSelectedCompany({
            ...comp,
            contacts: contacts.filter((c) => c.company_id === comp.id),
          });
          setIsCompanyDetailsOpen(true);
        }}
      />

      {/* Dedicated HTML Leads Import Modal (Leads Only) */}
      <HTMLLeadsImportModal
        isOpen={isHTMLLeadsModalOpen}
        onClose={() => setIsHTMLLeadsModalOpen(false)}
        onLeadsImported={(count) => {
          fetchData();
          setNotification({
            type: 'success',
            message: `Successfully extracted and imported ${count} lead(s) into Contacts CRM!`,
          });
        }}
        availableCompanies={companies}
      />
    </div>
  );
};

/* =========================================================
   Sourcing Modal Component (Scoped to a specific Company)
========================================================= */

interface SourcingModalProps {
  opportunity: SourcingOpportunity;
  allOpportunities?: SourcingOpportunity[];
  companies?: Company[];
  initialMode?: 'google_search' | 'bulk' | 'quick_paste' | 'single_apollo';
  onSelectOpportunity?: (opp: SourcingOpportunity) => void;
  onClose: () => void;
  onContactsAdded: (contacts: HRContact[]) => void;
}

const SourcingModal: React.FC<SourcingModalProps> = ({
  opportunity,
  allOpportunities,
  companies = [],
  initialMode,
  onSelectOpportunity,
  onClose,
  onContactsAdded,
}) => {
  const { jd, company } = opportunity;

  // Resolve canonical company specifically using companies.find(c => c.id === jd.company_id)
  const resolvedCompany = useMemo(() => {
    return (companies || []).find((c) => c.id === jd.company_id) || company || jd.company;
  }, [companies, jd.company_id, company, jd.company]);

  const canonicalCompanyName = resolvedCompany?.name?.trim() || '';
  const companyName = canonicalCompanyName || 'Target Company';
  const companyId = resolvedCompany?.id || jd.company_id;

  const [mode, setMode] = useState<'google_search' | 'bulk' | 'quick_paste' | 'single_apollo'>(
    initialMode || 'google_search'
  );
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Google Search Grounding State
  const [googleSearchCompany, setGoogleSearchCompany] = useState(companyName);
  const [googleSearchRoleFocus, setGoogleSearchRoleFocus] = useState(
    jd.title ? `${jd.title} HR / Recruiter / Talent Acquisition` : 'Campus Relations, HR Recruiter, Talent Acquisition'
  );
  const [googleSearchContactName, setGoogleSearchContactName] = useState('');
  const [googleSearchRegion, setGoogleSearchRegion] = useState<'all' | 'Hyderabad' | 'Bengaluru' | 'Chennai' | 'Pune'>('all');
  const [isSearchingGoogle, setIsSearchingGoogle] = useState(false);
  const [googleSearchResults, setGoogleSearchResults] = useState<
    Array<{
      name: string;
      title: string;
      company_name: string;
      email: string;
      phone: string; // Strictly empty per user prompt
      linkedin_url: string;
      location?: string;
      summary?: string;
    }>
  >([]);
  const [googleWebSources, setGoogleWebSources] = useState<Array<{ title: string; url: string }>>([]);
  const [googleSearchQueries, setGoogleSearchQueries] = useState<string[]>([]);
  const [googleSearchDone, setGoogleSearchDone] = useState(false);
  const [googleSearchModel, setGoogleSearchModel] = useState<string>('');
  const [savingGoogleContactIdx, setSavingGoogleContactIdx] = useState<number | null>(null);
  const [phoneOverrides, setPhoneOverrides] = useState<Record<number, string>>({});
  const [searchingGoogleSingle, setSearchingGoogleSingle] = useState(false);
  const [googleCopiedId, setGoogleCopiedId] = useState<string | null>(null);

  // Re-sync Google Search inputs whenever the selected opportunity or companies list changes
  useEffect(() => {
    const targetComp = (companies || []).find((c) => c.id === opportunity.jd.company_id) || opportunity.company || opportunity.jd.company;
    const targetName = targetComp?.name?.trim() || '';
    setGoogleSearchCompany(targetName || 'Target Company');
    setGoogleSearchRoleFocus(
      opportunity.jd.title
        ? `${opportunity.jd.title} HR / Recruiter / Talent Acquisition`
        : 'Campus Relations, HR Recruiter, Talent Acquisition'
    );
    setGoogleSearchContactName('');
    // Clear old opportunity's results and state to prevent cross-company contamination
    setGoogleSearchResults([]);
    setGoogleWebSources([]);
    setGoogleSearchQueries([]);
    setGoogleSearchDone(false);
    setModalError(null);
    setModalSuccess(null);
  }, [opportunity.jd.id, opportunity.jd.company_id, opportunity.jd.title, companies]);

  // Bulk Upload State
  const [bulkText, setBulkText] = useState('');
  const [parsedBulkRows, setParsedBulkRows] = useState<ParsedContactRow[]>([]);
  const [isDraggingBulk, setIsDraggingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Paste State
  const [quickPasteText, setQuickPasteText] = useState('');
  const [parsedName, setParsedName] = useState('');
  const [parsedTitle, setParsedTitle] = useState('');
  const [parsedUrl, setParsedUrl] = useState('');
  const [parsedEmail, setParsedEmail] = useState('');
  const [parsedPhone, setParsedPhone] = useState('');

  // Single / Apollo State
  const [singleName, setSingleName] = useState('');
  const [singleTitle, setSingleTitle] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleLinkedin, setSingleLinkedin] = useState('');
  const [enrichingApollo, setEnrichingApollo] = useState(false);

  // Parse bulk text whenever bulkText changes
  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    if (!text.trim()) {
      setParsedBulkRows([]);
      return;
    }
    const { contacts } = parseHRContactsCSV(text, { id: companyId, name: companyName });
    setParsedBulkRows(contacts);
  };

  // Handle CSV/TSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleBulkTextChange(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingBulk(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleBulkTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const sample = generateSampleCSV();
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `placemein_${companyName.toLowerCase().replace(/\s+/g, '_')}_contacts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpdateBulkRow = (id: string, field: keyof ParsedContactRow, value: any) => {
    setParsedBulkRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        updated.isValid = Boolean(updated.name && updated.name.trim().length >= 2);
        return updated;
      })
    );
  };

  const handleDeleteBulkRow = (id: string) => {
    setParsedBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Submit Bulk Contacts
  const handleBulkSubmit = async () => {
    const validRows = parsedBulkRows.filter((r) => r.name && r.name.trim().length >= 2);
    if (validRows.length === 0) {
      setModalError('Please paste or upload at least one valid contact with a name.');
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = validRows.map((r) => ({
        name: r.name.trim(),
        title: r.title?.trim() || 'Talent Acquisition',
        company_id: companyId,
        company_name: r.company_name?.trim() || companyName,
        email: r.email?.trim() || undefined,
        phone: r.phone?.trim() || undefined,
        linkedin_url: r.linkedin_url?.trim() || undefined,
        source: 'import' as const,
      }));
      const res = await api.bulkCreateContacts(companyId, payload);
      onContactsAdded(res.created);
      onClose();
    } catch (err: any) {
      setModalError(err.message || 'Failed to bulk import contacts');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Paste Parsing
  const handleParseQuickPaste = () => {
    if (!quickPasteText.trim()) return;
    const lines = quickPasteText.split('\n').map((l) => l.trim()).filter(Boolean);
    let extractedName = '';
    let extractedTitle = '';
    let extractedUrl = '';
    let extractedEmail = '';
    let extractedPhone = '';

    for (const line of lines) {
      if (line.includes('linkedin.com/in/')) {
        const match = line.match(/https?:\/\/[^\s]+/);
        if (match) extractedUrl = match[0];
      } else if (!extractedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)) {
        extractedEmail = line;
      } else if (!extractedPhone && /^[+\d\s-]{8,15}$/.test(line)) {
        extractedPhone = line;
      } else if (!extractedName && line.length < 50 && !line.toLowerCase().includes('http')) {
        extractedName = line;
      } else if (
        !extractedTitle &&
        (line.toLowerCase().includes('recruiter') ||
          line.toLowerCase().includes('talent') ||
          line.toLowerCase().includes('hr') ||
          line.toLowerCase().includes('head of') ||
          line.toLowerCase().includes('manager'))
      ) {
        extractedTitle = line;
      }
    }

    if (extractedName) setParsedName(extractedName);
    if (extractedTitle) setParsedTitle(extractedTitle);
    if (extractedUrl) setParsedUrl(extractedUrl);
    if (extractedEmail) setParsedEmail(extractedEmail);
    if (extractedPhone) setParsedPhone(extractedPhone);
  };

  // Submit Quick Paste
  const handleQuickPasteSubmit = async () => {
    if (!parsedName.trim()) {
      setModalError('Contact name is required.');
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      const contact = await api.createContact({
        company_id: companyId,
        name: parsedName.trim(),
        title: parsedTitle.trim() || 'HR Recruiter',
        email: parsedEmail.trim() || undefined,
        phone: parsedPhone.trim() || undefined,
        linkedin_url: parsedUrl.trim() || undefined,
        source: 'linkedin',
      });
      onContactsAdded([contact]);
      onClose();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  // AI Auto-Enrich via Gemini Search Grounding
  const handleApolloEnrich = async () => {
    if (!singleName.trim()) {
      setModalError('Please enter the Contact Name before AI enrichment.');
      return;
    }
    setEnrichingApollo(true);
    setModalError(null);
    try {
      const enriched = await api.enrichApollo(singleName.trim(), companyName, companyId);
      if (enriched) {
        if (enriched.title) setSingleTitle(enriched.title);
        if (enriched.email) setSingleEmail(enriched.email);
        if (enriched.phone) setSinglePhone(enriched.phone);
        if (enriched.linkedin_url) setSingleLinkedin(enriched.linkedin_url);
      }
    } catch (err: any) {
      setModalError(err.message || 'AI enrichment failed');
    } finally {
      setEnrichingApollo(false);
    }
  };

  // Submit Single Contact
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) {
      setModalError('Contact name is required.');
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      const contact = await api.createContact({
        company_id: companyId,
        name: singleName.trim(),
        title: singleTitle.trim() || 'Talent Acquisition',
        email: singleEmail.trim() || undefined,
        phone: singlePhone.trim() || undefined,
        linkedin_url: singleLinkedin.trim() || undefined,
        source: 'manual',
      });
      onContactsAdded([contact]);
      onClose();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  const copyGoogleText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setGoogleCopiedId(id);
    setTimeout(() => setGoogleCopiedId(null), 2000);
  };

  const handleGoogleSearch = async () => {
    // Specifically resolve canonical company name using companies.find(c => c.id === jd.company_id)?.name lookup
    const canonicalFromLookup = (companies || []).find((c) => c.id === jd.company_id)?.name?.trim()
      || company?.name?.trim()
      || jd.company?.name?.trim();

    // Use typed value if user entered a custom company name other than 'Target Company',
    // otherwise strictly default to canonicalFromLookup
    const targetComp = (googleSearchCompany.trim() && googleSearchCompany.trim() !== 'Target Company')
      ? googleSearchCompany.trim()
      : (canonicalFromLookup || 'Target Company');

    if (!targetComp || targetComp === 'Target Company') {
      setModalError('Valid company name could not be resolved for this opportunity.');
      return;
    }
    setIsSearchingGoogle(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const res = await api.searchHRWithGoogle({
        company_name: targetComp,
        contact_name: googleSearchContactName.trim() || undefined,
        role_focus: googleSearchRoleFocus.trim() || undefined,
        company_id: (companies || []).find((c) => c.id === jd.company_id)?.id || companyId,
        region: googleSearchRegion,
      });

      if (res.contacts && res.contacts.length > 0) {
        // Enforce phone numbers are strictly empty per user mandate: "and only leave their phone number"
        const sanitized = res.contacts.map((c) => ({ ...c, phone: '' }));
        setGoogleSearchResults(sanitized);
        setGoogleWebSources(res.web_sources || []);
        setGoogleSearchQueries(res.search_queries || []);
        setGoogleSearchModel(res.model_used || '');
        setGoogleSearchDone(true);
        const regionDesc = googleSearchRegion === 'all'
          ? 'Hyderabad, Bengaluru, Chennai, and Pune'
          : googleSearchRegion;
        setModalSuccess(
          `Discovered ${sanitized.length} HR professionals in ${regionDesc} via live Google Search. Phone numbers are strictly left blank for manual recruiter entry.`
        );
      } else {
        setGoogleSearchResults([]);
        setGoogleSearchDone(true);
        const regionDesc = googleSearchRegion === 'all'
          ? 'Hyderabad, Bengaluru, Chennai, or Pune'
          : googleSearchRegion;
        setModalError(`No HR contacts found for ${targetComp} in ${regionDesc} via Google Search. Try switching the region filter or role focus.`);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to search HR details via Google Search');
    } finally {
      setIsSearchingGoogle(false);
    }
  };

  const handleAutofillAndSaveOne = async (idx: number, item: any) => {
    setSavingGoogleContactIdx(idx);
    setModalError(null);
    setModalSuccess(null);
    try {
      const manualPhone = phoneOverrides[idx]?.trim() || undefined;
      const created = await api.autofillContactFromGoogle({
        name: item.name,
        title: item.title,
        company_name: item.company_name || companyName,
        company_id: companyId,
        email: item.email || undefined,
        phone: manualPhone, // Left empty unless recruiter manually entered one into the card input
        linkedin_url: item.linkedin_url || undefined,
        location: item.location || 'Hyderabad',
      });

      onContactsAdded([created]);
      setModalSuccess(
        `Successfully saved ${item.name} (${item.location || 'Hyderabad'}) to ${companyName}! ${manualPhone ? `Phone: ${manualPhone}` : 'Phone number left empty for manual entry.'}`
      );
      setGoogleSearchResults((prev) => prev.filter((_, i) => i !== idx));
    } catch (err: any) {
      setModalError(err.message || 'Failed to save contact');
    } finally {
      setSavingGoogleContactIdx(null);
    }
  };

  const handleAutofillToSingle = (idx: number, item: any) => {
    setSingleName(item.name || '');
    setSingleTitle(item.title || '');
    setSingleEmail(item.email || '');
    setSingleLinkedin(item.linkedin_url || '');
    // Strictly left blank for manual entry per user mandate
    setSinglePhone(phoneOverrides[idx]?.trim() || '');
    setMode('single_apollo');
    setModalSuccess(
      `Autofilled ${item.name}'s details into the form. Phone number is left blank for your manual entry.`
    );
  };

  const handleSaveAllGoogleContacts = async () => {
    if (googleSearchResults.length === 0) return;
    setSubmitting(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const savedContacts: HRContact[] = [];
      for (let i = 0; i < googleSearchResults.length; i++) {
        const item = googleSearchResults[i];
        const manualPhone = phoneOverrides[i]?.trim() || undefined;
        const created = await api.autofillContactFromGoogle({
          name: item.name,
          title: item.title,
          company_name: item.company_name || companyName,
          company_id: companyId,
          email: item.email || undefined,
          phone: manualPhone, // Left empty unless manually entered
          linkedin_url: item.linkedin_url || undefined,
          location: item.location || 'Hyderabad',
        });
        savedContacts.push(created);
      }
      onContactsAdded(savedContacts);
      onClose();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save all contacts');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAutofillSingle = async () => {
    setSearchingGoogleSingle(true);
    setModalError(null);
    setModalSuccess(null);
    try {
      const res = await api.searchHRWithGoogle({
        company_name: companyName,
        contact_name: singleName.trim() || undefined,
        role_focus: singleTitle.trim() || undefined,
        company_id: companyId,
        region: googleSearchRegion,
      });

      if (res.contacts && res.contacts.length > 0) {
        const best = res.contacts[0];
        setSingleName(best.name);
        if (best.title) setSingleTitle(best.title);
        if (best.email) setSingleEmail(best.email);
        if (best.linkedin_url) setSingleLinkedin(best.linkedin_url);
        setSinglePhone(''); // Strictly empty per user prompt: "and only leave their phone number"
        setModalSuccess(
          `Autofilled HR details for ${best.name} via live Google Search. Phone number is left empty for your manual entry.`
        );
      } else {
        setModalError(`No HR contacts found via Google Search for ${companyName}`);
      }
    } catch (err: any) {
      setModalError(err.message || 'Google Search autofill failed');
    } finally {
      setSearchingGoogleSingle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">Source HR Contacts</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
              <span>Target Company:</span>
              {allOpportunities && allOpportunities.length > 1 ? (
                <select
                  value={opportunity.jd.id}
                  onChange={(e) => {
                    const found = allOpportunities.find((o) => o.jd.id === e.target.value);
                    if (found && onSelectOpportunity) onSelectOpportunity(found);
                  }}
                  className="bg-gray-800 border border-purple-500/40 text-purple-200 font-semibold rounded-md px-2 py-0.5 text-xs focus:ring-1 focus:ring-purple-400 focus:outline-none max-w-[280px] truncate"
                >
                  {allOpportunities.map((o) => (
                    <option key={o.jd.id} value={o.jd.id}>
                      {o.company?.name || 'Company'} — {o.jd.title}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <strong className="text-purple-300 font-semibold">{companyName}</strong>
                  <span>•</span>
                  <span className="text-gray-300">{jd.title}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Mode Selector */}
        <div className="px-5 pt-4 pb-2 border-b border-gray-800/80 bg-gray-900 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMode('google_search')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
              mode === 'google_search'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800'
            }`}
          >
            <Search className="h-3.5 w-3.5 text-emerald-300" />
            <span>Google Search HR</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-400/30">
              Autofill
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
              mode === 'bulk'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Bulk CSV / Paste</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('quick_paste')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
              mode === 'quick_paste'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>LinkedIn Quick-Paste</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('single_apollo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
              mode === 'single_apollo'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-800'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Single Contact & Enrich</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {modalError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {modalSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{modalSuccess}</span>
            </div>
          )}

          {/* Mode: Google Search HR & Autofill */}
          {mode === 'google_search' && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 via-gray-900 to-gray-900 border border-emerald-500/30 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5 border border-emerald-500/40">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-semibold text-emerald-200 text-xs flex items-center gap-1.5">
                        <span>Google Search Grounding Engine</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 font-mono font-medium">
                          Live Web
                        </span>
                      </span>
                      <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                        <span>Phone numbers left blank for manual entry</span>
                      </span>
                    </div>
                    <p className="text-gray-300 text-[11px] leading-relaxed">
                      Automatically queries live Google Search for HR leadership, recruiters, and talent acquisition teams for <strong>{companyName}</strong>. Details (Name, Role, Corporate Email, LinkedIn) are autofilled. Phone numbers are strictly left empty for manual recruiter entry.
                      <span className="block mt-1 text-emerald-300 font-semibold flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 inline text-emerald-400 shrink-0" />
                        <span>Regional Scope: Strictly restricted to <strong>Hyderabad, Bengaluru, Chennai, and Pune</strong> only.</span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Search Controls */}
              <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-300">Target Company</label>
                      {canonicalCompanyName && googleSearchCompany.trim() !== canonicalCompanyName && (
                        <button
                          type="button"
                          onClick={() => setGoogleSearchCompany(canonicalCompanyName)}
                          className="text-[10px] text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer"
                          title={`Reset to official company: ${canonicalCompanyName}`}
                        >
                          Reset: {canonicalCompanyName}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={googleSearchCompany}
                      onChange={(e) => setGoogleSearchCompany(e.target.value)}
                      placeholder="e.g. Swiggy, Google, TCS"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Role / Department Focus</label>
                    <input
                      type="text"
                      value={googleSearchRoleFocus}
                      onChange={(e) => setGoogleSearchRoleFocus(e.target.value)}
                      placeholder="e.g. Campus Relations, University Recruiter"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Target Name (Optional)</label>
                    <input
                      type="text"
                      value={googleSearchContactName}
                      onChange={(e) => setGoogleSearchContactName(e.target.value)}
                      placeholder="e.g. Leave empty to find key HR team"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Regional Filter Bar (Hyderabad, Bengaluru, Chennai, Pune only) */}
                <div className="pt-2 border-t border-gray-800/80 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Search Region:</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        Hyderabad • Bengaluru • Chennai • Pune Only
                      </span>
                    </div>

                    <div className="inline-flex items-center p-0.5 rounded-lg bg-gray-900 border border-gray-800 text-[11px] flex-wrap">
                      <button
                        type="button"
                        onClick={() => setGoogleSearchRegion('all')}
                        className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                          googleSearchRegion === 'all'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        All 4 Hubs
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoogleSearchRegion('Hyderabad')}
                        className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                          googleSearchRegion === 'Hyderabad'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Hyderabad
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoogleSearchRegion('Bengaluru')}
                        className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                          googleSearchRegion === 'Bengaluru'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Bengaluru
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoogleSearchRegion('Chennai')}
                        className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                          googleSearchRegion === 'Chennai'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Chennai
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoogleSearchRegion('Pune')}
                        className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
                          googleSearchRegion === 'Pune'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Pune
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-800/80">
                  <div className="text-[11px] text-gray-400">
                    {googleSearchQueries.length > 0 && (
                      <span className="truncate max-w-[320px] inline-block font-mono text-[10px] text-gray-400">
                        Query: {googleSearchQueries[0]}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSearch}
                    disabled={isSearchingGoogle || !googleSearchCompany.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md shadow-emerald-950/50"
                  >
                    {isSearchingGoogle ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 animate-spin text-emerald-200" />
                        <span>Searching Google Live...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-3.5 w-3.5" />
                        <span>Search Google for HR Details</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Searching Loader Card */}
              {isSearchingGoogle && (
                <div className="p-8 rounded-xl bg-gray-950/60 border border-emerald-500/20 text-center space-y-3">
                  <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-pulse">
                    <Search className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">Running Google Live Web Grounding...</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    Searching Google for recruiters and talent acquisition leads at{' '}
                    <strong className="text-emerald-300">{googleSearchCompany}</strong> in{' '}
                    <strong className="text-emerald-300">
                      {googleSearchRegion === 'all'
                        ? 'Hyderabad, Bengaluru, Chennai, and Pune'
                        : googleSearchRegion}
                    </strong>
                    . Automatically parsing names, titles, emails, and LinkedIn links...
                  </p>
                </div>
              )}

              {/* Search Results Display */}
              {!isSearchingGoogle && googleSearchResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        Discovered HR Contacts ({googleSearchResults.length})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                        Autofill Ready
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{googleSearchRegion === 'all' ? 'Hyd • Blr • Chn • Pune' : googleSearchRegion}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveAllGoogleContacts}
                      disabled={submitting}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Autofill & Save All ({googleSearchResults.length})</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {googleSearchResults.map((contact, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 hover:border-gray-700 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-300 font-bold text-sm flex items-center justify-center shrink-0">
                              {contact.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-sm flex items-center flex-wrap gap-2">
                                <span>{contact.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
                                  Google Search
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                    contact.location === 'Hyderabad'
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      : contact.location === 'Bengaluru'
                                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                      : contact.location === 'Chennai'
                                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span>{contact.location || 'Hyderabad'}</span>
                                </span>
                              </div>
                              <div className="text-xs text-purple-300 font-medium mt-0.5">
                                {contact.title}
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                                <span>{contact.company_name}</span>
                                {contact.location && (
                                  <>
                                    <span>•</span>
                                    <span className="text-gray-300 font-medium">{contact.location} Region</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAutofillToSingle(idx, contact)}
                              className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition border border-gray-700"
                              title="Transfer to single form to edit before saving"
                            >
                              Edit in Form
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutofillAndSaveOne(idx, contact)}
                              disabled={savingGoogleContactIdx === idx}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                              title="Autofill and save directly to company contacts"
                            >
                              {savingGoogleContactIdx === idx ? (
                                <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" />
                              )}
                              <span>1-Click Save</span>
                            </button>
                          </div>
                        </div>

                        {/* Contact Information Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-gray-800/80 text-xs">
                          {/* Email */}
                          <div className="flex items-center gap-2 bg-gray-900/60 px-2.5 py-1.5 rounded-lg border border-gray-800">
                            <Mail className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                            <span className="truncate text-gray-200 font-mono text-[11px] flex-1">
                              {contact.email || 'corporate email on request'}
                            </span>
                            {contact.email && (
                              <button
                                type="button"
                                onClick={() => copyGoogleText(contact.email, `gs-email-${idx}`)}
                                className="text-gray-400 hover:text-white"
                                title="Copy email"
                              >
                                {googleCopiedId === `gs-email-${idx}` ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* LinkedIn */}
                          <div className="flex items-center gap-2 bg-gray-900/60 px-2.5 py-1.5 rounded-lg border border-gray-800">
                            <Globe className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                            {contact.linkedin_url ? (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-sky-400 hover:underline text-[11px] flex-1 flex items-center gap-1"
                              >
                                <span className="truncate">LinkedIn Profile</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-gray-500 text-[11px]">No LinkedIn found</span>
                            )}
                          </div>

                          {/* Phone Number Input (Strictly Left Empty for Manual Entry) */}
                          <div className="flex items-center gap-2 bg-gray-900/60 px-2.5 py-1 rounded-lg border border-amber-500/40 sm:col-span-2 lg:col-span-1">
                            <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={phoneOverrides[idx] ?? ''}
                                onChange={(e) =>
                                  setPhoneOverrides((prev) => ({ ...prev, [idx]: e.target.value }))
                                }
                                placeholder="Phone: (Manual entry only)"
                                className="w-full bg-transparent text-[11px] text-white placeholder-gray-500 focus:outline-none"
                              />
                            </div>
                            <span
                              className="text-[9px] uppercase font-bold text-amber-300 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-700/50 shrink-0"
                              title="Phone numbers are left blank by Google Search and only filled manually"
                            >
                              Manual Only
                            </span>
                          </div>
                        </div>

                        {contact.summary && (
                          <div className="text-[11px] text-gray-400 italic bg-gray-900/30 px-2.5 py-1 rounded border border-gray-900">
                            {contact.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Web Grounding Citations */}
                  {googleWebSources.length > 0 && (
                    <div className="p-3 rounded-lg bg-gray-950 border border-gray-800/80 space-y-1.5">
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="h-3 w-3 text-sky-400" />
                        <span>Verified Google Search Web Citations</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {googleWebSources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 text-sky-300 text-[11px] border border-gray-800 hover:border-sky-500/40 transition truncate max-w-[280px]"
                          >
                            <span className="truncate">{src.title || src.url}</span>
                            <ExternalLink className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode 1: Bulk CSV / Paste */}
          {mode === 'bulk' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Bulk Upload or Paste Contacts for {companyName}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSample}
                    className="text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-md border border-gray-700 font-semibold flex items-center gap-1 transition"
                  >
                    <Download className="h-3 w-3 text-purple-400" />
                    <span>Sample CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-purple-300 hover:text-white bg-purple-900/40 hover:bg-purple-900/70 border border-purple-500/30 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span>Upload CSV / TSV</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              {/* Drag & Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingBulk(true);
                }}
                onDragLeave={() => setIsDraggingBulk(false)}
                onDrop={handleDropFile}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition flex items-center justify-center gap-3 ${
                  isDraggingBulk
                    ? 'border-purple-400 bg-purple-500/10'
                    : 'border-gray-800 hover:border-purple-500/50 bg-gray-950/40'
                }`}
              >
                <UploadCloud className="h-5 w-5 text-purple-400 shrink-0" />
                <div className="text-left text-xs">
                  <span className="font-semibold text-gray-200">Drag & drop CSV/TSV here</span>
                  <span className="text-gray-400 text-[11px] ml-1.5">or paste text directly into the box below</span>
                </div>
              </div>

              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => handleBulkTextChange(e.target.value)}
                placeholder={`Name, Title, Email, Phone, LinkedIn URL\nMonisha Kanduri, HR Manager, monisha@${companyName.toLowerCase().replace(/\s+/g, '')}.com, +91 98765 43210, https://linkedin.com/in/example\nSteven Lobu, Talent Lead, steven@company.com, +91 98765 43211, https://linkedin.com/in/steven`}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />

              {parsedBulkRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      Parsed Contacts ({parsedBulkRows.length} Rows, {parsedBulkRows.filter((r) => r.isValid).length} Ready)
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Editable rows — click any cell to adjust before importing
                    </span>
                  </div>

                  <div className="bg-gray-950 border border-gray-800 rounded-xl max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px] text-gray-300 border-collapse">
                      <thead className="bg-gray-900/90 uppercase tracking-wider text-gray-400 sticky top-0 border-b border-gray-800">
                        <tr>
                          <th className="p-2 font-semibold">Name *</th>
                          <th className="p-2 font-semibold">Title</th>
                          <th className="p-2 font-semibold">Email</th>
                          <th className="p-2 font-semibold">Phone</th>
                          <th className="p-2 font-semibold text-center w-8">Del</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 font-sans">
                        {parsedBulkRows.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-900/30">
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => handleUpdateBulkRow(row.id, 'name', e.target.value)}
                                className={`w-full bg-gray-900 border rounded px-1.5 py-0.5 text-xs text-white ${
                                  row.isValid ? 'border-gray-700' : 'border-rose-500/70 bg-rose-500/5'
                                }`}
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.title || ''}
                                onChange={(e) => handleUpdateBulkRow(row.id, 'title', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.email || ''}
                                onChange={(e) => handleUpdateBulkRow(row.id, 'email', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.phone || ''}
                                onChange={(e) => handleUpdateBulkRow(row.id, 'phone', e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteBulkRow(row.id)}
                                className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10"
                                title="Remove row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: LinkedIn Quick-Paste */}
          {mode === 'quick_paste' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Copy recruiter info directly from LinkedIn (profile text or search snippet) and paste it below. Our parser will extract the name, title, and profile link.
              </p>

              <textarea
                rows={4}
                value={quickPasteText}
                onChange={(e) => setQuickPasteText(e.target.value)}
                placeholder="Paste copied LinkedIn profile text here..."
                className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              <button
                type="button"
                onClick={handleParseQuickPaste}
                disabled={!quickPasteText.trim()}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold rounded-lg transition border border-gray-700 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                <span>Auto-Extract Fields</span>
              </button>

              {/* Extracted Fields Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Contact Name *</label>
                  <input
                    type="text"
                    value={parsedName}
                    onChange={(e) => setParsedName(e.target.value)}
                    placeholder="e.g. Radhika Sharma"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Title / Role</label>
                  <input
                    type="text"
                    value={parsedTitle}
                    onChange={(e) => setParsedTitle(e.target.value)}
                    placeholder="e.g. Senior Talent Acquisition Specialist"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">LinkedIn Profile URL</label>
                  <input
                    type="text"
                    value={parsedUrl}
                    onChange={(e) => setParsedUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={parsedEmail}
                    onChange={(e) => setParsedEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Single Contact & AI Enrich */}
          {mode === 'single_apollo' && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2 flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">Contact Name *</label>
                    <input
                      type="text"
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      placeholder="e.g. Varun Joshi"
                      required
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleGoogleAutofillSingle}
                      disabled={searchingGoogleSingle}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 h-[34px]"
                      title="Search Google for HR details at this company and autofill (phone number strictly left blank)"
                    >
                      {searchingGoogleSingle ? (
                        <RotateCcw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <Search className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                      <span>{searchingGoogleSingle ? 'Searching Google...' : 'Google Search Autofill'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApolloEnrich}
                      disabled={enrichingApollo || !singleName.trim()}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 h-[34px]"
                      title="Enrich with Gemini Search Grounding by Name & Target Company"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{enrichingApollo ? 'Enriching...' : 'AI Search Enrich'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Designation / Title</label>
                  <input
                    type="text"
                    value={singleTitle}
                    onChange={(e) => setSingleTitle(e.target.value)}
                    placeholder="e.g. Campus Relations Lead"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">Email</label>
                  <input
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-300 block">Phone Number</label>
                    <span className="text-[10px] text-amber-300 font-medium">Left empty for manual entry</span>
                  </div>
                  <input
                    type="text"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder="e.g. 9910571481 (Manual entry only)"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">LinkedIn URL</label>
                  <input
                    type="text"
                    value={singleLinkedin}
                    onChange={(e) => setSingleLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>

          {mode === 'google_search' && (
            <button
              type="button"
              onClick={handleSaveAllGoogleContacts}
              disabled={submitting || googleSearchResults.length === 0}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Saving Contacts...'
                  : `Autofill & Save All (${googleSearchResults.length}) to ${companyName}`}
              </span>
            </button>
          )}

          {mode === 'bulk' && (
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={submitting || parsedBulkRows.filter((r) => r.isValid).length === 0}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Importing...'
                  : `Import ${parsedBulkRows.filter((r) => r.isValid).length} Contacts to ${companyName}`}
              </span>
            </button>
          )}

          {mode === 'quick_paste' && (
            <button
              type="button"
              onClick={handleQuickPasteSubmit}
              disabled={submitting || !parsedName.trim()}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : `Save Contact to ${companyName}`}</span>
            </button>
          )}

          {mode === 'single_apollo' && (
            <button
              type="button"
              onClick={handleSingleSubmit}
              disabled={submitting || !singleName.trim()}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : `Save Contact to ${companyName}`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
