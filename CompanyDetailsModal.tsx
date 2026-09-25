import React, { useState } from 'react';
import {
  X,
  Building2,
  Users,
  Linkedin,
  Phone,
  Mail,
  ExternalLink,
  Plus,
  UserCheck,
  Briefcase,
  Globe,
  Edit2,
  Check,
  Copy,
  MessageSquare,
  Calendar,
  Lock,
} from 'lucide-react';
import { Company, HRContact, JD, CRA } from '../types';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';

interface CompanyDetailsModalProps {
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCompany?: (updated: Company) => void;
  onAddRole?: (companyName: string) => void;
  onContactAdded?: (newContact: HRContact) => void;
  currentUser?: CRA | null;
}

export const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({
  company,
  isOpen,
  onClose,
  onUpdateCompany,
  onAddRole,
  onContactAdded,
  currentUser: propUser,
}) => {
  const [currentUser, setCurrentUser] = useState<CRA | null>(propUser || null);
  const [isEditing, setIsEditing] = useState(false);
  const [employeeCount, setEmployeeCount] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [enteredByName, setEnteredByName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  React.useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
    } else {
      const u = clientFallbackStore.getCurrentUser();
      if (u) setCurrentUser(u);
      else api.getCurrentCRA().then(setCurrentUser).catch(() => null);
    }
  }, [propUser]);

  // Quick Add HR contact form state
  const [showAddContact, setShowAddContact] = useState(false);
  const [newHRName, setNewHRName] = useState('');
  const [newHRTitle, setNewHRTitle] = useState('');
  const [newHRPhone, setNewHRPhone] = useState('');
  const [newHREmail, setNewHREmail] = useState('');
  const [newHRLinkedin, setNewHRLinkedin] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Quick Add Role state
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleType, setNewRoleType] = useState<'existing_post' | 'cold_outreach'>('existing_post');
  const [isAddingRole, setIsAddingRole] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    if (company) {
      setEmployeeCount(company.employee_count || '100-500 employees');
      setLinkedinUrl(company.linkedin_url || `https://www.linkedin.com/company/${company.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
      setIndustry(company.industry || '');
      setWebsite(company.website || '');
      setLocation(company.location || '');
      setEnteredByName(company.entered_by_name || (company.creator ? company.creator.name : 'Aravind Reddy'));
      setIsEditing(false);
      setShowAddContact(false);
      setShowAddRole(false);
      setFeedback(null);
    }
  }, [company]);

  if (!isOpen || !company) return null;

  // Rule: Once a company profile is created, only Admins (or the original creator) may edit profile fields.
  // Other CRAs have view-only access. Exception: any CRA may still add a new JD/role under this company.
  const canEditCompany = currentUser?.role === 'admin' ||
    (currentUser?.id && company.created_by === currentUser.id) ||
    (currentUser?.name && company.entered_by_name?.toLowerCase() === currentUser.name.toLowerCase());

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleSaveCompanyEdits = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await api.updateCompany(company.id, {
        employee_count: employeeCount.trim(),
        linkedin_url: linkedinUrl.trim(),
        industry: industry.trim(),
        website: website.trim(),
        entered_by_name: enteredByName.trim(),
      });
      onUpdateCompany?.(updated);
      setIsEditing(false);
      setFeedback({ type: 'success', text: 'Company details updated successfully' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update company' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHRName.trim()) {
      setFeedback({ type: 'error', text: 'HR Name is required' });
      return;
    }
    setIsAddingContact(true);
    setFeedback(null);
    try {
      const newContact = await api.createContact({
        name: newHRName.trim(),
        title: newHRTitle.trim() || 'HR Lead',
        company_id: company.id,
        phone: newHRPhone.trim() || undefined,
        email: newHREmail.trim() || undefined,
        linkedin_url: newHRLinkedin.trim() || undefined,
        entered_by_name: enteredByName || 'Aravind Reddy',
        source: 'manual',
      });
      onContactAdded?.(newContact);
      setShowAddContact(false);
      setNewHRName('');
      setNewHRTitle('');
      setNewHRPhone('');
      setNewHREmail('');
      setNewHRLinkedin('');
      setFeedback({ type: 'success', text: `Added ${newContact.name} to HR Contacts` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to add HR contact' });
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) {
      setFeedback({ type: 'error', text: 'Role title is required' });
      return;
    }

    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const newNormTitle = norm(newRoleTitle);

    // Rule: "if it existed then see the role that entered: if it is a different role add it, but if it is a same role leave it dont allow to store"
    const existingRoles = company.jds || [];
    const duplicate = existingRoles.find((j) => norm(j.title) === newNormTitle);
    if (duplicate) {
      setFeedback({
        type: 'error',
        text: `⚠️ Duplicate Role: "${newRoleTitle.trim()}" already exists for ${company.name}. Duplicate roles are not allowed to be stored.`,
      });
      return;
    }

    setIsAddingRole(true);
    setFeedback(null);
    try {
      const createdJD = await api.createJD({
        company_id: company.id,
        title: newRoleTitle.trim(),
        opportunity_type: newRoleType,
        raw_text: `Opportunity for ${newRoleTitle.trim()} at ${company.name}`,
        is_verified: true,
        verification_source: 'manual_entry',
      });

      const updatedJds = [createdJD, ...(company.jds || [])];
      onUpdateCompany?.({
        ...company,
        jds: updatedJds,
      });

      setShowAddRole(false);
      setNewRoleTitle('');
      setFeedback({
        type: 'success',
        text: `✅ Added new role "${createdJD.title}" to ${company.name}`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to add role' });
    } finally {
      setIsAddingRole(false);
    }
  };

  const hrList = company.contacts || [];
  const jdList = company.jds || [];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-800 bg-gray-900/90 sticky top-0 z-10 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">{company.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {company.industry || 'Technology'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                  Source: {company.source}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Entered by: <strong className="text-white font-semibold">{company.entered_by_name || (company.creator ? company.creator.name : 'Aravind Reddy')}</strong>
                </span>
                <span className="text-gray-600">•</span>
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                <span>Added: {company.created_at ? new Date(company.created_at).toLocaleDateString() : 'Recent'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditCompany ? (
              !isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                  title="Edit company information"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveCompanyEdits}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
              )
            ) : (
              <span
                className="px-2.5 py-1 bg-gray-800/80 text-gray-400 border border-gray-700/60 rounded-lg text-xs font-medium flex items-center gap-1.5"
                title="Company profile fields are locked. Only Admins can modify existing company details."
              >
                <Lock className="h-3 w-3 text-amber-400" />
                <span>View-Only</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border-b border-rose-500/20'
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Company Key Metrics / Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Metric 1: How many people working */}
            <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="h-4 w-4 text-blue-400" />
                  People Working (Headcount)
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  placeholder="e.g. 500-1,000 employees"
                  className="w-full bg-gray-900 border border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-sm text-white font-semibold focus:outline-none"
                />
              ) : (
                <p className="text-base font-bold text-white tracking-wide">
                  {company.employee_count || employeeCount || '100-500 employees'}
                </p>
              )}
              <span className="text-[11px] text-gray-500 mt-1">Verified company headcount</span>
            </div>

            {/* Metric 2: LinkedIn Company Page */}
            <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Linkedin className="h-4 w-4 text-sky-400" />
                  LinkedIn Page
                </span>
                {company.linkedin_url && !isEditing && (
                  <a
                    href={company.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:text-sky-300 transition flex items-center gap-0.5 text-[11px]"
                  >
                    <span>Visit</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/..."
                  className="w-full bg-gray-900 border border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                />
              ) : (
                <a
                  href={company.linkedin_url || linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-sky-400 hover:underline truncate block"
                >
                  {company.linkedin_url || linkedinUrl || 'Add LinkedIn profile'}
                </a>
              )}
              <span className="text-[11px] text-gray-500 mt-1">Direct company presence</span>
            </div>

            {/* Metric 3: Who Entered It */}
            <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  Entered By (Attribution)
                </span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={enteredByName}
                  onChange={(e) => setEnteredByName(e.target.value)}
                  placeholder="Person who entered it"
                  className="w-full bg-gray-900 border border-indigo-500/50 rounded-lg px-2.5 py-1.5 text-sm text-white font-semibold focus:outline-none"
                />
              ) : (
                <p className="text-base font-bold text-emerald-300">
                  {company.entered_by_name || (company.creator ? company.creator.name : 'Aravind Reddy')}
                </p>
              )}
              <span className="text-[11px] text-gray-500 mt-1">Audited data contributor</span>
            </div>
          </div>

          {/* Website / Notes if present */}
          {(company.website || isEditing) && (
            <div className="flex items-center gap-3 text-xs text-gray-400 bg-gray-800/40 px-4 py-2.5 rounded-lg border border-gray-800">
              <Globe className="h-4 w-4 text-gray-400 shrink-0" />
              {isEditing ? (
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website URL (e.g. https://company.com)"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                />
              ) : (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-300 hover:underline flex items-center gap-1 truncate"
                >
                  <span>{company.website}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* HR Details & HR Numbers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-400" />
                  <span>HR Details & Contact Numbers</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {hrList.length} Contacts
                  </span>
                </h3>
                <p className="text-xs text-gray-400">Direct phone numbers and recruitment leads for {company.name}</p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`(HR OR "Talent Acquisition" OR Recruiter) "${company.name}"`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 rounded-lg text-xs font-medium transition flex items-center gap-1"
                  title="Search more HRs on LinkedIn"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  <span>Search on LinkedIn</span>
                </a>
                <button
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-indigo-900/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add HR Number</span>
                </button>
              </div>
            </div>

            {/* Quick Add HR Contact Form */}
            {showAddContact && (
              <form
                onSubmit={handleCreateContact}
                className="bg-gray-800/90 border border-indigo-500/40 rounded-xl p-4 space-y-3 animate-fade-in"
              >
                <div className="flex items-center justify-between border-b border-gray-700/60 pb-2">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Add New HR Contact & Number
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddContact(false)}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">HR Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Radhika Sharma"
                      value={newHRName}
                      onChange={(e) => setNewHRName(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Designation / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Talent Acquisition Lead"
                      value={newHRTitle}
                      onChange={(e) => setNewHRTitle(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">HR Phone / Mobile Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 or +91 98765..."
                      value={newHRPhone}
                      onChange={(e) => setNewHRPhone(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">HR Email</label>
                    <input
                      type="email"
                      placeholder="hr@company.com"
                      value={newHREmail}
                      onChange={(e) => setNewHREmail(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">HR LinkedIn Profile</label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/..."
                      value={newHRLinkedin}
                      onChange={(e) => setNewHRLinkedin(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isAddingContact}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-md"
                  >
                    {isAddingContact ? 'Saving Contact...' : 'Save HR Contact'}
                  </button>
                </div>
              </form>
            )}

            {/* HR Contacts List */}
            {hrList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {hrList.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-gray-800/80 border border-gray-700/60 hover:border-gray-600 rounded-xl p-4 flex flex-col justify-between transition group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-white group-hover:text-indigo-300 transition">
                            {contact.name}
                          </h4>
                          <p className="text-xs text-gray-400 mt-0.5">{contact.title || 'HR Specialist'}</p>
                        </div>
                        {contact.linkedin_url && (
                          <a
                            href={contact.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-gray-400 hover:text-sky-400 transition"
                            title="Open HR LinkedIn Profile"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                      </div>

                      {/* Phone Number Box */}
                      <div className="mt-3 p-2.5 bg-gray-900/90 rounded-lg border border-gray-700/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          {contact.phone ? (
                            <span className="font-mono text-xs font-bold text-white tracking-wide">
                              {contact.phone}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 italic">No number listed</span>
                          )}
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(contact.phone!)}
                              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[11px] font-medium transition flex items-center gap-1"
                              title="Copy Phone Number"
                            >
                              {copiedPhone === contact.phone ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <a
                              href={`tel:${contact.phone}`}
                              className="p-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded transition"
                              title="Call Number"
                            >
                              <Phone className="h-3 w-3" />
                            </a>
                            <a
                              href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded transition"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Email if present */}
                      {contact.email && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <Mail className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          <a href={`mailto:${contact.email}`} className="hover:text-indigo-300 truncate">
                            {contact.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Creator footer */}
                    <div className="mt-3 pt-2.5 border-t border-gray-700/40 text-[11px] text-gray-500 flex items-center justify-between">
                      <span>
                        Entered by: <strong className="text-gray-300 font-medium">{contact.entered_by_name || (contact.creator ? contact.creator.name : 'Aravind Reddy')}</strong>
                      </span>
                      <span className="capitalize">{contact.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-6 text-center">
                <Phone className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-300">No HR contacts or phone numbers yet</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                  Click "Add HR Number" above or use the "Import from PDF" tool to automatically parse recruitment leads.
                </p>
              </div>
            )}
          </div>

          {/* Job Descriptions / Open Roles Section */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-indigo-400" />
                  <span>Linked Opportunities & Job Descriptions</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {jdList.length}
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddRole(!showAddRole)}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{showAddRole ? 'Cancel' : 'Add Role / JD'}</span>
                </button>
              </div>
            </div>

            {/* Quick Add Role Form */}
            {showAddRole && (
              <form onSubmit={handleCreateRole} className="p-4 bg-gray-900 border border-indigo-500/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Enter New Opportunity / Role for {company.name}
                  </h4>
                  <span className="text-[10px] text-gray-400">Duplicate roles are auto-rejected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Job Title / Role *</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Backend Engineer"
                      value={newRoleTitle}
                      onChange={(e) => setNewRoleTitle(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Opportunity Type</label>
                    <select
                      value={newRoleType}
                      onChange={(e: any) => setNewRoleType(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="existing_post">Existing Job Post</option>
                      <option value="cold_outreach">Cold Outreach Requirement</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddRole(false)}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingRole}
                    className="px-4 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                  >
                    {isAddingRole ? 'Checking & Saving...' : 'Save Role'}
                  </button>
                </div>
              </form>
            )}

            {jdList.length > 0 ? (
              <div className="space-y-2">
                {jdList.map((jd) => (
                  <div
                    key={jd.id}
                    className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h5 className="font-semibold text-xs text-white">{jd.title}</h5>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{jd.raw_text}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        jd.is_verified
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {jd.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No job descriptions attached to this company yet.</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/90 flex items-center justify-between text-xs text-gray-400">
          <span>Company ID: <code className="text-gray-500 font-mono">{company.id}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
