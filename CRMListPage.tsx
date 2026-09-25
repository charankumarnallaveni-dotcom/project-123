import { formatIndianPhone } from '../utils/formatters';
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Company, HRContact, JD, OutreachOutcome, OutcomeStatus, CRA } from '../types';
import {
  Building2,
  Mail,
  Phone,
  Linkedin,
  Search,
  Award,
  CheckCircle,
  X,
  FileText,
  Check,
  Plus,
  Users,
  ExternalLink,
  UserCheck,
  Copy,
  Sparkles,
  Filter,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import { CompanyDetailsModal } from '../components/CompanyDetailsModal';
import { DocumentIntakeModal } from '../components/DocumentIntakeModal';
import { CSVBulkImportModal } from '../components/CSVBulkImportModal';

interface OutcomeModalState {
  contact: HRContact;
  jdReceived: boolean;
  jdId: string;
  isEligible: boolean;
  notes: string;
  status: OutcomeStatus;
}

interface CRMListPageProps {
  onAddRole?: (companyName: string) => void;
}

interface TeamMemberMeta {
  name: string;
  role: string;
  id: string;
  avatarBg: string;
  badge: string;
}

const TEAM_MEMBERS: TeamMemberMeta[] = [
  { name: 'Harish Reddy', role: 'CRA Specialist', id: 'usr_cra_harish', avatarBg: 'bg-purple-600', badge: 'EMP' },
  { name: 'Aravind Reddy', role: 'CRA Specialist & Admin', id: 'usr_admin_aravind', avatarBg: 'bg-indigo-600', badge: 'EMP + ADMIN' },
  { name: 'Charan', role: 'CRA Specialist & Admin', id: 'usr_cra_charan', avatarBg: 'bg-teal-600', badge: 'EMP + ADMIN' },
  { name: 'Mrudula', role: 'CRA Specialist', id: 'usr_cra_mrudula', avatarBg: 'bg-pink-600', badge: 'EMP' },
  { name: 'Namitha', role: 'CRA Specialist', id: 'usr_cra_namitha', avatarBg: 'bg-emerald-600', badge: 'EMP' },
  { name: 'Soloman', role: 'CRA Specialist', id: 'usr_cra_soloman', avatarBg: 'bg-amber-600', badge: 'EMP' },
  { name: 'Vineela', role: 'Manager & Admin', id: 'usr_admin_vineela', avatarBg: 'bg-rose-600', badge: 'MANAGER' },
  { name: 'Mansi', role: 'Team Lead & Admin', id: 'usr_admin_mansi', avatarBg: 'bg-blue-600', badge: 'TEAM LEAD' },
];

export const CRMListPage: React.FC<CRMListPageProps> = ({ onAddRole }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [jds, setJds] = useState<JD[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, OutreachOutcome>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'companies' | 'contacts'>('companies');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [outcomeModal, setOutcomeModal] = useState<OutcomeModalState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Add Company Modal State
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [addCompName, setAddCompName] = useState('');
  const [addCompRole, setAddCompRole] = useState('');
  const [addCompRoleType, setAddCompRoleType] = useState<'existing_post' | 'cold_outreach'>('existing_post');
  const [addCompHeadcount, setAddCompHeadcount] = useState('100-500 employees');
  const [addCompLinkedin, setAddCompLinkedin] = useState('');
  const [addCompIndustry, setAddCompIndustry] = useState('Information Technology');
  const [addCompWebsite, setAddCompWebsite] = useState('');
  const [addCompUploadedBy, setAddCompUploadedBy] = useState('Aravind Reddy');
  const [addCompModalError, setAddCompModalError] = useState<string | null>(null);
  const [isAddingComp, setIsAddingComp] = useState(false);

  // Modals
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyDetailsOpen, setIsCompanyDetailsOpen] = useState(false);
  const [isDocumentIntakeOpen, setIsDocumentIntakeOpen] = useState(false);
  const [isCSVBulkImportOpen, setIsCSVBulkImportOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CRA | null>(null);

  const loadData = () => {
    Promise.all([api.getCompanies(), api.getContacts(), api.getJDs(), api.getCurrentCRA().catch(() => null)])
      .then(([compData, contactData, jdData, user]) => {
        setCompanies(compData);
        setContacts(contactData);
        setJds(jdData);
        if (user) setCurrentUser(user);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getMemberCompanyCount = (memberName: string): number => {
    const normMem = memberName.toLowerCase().split(' ')[0];
    return companies.filter((c) => {
      const entered = (c.entered_by_name || c.created_by || (c.creator ? c.creator.name : '')).toLowerCase();
      return entered.includes(normMem);
    }).length;
  };

  const handleOpenCompanyDetails = (comp: Company) => {
    const compContacts = contacts.filter((c) => c.company_id === comp.id);
    const compJds = jds.filter((j) => j.company_id === comp.id);
    setSelectedCompany({
      ...comp,
      contacts: compContacts,
      jds: compJds,
    });
    setIsCompanyDetailsOpen(true);
  };

  const handleCopyPhone = (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleOpenOutcomeModal = async (contact: HRContact) => {
    try {
      const current = outcomes[contact.id] || await api.getOutreachOutcome(contact.id);
      setOutcomeModal({
        contact,
        jdReceived: current.jd_received || false,
        jdId: current.jd_id || '',
        isEligible: current.is_eligible || false,
        notes: current.eligibility_notes || '',
        status: current.outcome_status || 'pending',
      });
    } catch (err) {
      setOutcomeModal({
        contact,
        jdReceived: false,
        jdId: '',
        isEligible: false,
        notes: '',
        status: 'pending',
      });
    }
  };

  const handleSaveOutcome = async () => {
    if (!outcomeModal) return;
    try {
      const updated = await api.updateOutreachOutcome(outcomeModal.contact.id, {
        jd_received: outcomeModal.jdReceived,
        jd_id: outcomeModal.jdId || undefined,
        is_eligible: outcomeModal.isEligible,
        eligibility_notes: outcomeModal.notes,
        outcome_status: outcomeModal.status,
      });
      setOutcomes((prev) => ({ ...prev, [outcomeModal.contact.id]: updated }));
      setOutcomeModal(null);
      setFeedback({ type: 'success', text: `Updated status for ${outcomeModal.contact.name}` });
      setTimeout(() => setFeedback(null), 3000);
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save outcome' });
    }
  };

  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

  // Add Company Form Handler: Strict Duplicate Role Enforcement
  const handleAddCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCompModalError(null);

    const cleanCompName = addCompName.trim();
    if (!cleanCompName) {
      setAddCompModalError('Please enter a Company Name.');
      return;
    }

    setIsAddingComp(true);
    const normCompName = norm(cleanCompName);

    try {
      // 1. Check if company already exists
      const existingComp = companies.find((c) => norm(c.name) === normCompName);

      if (existingComp) {
        // Company exists!
        if (addCompRole.trim()) {
          // Check role against existing JDs for this company
          const existingRolesForComp = jds.filter((j) => j.company_id === existingComp.id);
          const normNewRole = norm(addCompRole);
          const isSameRole = existingRolesForComp.some((j) => norm(j.title) === normNewRole);

          if (isSameRole) {
            // Rule: "if it is a same role leave it dont allow to store"
            setAddCompModalError(
              `⚠️ Duplicate Role Rejected: Company "${existingComp.name}" already has the role "${addCompRole.trim()}". Duplicate roles are not allowed to be stored.`
            );
            setIsAddingComp(false);
            return;
          }

          // Rule: "if it is a different role add it"
          const createdJD = await api.createJD({
            company_id: existingComp.id,
            title: addCompRole.trim(),
            opportunity_type: addCompRoleType,
            raw_text: `Opportunity for ${addCompRole.trim()} at ${existingComp.name}. Uploaded by ${addCompUploadedBy}.`,
            is_verified: true,
            verification_source: 'manual_entry',
          });

          // Also update company details if provided
          if (addCompHeadcount || addCompLinkedin || addCompIndustry || addCompWebsite) {
            await api.updateCompany(existingComp.id, {
              employee_count: addCompHeadcount.trim() || existingComp.employee_count,
              linkedin_url: addCompLinkedin.trim() || existingComp.linkedin_url,
              industry: addCompIndustry.trim() || existingComp.industry,
              website: addCompWebsite.trim() || existingComp.website,
            });
          }

          loadData();
          setIsAddCompanyOpen(false);
          setAddCompName('');
          setAddCompRole('');
          setFeedback({
            type: 'success',
            text: `✅ Company "${existingComp.name}" already existed. Successfully added new role "${createdJD.title}"!`,
          });
          setTimeout(() => setFeedback(null), 5000);
          return;
        } else {
          setAddCompModalError(
            `Company "${existingComp.name}" is already registered in CRM. To add an open position, enter a role title.`
          );
          setIsAddingComp(false);
          return;
        }
      }

      // 2. New Company: Create it under the selected team member
      const createdCompany = await api.createCompany({
        name: cleanCompName,
        employee_count: addCompHeadcount.trim() || '100-500 employees',
        linkedin_url: addCompLinkedin.trim() || `https://www.linkedin.com/company/${cleanCompName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        industry: addCompIndustry.trim() || 'Information Technology',
        website: addCompWebsite.trim() || undefined,
        entered_by_name: addCompUploadedBy,
        source: 'manual',
      });

      // If role was entered, add it under the new company
      if (addCompRole.trim()) {
        await api.createJD({
          company_id: createdCompany.id,
          title: addCompRole.trim(),
          opportunity_type: addCompRoleType,
          raw_text: `Opportunity for ${addCompRole.trim()} at ${cleanCompName}. Uploaded by ${addCompUploadedBy}.`,
          is_verified: true,
          verification_source: 'manual_entry',
        });
      }

      loadData();
      setIsAddCompanyOpen(false);
      setAddCompName('');
      setAddCompRole('');
      setFeedback({
        type: 'success',
        text: `✅ Successfully stored "${cleanCompName}" uploaded by ${addCompUploadedBy}${addCompRole.trim() ? ` with role "${addCompRole.trim()}"` : ''}!`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setAddCompModalError(err.message || 'Failed to process company upload.');
    } finally {
      setIsAddingComp(false);
    }
  };

  const getStatusBadge = (status: OutcomeStatus) => {
    switch (status) {
      case 'jd_received':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            JD Received
          </span>
        );
      case 'eligible_active':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Eligible & Active
          </span>
        );
      case 'not_eligible':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Not Eligible
          </span>
        );
      case 'community_joined':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Community Joined
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Pending Outreach
          </span>
        );
    }
  };

  // Filtered companies based on search and selected team member
  const filteredCompanies = companies.filter((comp) => {
    // Team member filter
    if (selectedMemberFilter !== 'all') {
      const normMem = selectedMemberFilter.toLowerCase().split(' ')[0];
      const entered = (comp.entered_by_name || comp.created_by || (comp.creator ? comp.creator.name : '')).toLowerCase();
      if (!entered.includes(normMem)) return false;
    }

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      comp.name.toLowerCase().includes(s) ||
      (comp.industry && comp.industry.toLowerCase().includes(s)) ||
      (comp.entered_by_name && comp.entered_by_name.toLowerCase().includes(s)) ||
      (comp.employee_count && comp.employee_count.toLowerCase().includes(s))
    );
  });

  const filteredContacts = contacts.filter((c) => {
    const comp = companies.find((co) => co.id === c.company_id) || c.company;
    // Team member filter
    if (selectedMemberFilter !== 'all') {
      const normMem = selectedMemberFilter.toLowerCase().split(' ')[0];
      const entered = (c.entered_by_name || comp?.entered_by_name || (c.creator ? c.creator.name : '')).toLowerCase();
      if (!entered.includes(normMem)) return false;
    }

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.phone && c.phone.includes(s)) ||
      (c.email && c.email.toLowerCase().includes(s)) ||
      (c.title && c.title.toLowerCase().includes(s)) ||
      (comp && comp.name.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CRA CRM Directory</h1>
          <p className="text-gray-400 text-sm">
            Audited employer network, company employee counts, LinkedIn profiles, and verified HR numbers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* + Add Company Button */}
          <button
            onClick={() => {
              setAddCompModalError(null);
              setIsAddCompanyOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-900/30 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Company</span>
          </button>

          {/* Bulk CSV Upload Button */}
          <button
            onClick={() => setIsCSVBulkImportOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/30 shrink-0 cursor-pointer"
            title="Upload CSV to bulk import companies & roles with server-side duplicate check"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Bulk CSV Import</span>
          </button>

          {/* PDF & Document Intake Button */}
          <button
            onClick={() => setIsDocumentIntakeOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-900/30 shrink-0 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Import from PDF</span>
            <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] uppercase font-bold">AI</span>
          </button>

          <div className="relative w-64">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies, HRs, numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'companies' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Companies ({companies.length})
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'contacts' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              HR Contacts ({contacts.length})
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-2 text-sm font-medium animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOTAL COMPANIES BY TEAM MEMBER LEADERBOARD (USER REQUIREMENT) */}
      {/* ========================================================================= */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Total Companies by Team Member</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
                  {companies.length} Total Registered
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Click any team member to filter companies uploaded by them. Duplicate roles for existing companies are automatically prevented.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMemberFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                selectedMemberFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>All ({companies.length})</span>
            </button>
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
          {TEAM_MEMBERS.map((member) => {
            const count = getMemberCompanyCount(member.name);
            const isSelected = selectedMemberFilter === member.name;

            return (
              <button
                key={member.id}
                onClick={() => setSelectedMemberFilter(isSelected ? 'all' : member.name)}
                className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer group ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                    : 'bg-gray-800/60 border-gray-700/60 hover:border-gray-600 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-lg ${member.avatarBg} text-white font-bold text-xs flex items-center justify-center shadow`}
                    >
                      {member.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                        {member.name}
                      </h4>
                      <span className="text-[10px] text-gray-400 line-clamp-1">{member.role}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      member.badge.includes('ADMIN')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : member.badge.includes('MANAGER')
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {member.badge}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-700/50 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">Companies Uploaded:</span>
                  <span
                    className={`text-sm font-extrabold ${
                      count > 0 ? 'text-emerald-400' : 'text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Filter Notice */}
        {selectedMemberFilter !== 'all' && (
          <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-indigo-300">
            <span className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-indigo-400" />
              <span>
                Filtered by uploader: <strong className="text-white">{selectedMemberFilter}</strong> ({filteredCompanies.length} companies found)
              </span>
            </span>
            <button
              onClick={() => setSelectedMemberFilter('all')}
              className="text-xs text-indigo-400 hover:text-white underline font-semibold cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* COMPANIES GRID VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400 px-1">
            <span>
              Showing <strong className="text-white">{filteredCompanies.length}</strong> of{' '}
              <strong className="text-white">{companies.length}</strong> companies
            </span>
            <span>Click any card to view headcount, LinkedIn page & verified roles</span>
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-12 text-center space-y-3">
              <Building2 className="h-10 w-10 text-gray-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No companies found</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                {selectedMemberFilter !== 'all'
                  ? `No companies currently recorded for ${selectedMemberFilter}. Click "+ Add Company" above to upload under this member.`
                  : 'No companies match your current search criteria. Try a different keyword or click "+ Add Company".'}
              </p>
              <button
                onClick={() => {
                  setSelectedMemberFilter('all');
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies.map((comp) => {
                const compContacts = contacts.filter((c) => c.company_id === comp.id);
                const compJds = jds.filter((j) => j.company_id === comp.id);
                const uploaderName = comp.entered_by_name || (comp.creator ? comp.creator.name : 'Aravind Reddy');

                return (
                  <div
                    key={comp.id}
                    onClick={() => handleOpenCompanyDetails(comp)}
                    className="bg-gray-800/90 border border-gray-700/80 hover:border-indigo-500/70 hover:bg-gray-800 rounded-xl p-5 transition shadow-sm flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition">
                            {comp.name}
                          </h3>
                          <p className="text-xs text-indigo-400 capitalize">{comp.industry || 'Information Technology'}</p>
                        </div>
                        <div className="h-9 w-9 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:border-indigo-500/40 transition">
                          <Building2 className="h-5 w-5" />
                        </div>
                      </div>

                      {/* Highlights Grid */}
                      <div className="mt-4 space-y-2">
                        {/* People Working */}
                        <div className="flex items-center justify-between text-xs bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-blue-400" />
                            <span>People Working:</span>
                          </span>
                          <span className="font-bold text-white">
                            {comp.employee_count || '100-500 employees'}
                          </span>
                        </div>

                        {/* LinkedIn Page */}
                        <div className="flex items-center justify-between text-xs bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <Linkedin className="h-3.5 w-3.5 text-sky-400" />
                            <span>LinkedIn Page:</span>
                          </span>
                          <a
                            href={comp.linkedin_url || `https://www.linkedin.com/company/${comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 truncate max-w-[140px]"
                          >
                            <span>Open Page</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>

                        {/* Open Roles Count */}
                        <div className="flex items-center justify-between text-xs bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
                            <span>Linked Roles:</span>
                          </span>
                          <span className="font-bold text-indigo-300">
                            {compJds.length} Role{compJds.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {/* HR Contact Count */}
                        <div className="flex items-center justify-between text-xs bg-gray-900/60 p-2 rounded-lg border border-gray-800">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-emerald-400" />
                            <span>HR Contacts:</span>
                          </span>
                          <span className="font-bold text-emerald-300">
                            {compContacts.length} Number{compContacts.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-700/50 text-xs text-gray-400 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-emerald-400" />
                        <span>
                          Uploaded by: <strong className="text-gray-200">{uploaderName}</strong>
                        </span>
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenCompanyDetails(comp)}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-semibold transition"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => onAddRole?.(comp.name)}
                          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1"
                          title="Add Job Opportunity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Role</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* HR CONTACTS TABLE VIEW */}
      {/* ========================================================================= */}
      {activeTab === 'contacts' && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-gray-600">
            <table className="w-full min-w-[760px] text-left text-sm text-gray-300">
              <thead className="bg-gray-900/60 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700">
                <tr>
                  <th className="px-6 py-4">Name & Title</th>
                  <th className="px-6 py-4">Target Company</th>
                  <th className="px-6 py-4">HR Numbers & Details</th>
                  <th className="px-6 py-4">Uploaded By</th>
                  <th className="px-6 py-4">Outcome Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No HR Contacts found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((c) => {
                    const out = outcomes[c.id];
                    const comp = companies.find((co) => co.id === c.company_id) || c.company;
                    return (
                      <tr key={c.id} className="hover:bg-gray-700/30 transition">
                        <td className="px-6 py-4">
                          <p className="font-bold text-white">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.title || 'HR Lead'}</p>
                          {c.linkedin_url && (
                            <a
                              href={c.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] inline-flex items-center gap-1 text-sky-400 hover:underline mt-1"
                            >
                              <Linkedin className="h-3 w-3" />
                              <span>HR LinkedIn</span>
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {comp ? (
                            <button
                              onClick={() => handleOpenCompanyDetails(comp)}
                              className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline text-left flex items-center gap-1.5 group"
                            >
                              <Building2 className="h-4 w-4 text-gray-500 group-hover:text-indigo-400" />
                              <span>{comp.name}</span>
                            </button>
                          ) : (
                            <span className="text-gray-400 italic">Target Account</span>
                          )}
                          {comp?.employee_count && (
                            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                              <Users className="h-3 w-3 text-blue-400" />
                              <span>{comp.employee_count}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          {c.phone ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5 text-emerald-400" />
                                {formatIndianPhone(c.phone)}
                              </span>
                              <button
                                onClick={(e) => handleCopyPhone(c.phone!, e)}
                                className="p-1 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-[10px] transition"
                                title="Copy HR phone number"
                              >
                                {copiedPhone === c.phone ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 italic">No phone listed</span>
                          )}
                          {c.email && (
                            <p className="text-xs flex items-center gap-1 text-gray-300">
                              <Mail className="h-3 w-3 text-gray-400" /> {c.email}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <UserCheck className="h-3 w-3" />
                            <span>{c.entered_by_name || comp?.entered_by_name || (c.creator ? c.creator.name : 'Aravind Reddy')}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(out ? out.outcome_status : 'pending')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenOutcomeModal(c)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-medium transition inline-flex items-center gap-1"
                          >
                            <Award className="h-3.5 w-3.5" />
                            <span>Evaluate</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / UPLOAD COMPANY MODAL WITH STRICT DUPLICATE ROLE CHECK */}
      {/* ========================================================================= */}
      {isAddCompanyOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
          onClick={() => setIsAddCompanyOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-800 bg-gray-900/90 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upload / Add Company to CRM</h3>
                  <p className="text-xs text-gray-400">
                    If company exists: different roles will be added; duplicate roles are rejected.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCompanyOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddCompanySubmit} className="p-6 space-y-4">
              {addCompModalError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{addCompModalError}</div>
                </div>
              )}

              {/* Uploaded By (Team Member Selector) */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Uploaded By (Team Member) *
                </label>
                <select
                  value={addCompUploadedBy}
                  onChange={(e) => setAddCompUploadedBy(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {TEAM_MEMBERS.map((m) => (
                    <option key={m.id} value={m.name}>
                      👤 {m.name} ({m.role})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  This company will be attributed to this team member in their total company count.
                </p>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Swiggy, Razorpay, CyberHeals"
                  value={addCompName}
                  onChange={(e) => setAddCompName(e.target.value)}
                  required
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Open Role / Position & Type */}
              <div className="p-3.5 bg-gray-950/60 border border-indigo-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Role / Job Opportunity (Optional)
                  </span>
                  <span className="text-[10px] text-gray-400">Strict Duplicate Check</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Job Title / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Application Security Engineer"
                      value={addCompRole}
                      onChange={(e) => setAddCompRole(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Opportunity Type</label>
                    <select
                      value={addCompRoleType}
                      onChange={(e: any) => setAddCompRoleType(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="existing_post">Existing Job Post</option>
                      <option value="cold_outreach">Cold Outreach Requirement</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  Rule: If the company exists and the role is different, it will be added. If it is the same role, duplicate storage is prevented.
                </p>
              </div>

              {/* Headcount & Industry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    People Working (Headcount)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 500-1000 employees"
                    value={addCompHeadcount}
                    onChange={(e) => setAddCompHeadcount(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Industry</label>
                  <input
                    type="text"
                    placeholder="e.g. Cyber Security, FinTech"
                    value={addCompIndustry}
                    onChange={(e) => setAddCompIndustry(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* LinkedIn & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    LinkedIn Company URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://linkedin.com/company/..."
                    value={addCompLinkedin}
                    onChange={(e) => setAddCompLinkedin(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Website</label>
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={addCompWebsite}
                    onChange={(e) => setAddCompWebsite(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddCompanyOpen(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingComp}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-900/30 transition disabled:opacity-50"
                >
                  {isAddingComp ? 'Checking & Saving...' : 'Save Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Outcome Modal */}
      {outcomeModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setOutcomeModal(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-bold text-white text-base">Outreach Outcome: {outcomeModal.contact.name}</h3>
              <button onClick={() => setOutcomeModal(null)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Status</label>
                <select
                  value={outcomeModal.status}
                  onChange={(e: any) => setOutcomeModal({ ...outcomeModal, status: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                >
                  <option value="pending">Pending Outreach</option>
                  <option value="jd_received">JD Received</option>
                  <option value="eligible_active">Eligible & Active</option>
                  <option value="not_eligible">Not Eligible</option>
                  <option value="community_joined">Community Joined</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="jdReceived"
                  checked={outcomeModal.jdReceived}
                  onChange={(e) => setOutcomeModal({ ...outcomeModal, jdReceived: e.target.checked })}
                  className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="jdReceived" className="text-gray-300 font-medium cursor-pointer">
                  JD Received from HR
                </label>
              </div>

              {outcomeModal.jdReceived && (
                <div className="flex items-center gap-2 pl-6">
                  <input
                    type="checkbox"
                    id="isEligible"
                    checked={outcomeModal.isEligible}
                    onChange={(e) => setOutcomeModal({ ...outcomeModal, isEligible: e.target.checked })}
                    className="rounded bg-gray-800 border-gray-700 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="isEligible" className="text-gray-300 font-medium cursor-pointer">
                    Eligible for Placement Drives
                  </label>
                </div>
              )}

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Conversation Notes</label>
                <textarea
                  rows={3}
                  value={outcomeModal.notes}
                  onChange={(e) => setOutcomeModal({ ...outcomeModal, notes: e.target.value })}
                  placeholder="e.g. HR requested candidate profiles for senior role..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={() => setOutcomeModal(null)}
                className="px-3 py-1.5 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOutcome}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow"
              >
                Save Outcome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CompanyDetailsModal
        isOpen={isCompanyDetailsOpen}
        onClose={() => setIsCompanyDetailsOpen(false)}
        company={selectedCompany}
        onUpdateCompany={(updated) => {
          setSelectedCompany(updated);
          loadData();
        }}
        onAddRole={(name) => {
          setIsCompanyDetailsOpen(false);
          onAddRole?.(name);
        }}
        currentUser={currentUser}
      />

      <DocumentIntakeModal
        isOpen={isDocumentIntakeOpen}
        onClose={() => setIsDocumentIntakeOpen(false)}
        onDataStored={() => {
          loadData();
          setFeedback({
            type: 'success',
            text: 'Document data successfully parsed and stored in database!',
          });
        }}
        onViewCompany={(c) => handleOpenCompanyDetails(c)}
      />

      <CSVBulkImportModal
        isOpen={isCSVBulkImportOpen}
        onClose={() => setIsCSVBulkImportOpen(false)}
        onImportComplete={() => {
          loadData();
          setFeedback({
            type: 'success',
            text: 'Bulk CSV Import completed! Company records & roles updated.',
          });
          setTimeout(() => setFeedback(null), 5000);
        }}
        teamMembers={TEAM_MEMBERS}
      />
    </div>
  );
};
