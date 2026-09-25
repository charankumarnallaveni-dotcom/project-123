import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { HRContact, OutreachChannel, OutreachChannelType, OutreachChannelStatus } from '../types';
import { Send, Phone, Mail, MessageSquare, Linkedin, CheckCircle, Sparkles, Copy, Check, RefreshCw, X, FileText, Calendar, Clock, Upload, Download, CheckSquare, Square, Layers, FileSpreadsheet, ChevronLeft, ChevronRight, LayoutGrid, Table as TableIcon } from 'lucide-react';

interface ActiveDraftModalState {
  contact: HRContact;
  channel: OutreachChannelType;
  draftText: string;
  loading: boolean;
  copied: boolean;
  profileLoading?: boolean;
  profileView?: 'email' | 'sms';
  profileAnalysis?: {
    profile_summary: string;
    relevant_hooks: string;
    email_subject: string;
    email_body: string;
    sms_body: string;
  };
}

interface SentChecklistState {
  contact: HRContact;
  channel: OutreachChannelType;
  confirmedSent: boolean;
  sentAt: string;
  notes: string;
  callDurationMinutes?: number;
  callOutcome?: string;
  proofFile?: File;
}

export const OutreachTrackerPage: React.FC = () => {
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [channels, setChannels] = useState<OutreachChannel[]>([]);
  const [draftModal, setDraftModal] = useState<ActiveDraftModalState | null>(null);
  const [sentModal, setSentModal] = useState<SentChecklistState | null>(null);
  const [viewProofModal, setViewProofModal] = useState<{ outreach: OutreachChannel; proof: NonNullable<OutreachChannel['proof']> } | null>(null);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk operations state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState<boolean>(false);
  const [showBatchDraftModal, setShowBatchDraftModal] = useState<boolean>(false);
  const [showBatchStatusModal, setShowBatchStatusModal] = useState<boolean>(false);
  const [bulkChannel, setBulkChannel] = useState<OutreachChannelType>('mail');
  const [bulkStatus, setBulkStatus] = useState<OutreachChannelStatus>('sent');
  const [bulkUploadText, setBulkUploadText] = useState<string>('');
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false);

  // Mobile layout state & scroll controls
  const [mobileView, setMobileView] = useState<'matrix' | 'cards'>('matrix');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollMatrix = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const delta = direction === 'left' ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const scrollToChannelIndex = (idx: number) => {
    if (scrollContainerRef.current) {
      // 0: Contact info (0px), 1: Call (200px), 2: Mail (350px), 3: Text (500px), 4: WhatsApp (650px), 5: LinkedIn (800px)
      const target = idx === 0 ? 0 : 200 + (idx - 1) * 150;
      scrollContainerRef.current.scrollTo({ left: target, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (viewProofModal) {
      let active = true;
      api.fetchProofImageBlobUrl(viewProofModal.outreach.id)
        .then((url) => { if (active) setProofImageUrl(url); })
        .catch(() => {
          if (active) setProofImageUrl(api.getProofImageUrl(viewProofModal.outreach.id));
        });
      return () => { active = false; };
    } else {
      setProofImageUrl(null);
    }
  }, [viewProofModal]);

  useEffect(() => {
    Promise.all([api.getContacts(), api.getOutreachChannels()])
      .then(([cList, aList]) => {
        setContacts(cList);
        setChannels(aList);
      })
      .catch(console.error);
  }, []);

  const handleStatusDropdownChange = (contact: HRContact, channelType: OutreachChannelType, newStatus: OutreachChannelStatus) => {
    if (newStatus === 'sent' || newStatus === 'replied') {
      const nowStr = new Date().toISOString().slice(0, 16);
      setSentModal({
        contact,
        channel: channelType,
        confirmedSent: true,
        sentAt: nowStr,
        notes: '',
        callDurationMinutes: 3,
        callOutcome: 'connected',
      });
    } else {
      executeStatusUpdate(contact, channelType, newStatus);
    }
  };

  const executeStatusUpdate = async (
    contact: HRContact,
    channelType: OutreachChannelType,
    newStatus: OutreachChannelStatus,
    notes?: string,
    callDurationSeconds?: number,
    callOutcome?: string
  ): Promise<OutreachChannel | null> => {
    try {
      const existing = channels.find((a) => a.contact_id === contact.id && a.channel === channelType);
      let savedOutreach: OutreachChannel;
      if (existing) {
        const updated = await api.patchOutreachStatus(existing.id, newStatus, notes, callDurationSeconds, callOutcome);
        setChannels(channels.map((ch) => (ch.id === updated.id ? updated : ch)));
        savedOutreach = updated;
      } else {
        const created = await api.createOutreachChannel({
          contact_id: contact.id,
          channel: channelType,
          status: newStatus,
          notes,
          call_duration_seconds: callDurationSeconds,
          call_outcome: callOutcome,
        });
        setChannels([created, ...channels]);
        savedOutreach = created;
      }
      setFeedback({ type: 'success', text: `Updated ${contact.name}'s ${channelType.toUpperCase()} status to ${newStatus.toUpperCase()}` });
      return savedOutreach;
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update outreach status' });
      return null;
    }
  };

  const handleConfirmSentModal = async () => {
    if (!sentModal || !sentModal.confirmedSent) return;
    const durationSec = sentModal.channel === 'call' && sentModal.callDurationMinutes ? sentModal.callDurationMinutes * 60 : undefined;
    const savedOutreach = await executeStatusUpdate(
      sentModal.contact,
      sentModal.channel,
      'sent',
      sentModal.notes,
      durationSec,
      sentModal.channel === 'call' ? sentModal.callOutcome : undefined
    );
    if (savedOutreach && sentModal.proofFile) {
      try {
        const proof = await api.uploadOutreachProof(savedOutreach.id, sentModal.proofFile);
        setChannels((current) => current.map((entry) => entry.id === savedOutreach.id ? { ...entry, proof } : entry));
        setFeedback({ type: 'success', text: `Outreach saved and proof analyzed: ${proof?.verification_status.replace('_', ' ')}.` });
      } catch (err: any) {
        setFeedback({ type: 'error', text: `Outreach saved, but proof analysis failed: ${err.message}` });
      }
    }
    setSentModal(null);
  };


  const handleOpenDraft = async (contact: HRContact, channelType: OutreachChannelType) => {
    setDraftModal({
      contact,
      channel: channelType,
      draftText: '',
      loading: true,
      copied: false,
    });

    try {
      const res = await api.generateOutreachDraft(contact.id, channelType);
      setDraftModal({
        contact,
        channel: channelType,
        draftText: res.draft_text,
        loading: false,
        copied: false,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to generate draft' });
      setDraftModal(null);
    }
  };

  const handleRegenerateDraft = async () => {
    if (!draftModal) return;
    setDraftModal({ ...draftModal, loading: true, copied: false });
    try {
      const res = await api.generateOutreachDraft(draftModal.contact.id, draftModal.channel);
      setDraftModal({
        ...draftModal,
        draftText: res.draft_text,
        loading: false,
        copied: false,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to regenerate draft' });
      setDraftModal({ ...draftModal, loading: false });
    }
  };

  const handleAnalyzeProfile = async (file: File) => {
    if (!draftModal) return;
    setDraftModal({ ...draftModal, profileLoading: true });
    try {
      const result = await api.analyzeProfileImage(draftModal.contact.id, file);
      setDraftModal({
        ...draftModal,
        profileAnalysis: result,
        profileLoading: false,
        profileView: 'email',
        draftText: result.email_subject + '\n\n' + result.email_body,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to analyze profile image' });
      setDraftModal({ ...draftModal, profileLoading: false });
    }
  };

  const showProfileDraft = (view: 'email' | 'sms') => {
    if (!draftModal?.profileAnalysis) return;
    const analysis = draftModal.profileAnalysis;
    setDraftModal({
      ...draftModal,
      profileView: view,
      draftText: view === 'email' ? `${analysis.email_subject}\n\n${analysis.email_body}` : analysis.sms_body,
      copied: false,
    });
  };

  const handleCopyToClipboard = async () => {
    if (!draftModal || !draftModal.draftText) return;
    try {
      await navigator.clipboard.writeText(draftModal.draftText);
      setDraftModal({ ...draftModal, copied: true });
      setTimeout(() => {
        setDraftModal((prev) => (prev ? { ...prev, copied: false } : null));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const getChannelEntry = (contactId: string, channelType: OutreachChannelType) => {
    return channels.find((a) => a.contact_id === contactId && a.channel === channelType);
  };

  const channelList: { id: OutreachChannelType; label: string; icon: any }[] = [
    { id: 'call', label: 'Call', icon: Phone },
    { id: 'mail', label: 'Mail', icon: Mail },
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  ];

  const getChannelLabelHeader = (ch: OutreachChannelType) => {
    switch (ch) {
      case 'call': return 'Phone Script / Talking Points';
      case 'mail': return 'Formal Email Template';
      case 'text': return 'Short Text / SMS Draft';
      case 'whatsapp': return 'Conversational WhatsApp Note';
      case 'linkedin': return 'LinkedIn Connection / InMail Note';
      default: return 'Outreach Message Draft';
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map((c) => c.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExecuteBatchDrafts = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await api.generateBulkOutreachDrafts(selectedIds, bulkChannel);
      setFeedback({
        type: 'success',
        text: `Generated AI outreach drafts for ${selectedIds.length} leads on ${bulkChannel.toUpperCase()} channel.`,
      });
      setShowBatchDraftModal(false);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to generate bulk drafts' });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExecuteBatchStatus = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await api.updateBulkOutreachStatus(selectedIds, bulkChannel, bulkStatus);
      const updatedChannels = await api.getOutreachChannels();
      setChannels(updatedChannels);
      setFeedback({
        type: 'success',
        text: `Updated ${bulkChannel.toUpperCase()} status to ${bulkStatus.toUpperCase()} for ${selectedIds.length} contacts.`,
      });
      setShowBatchStatusModal(false);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update bulk status' });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleExportCSV = () => {
    const targetContacts = selectedIds.length > 0
      ? contacts.filter((c) => selectedIds.includes(c.id))
      : contacts;

    const headers = ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn', 'Call Status', 'Mail Status', 'Text Status', 'WhatsApp Status', 'LinkedIn Status'];
    const rows = targetContacts.map((c) => {
      const getStat = (ch: OutreachChannelType) => {
        const found = channels.find((x) => x.contact_id === c.id && x.channel === ch);
        return found ? found.status : 'not_started';
      };
      return [
        `"${c.name}"`,
        `"${c.title || ''}"`,
        `"${c.company?.name || ''}"`,
        `"${c.email || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.linkedin_url || ''}"`,
        getStat('call'),
        getStat('mail'),
        getStat('text'),
        getStat('whatsapp'),
        getStat('linkedin'),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `outreach_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUploadCSV = async () => {
    if (!bulkUploadText.trim()) return;
    setBulkProcessing(true);
    let countSuccess = 0;
    let countFailed = 0;

    const lines = bulkUploadText.split('\n').filter((l) => l.trim().length > 0);
    const firstLineLower = lines[0].toLowerCase();
    const startIndex = firstLineLower.includes('name') || firstLineLower.includes('email') ? 1 : 0;

    const companiesList = await api.getCompanies();
    const defaultCompanyId = companiesList.length > 0 ? companiesList[0].id : undefined;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length === 0 || !parts[0]) continue;

      const name = parts[0];
      const title = parts[1] || 'HR Manager';
      const companyName = parts[2] || '';
      const email = parts[3] || '';
      const phone = parts[4] || '';
      const linkedin = parts[5] || '';

      let targetCompanyId = defaultCompanyId;
      if (companyName) {
        const foundComp = companiesList.find((c) => c.name.toLowerCase() === companyName.toLowerCase());
        if (foundComp) {
          targetCompanyId = foundComp.id;
        }
      }

      if (!targetCompanyId) {
        countFailed++;
        continue;
      }

      try {
        await api.createContact({
          name,
          title,
          company_id: targetCompanyId,
          email: email || undefined,
          phone: phone || undefined,
          linkedin_url: linkedin || undefined,
        });
        countSuccess++;
      } catch {
        countFailed++;
      }
    }

    const updatedContacts = await api.getContacts();
    setContacts(updatedContacts);
    setBulkProcessing(false);
    setShowBulkUploadModal(false);
    setBulkUploadText('');
    setFeedback({
      type: 'success',
      text: `Bulk import completed: ${countSuccess} contacts created successfully${countFailed > 0 ? ` (${countFailed} skipped / duplicate)` : ''}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Send className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-400 shrink-0" />
            <span>Multi-Channel Outreach Tracker Matrix</span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            Batch-process leads, bulk generate messages, and track multi-channel status
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowBulkUploadModal(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition min-h-[44px]"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Bulk Upload Leads</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition min-h-[44px]"
          >
            <Download className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">Export CSV</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 text-sm font-medium ${
            feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
          }`}
        >
          <CheckCircle className="h-5 w-5" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950/60 border border-indigo-500/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>{selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchDraftModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Batch Generate Drafts</span>
            </button>
            <button
              onClick={() => setShowBatchStatusModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Batch Status Update</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 text-xs font-semibold rounded-md flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Export Batch CSV</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Matrix Table & Mobile Views */}
      <div className="w-full min-w-0 max-w-full bg-gray-800 border border-gray-700 rounded-xl shadow-sm">
        {/* Mobile Swipe Navigation & View Switcher Banner */}
        <div className="md:hidden p-3 bg-indigo-950/80 border-b border-gray-700/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200">
              <span className="inline-block animate-pulse">👉</span>
              <span>Swipe sideways to view all channels</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Left / Right Scroll Buttons */}
              <button
                type="button"
                onClick={() => scrollMatrix('left')}
                className="p-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-600/60 active:bg-indigo-700 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer shadow-xs"
                title="Scroll Left"
                aria-label="Scroll Left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollMatrix('right')}
                className="p-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-100 border border-indigo-600/60 active:bg-indigo-700 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer shadow-xs"
                title="Scroll Right"
                aria-label="Scroll Right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* View Toggle (Table Matrix vs Stacked Cards) */}
              <button
                type="button"
                onClick={() => setMobileView(mobileView === 'matrix' ? 'cards' : 'matrix')}
                className="ml-1 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 text-xs font-semibold flex items-center gap-1 min-h-[36px]"
                title="Switch layout mode"
              >
                {mobileView === 'matrix' ? (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Cards</span>
                  </>
                ) : (
                  <>
                    <TableIcon className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Table</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Channel Jump Pills (Tap to auto-scroll right to that channel) */}
          {mobileView === 'matrix' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] uppercase font-bold text-indigo-300/70 shrink-0">Jump to:</span>
              <button
                type="button"
                onClick={() => scrollToChannelIndex(0)}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-900 text-gray-200 border border-gray-700 shrink-0 active:bg-gray-700"
              >
                Contact
              </button>
              {channelList.map((ch, idx) => {
                const Icon = ch.icon;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => scrollToChannelIndex(idx + 1)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-600/50 flex items-center gap-1 shrink-0 active:bg-indigo-700"
                  >
                    <Icon className="h-3 w-3 text-indigo-400" />
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stacked Cards View for Mobile */}
        {mobileView === 'cards' ? (
          <div className="md:hidden p-3 space-y-3">
            {contacts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No HR Contacts sourced yet. Go to HR Sourcing or use Bulk Upload to add contacts.
              </div>
            ) : (
              contacts.map((contact) => {
                const isSelected = selectedIds.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    className={`bg-gray-900/90 border rounded-xl p-4 space-y-3 transition ${
                      isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-gray-700/80'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(contact.id)}
                          className="rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-5 w-5 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-base leading-tight truncate">{contact.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {contact.title || 'HR Contact'} • <span className="text-indigo-400 font-semibold">{contact.company?.name}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 5 Channels in Stacked Card */}
                    <div className="space-y-2 pt-2 border-t border-gray-800">
                      {channelList.map((ch) => {
                        const Icon = ch.icon;
                        const entry = getChannelEntry(contact.id, ch.id);
                        const currentStatus: OutreachChannelStatus = entry ? entry.status : 'not_started';
                        return (
                          <div
                            key={ch.id}
                            className="bg-gray-800/80 border border-gray-700/60 rounded-lg p-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="p-1.5 rounded-md bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 shrink-0">
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-xs font-bold text-gray-200 truncate">{ch.label}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Status Dropdown */}
                              <select
                                value={currentStatus}
                                onChange={(e) => handleStatusDropdownChange(contact, ch.id, e.target.value as OutreachChannelStatus)}
                                className={`text-xs font-semibold rounded-lg px-2 py-1.5 outline-none cursor-pointer border ${
                                  currentStatus === 'sent'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : currentStatus === 'replied'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : currentStatus === 'failed'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-gray-900 text-gray-300 border-gray-700'
                                }`}
                              >
                                <option value="not_started">Not Started</option>
                                <option value="sent">Sent</option>
                                <option value="replied">Replied</option>
                                <option value="failed">Failed</option>
                              </select>

                              {/* Draft Button */}
                              <button
                                onClick={() => handleOpenDraft(contact, ch.id)}
                                title={`Generate ${ch.label} draft`}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm min-h-[36px]"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Draft</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Table Matrix View (With Guaranteed Native Mobile Side-Swiping) */
          <div 
            ref={scrollContainerRef}
            className="w-full max-w-full overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-gray-600 block"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="w-max min-w-[860px] text-left text-sm text-gray-300 border-collapse">
              <thead className="bg-gray-900/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-700">
                <tr>
                  <th className="px-4 py-4 text-center w-12 shrink-0">
                    <input
                      type="checkbox"
                      checked={contacts.length > 0 && selectedIds.length === contacts.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-4 min-w-[240px]">HR Contact & Company</th>
                  {channelList.map((ch) => {
                    const Icon = ch.icon;
                    return (
                      <th key={ch.id} className="px-4 py-4 text-center min-w-[145px]">
                        <div className="flex items-center justify-center space-x-1.5">
                          <Icon className="h-4 w-4 text-indigo-400" />
                          <span>{ch.label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No HR Contacts sourced yet. Go to HR Sourcing or use Bulk Upload to add contacts.
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => {
                    const isSelected = selectedIds.includes(contact.id);
                    return (
                      <tr key={contact.id} className={`hover:bg-gray-700/20 transition ${isSelected ? 'bg-indigo-950/30' : ''}`}>
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(contact.id)}
                            className="rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-white text-sm">{contact.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{contact.title || 'HR Contact'} • <span className="text-indigo-400">{contact.company?.name}</span></p>
                        </td>
                      {channelList.map((ch) => {
                        const entry = getChannelEntry(contact.id, ch.id);
                        const currentStatus: OutreachChannelStatus = entry ? entry.status : 'not_started';
                        return (
                          <td key={ch.id} className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              {/* Status Dropdown */}
                              <select
                                value={currentStatus}
                                onChange={(e) => handleStatusDropdownChange(contact, ch.id, e.target.value as OutreachChannelStatus)}
                                className={`text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer border ${
                                  currentStatus === 'sent'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : currentStatus === 'replied'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : currentStatus === 'failed'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-gray-900 text-gray-400 border-gray-700'
                                }`}
                              >
                                <option value="not_started">Not Started</option>
                                <option value="sent">Sent</option>
                                <option value="replied">Replied</option>
                                <option value="failed">Failed</option>
                              </select>

                              {/* Channel Draft Button */}
                              <button
                                onClick={() => handleOpenDraft(contact, ch.id)}
                                title={`Generate ${ch.label} draft message`}
                                className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition flex items-center gap-1 text-xs font-medium shrink-0 min-h-[36px]"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">Draft</span>
                              </button>
                              {entry?.proof && (
                                <button
                                  type="button"
                                  onClick={() => setViewProofModal({ outreach: entry, proof: entry.proof! })}
                                  title={`Click to view AI proof analysis & screenshot for ${ch.label}`}
                                  className={`px-1.5 py-1 rounded text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer hover:scale-105 ${
                                    entry.proof.verification_status === 'verified'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                      : entry.proof.verification_status === 'not_verified'
                                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                  }`}
                                >
                                  <FileText className="h-3 w-3" />
                                  <span>Proof: {entry.proof.verification_status.replace('_', ' ')}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sent Confirmation Checklist Modal */}
      {sentModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setSentModal(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-gray-700/60 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-400" />
                  Outreach "Sent" Confirmation Checklist
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Contact: <span className="text-white font-medium">{sentModal.contact.name}</span> ({sentModal.channel.toUpperCase()})
                </p>
              </div>
              <button
                onClick={() => setSentModal(null)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={sentModal.confirmedSent}
                  onChange={(e) => setSentModal({ ...sentModal, confirmedSent: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-blue-200">
                  I confirm that this outreach message was actually sent to {sentModal.contact.name}.
                </span>
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" /> Date/Time Sent
                </label>
                <input
                  type="datetime-local"
                  value={sentModal.sentAt}
                  onChange={(e) => setSentModal({ ...sentModal, sentAt: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              {sentModal.channel === 'call' && (
                <div className="space-y-3 p-3 bg-gray-900/80 border border-indigo-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Call Verification Details
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                      Telephony / Mobile Log
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-300 mb-1">
                        Call Duration (mins)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={sentModal.callDurationMinutes ?? 3}
                        onChange={(e) => setSentModal({ ...sentModal, callDurationMinutes: parseInt(e.target.value) || 1 })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-300 mb-1">
                        Call Outcome
                      </label>
                      <select
                        value={sentModal.callOutcome || 'connected'}
                        onChange={(e) => setSentModal({ ...sentModal, callOutcome: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                      >
                        <option value="connected">Connected & Discussed</option>
                        <option value="left_voicemail">Left Voicemail</option>
                        <option value="busy">Busy / Unreachable</option>
                        <option value="wrong_number">Wrong Number</option>
                        <option value="callback_scheduled">Callback Scheduled</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Upload Proof Screenshot ({sentModal.channel.toUpperCase()}) (optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setSentModal({ ...sentModal, proofFile: e.target.files?.[0] })}
                  className="w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Upload a screenshot of WhatsApp chat, phone call log, LinkedIn InMail, email sent box, or SMS text. AI will analyze visible evidence & extract text details.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Optional Activity Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Left voicemail, sent template #2..."
                  value={sentModal.notes}
                  onChange={(e) => setSentModal({ ...sentModal, notes: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                ></textarea>
              </div>


              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSentModal(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!sentModal.confirmedSent}
                  onClick={handleConfirmSentModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow-md"
                >
                  Confirm & Mark Sent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proof Inspection Modal */}
      {viewProofModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold text-white text-base">
                  AI Outreach Proof Analysis ({viewProofModal.outreach.channel.toUpperCase()})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewProofModal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400">Uploaded Screenshot</label>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 flex justify-center items-center min-h-[220px]">
                  {proofImageUrl ? (
                    <img
                      src={proofImageUrl}
                      alt="Outreach Proof Screenshot"
                      className="max-h-[280px] w-auto object-contain rounded border border-gray-800 shadow-md"
                    />
                  ) : (
                    <div className="text-xs text-gray-400 animate-pulse flex items-center gap-1.5">
                      <span>Loading proof image...</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 font-mono">
                  File: {viewProofModal.proof.filename} ({viewProofModal.proof.mime_type})
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Verification Status</label>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold border uppercase ${
                      viewProofModal.proof.verification_status === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : viewProofModal.proof.verification_status === 'not_verified'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}>
                      {viewProofModal.proof.verification_status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">
                      Confidence: <strong className="text-white capitalize">{viewProofModal.proof.confidence}</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Detected Evidence Type</label>
                  <span className="bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-1 rounded text-xs font-mono">
                    {viewProofModal.proof.evidence_type}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">AI Text Summary</label>
                  <p className="text-xs text-gray-200 bg-gray-900 border border-gray-700/60 rounded-lg p-2.5 leading-relaxed">
                    {viewProofModal.proof.summary}
                  </p>
                </div>

                {viewProofModal.proof.extracted_details && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Extracted Details</label>
                    <p className="text-xs text-gray-300 bg-gray-900 border border-gray-700/60 rounded-lg p-2.5 font-mono leading-relaxed">
                      {viewProofModal.proof.extracted_details}
                    </p>
                  </div>
                )}

                {viewProofModal.proof.concerns && (
                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Flags & Concerns</label>
                    <p className="text-xs text-amber-200 bg-amber-950/30 border border-amber-800/50 rounded-lg p-2.5">
                      {viewProofModal.proof.concerns}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-700">
              <button
                type="button"
                onClick={() => setViewProofModal(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popover / Modal for Draft Message */}
      {draftModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setDraftModal(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-700/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {draftModal.channel} Channel
                  </span>
                  <h3 className="text-base font-bold text-white">
                    {getChannelLabelHeader(draftModal.channel)}
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Target: <span className="text-gray-200 font-semibold">{draftModal.contact.name}</span> ({draftModal.contact.title || 'HR Leader'} @ {draftModal.contact.company?.name})
                </p>
              </div>

              <button
                onClick={() => setDraftModal(null)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-indigo-200">Analyze profile with OpenRouter</p>
                  <p className="text-[11px] text-gray-400 mt-1">Upload a LinkedIn profile PDF export or screenshot to personalize email and SMS.</p>
                </div>
                <label className="shrink-0 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg">
                  {draftModal.profileLoading ? 'Analyzing...' : 'Upload Profile (PDF / Screenshot)'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                    className="hidden"
                    disabled={draftModal.profileLoading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleAnalyzeProfile(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
              {draftModal.profileAnalysis && (
                <div className="space-y-2 text-xs">
                  <p className="text-gray-200"><strong className="text-indigo-300">Profile:</strong> {draftModal.profileAnalysis.profile_summary}</p>
                  <p className="text-gray-200"><strong className="text-indigo-300">Hooks:</strong> {draftModal.profileAnalysis.relevant_hooks}</p>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => showProfileDraft('email')} className={`px-3 py-1.5 rounded-md font-semibold ${draftModal.profileView === 'email' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Generated Email</button>
                    <button type="button" onClick={() => showProfileDraft('sms')} className={`px-3 py-1.5 rounded-md font-semibold ${draftModal.profileView === 'sms' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300'}`}>Generated SMS</button>
                  </div>
                </div>
              )}
            </div>

            {draftModal.loading ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400" />
                <p className="text-sm">Generating channel-tailored draft message...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={draftModal.channel === 'call' ? 10 : 7}
                    readOnly
                    value={draftModal.draftText}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-100 focus:outline-none font-sans leading-relaxed selection:bg-indigo-500 selection:text-white"
                  ></textarea>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleRegenerateDraft}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Regenerate Draft</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition shadow-md ${
                        draftModal.copied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {draftModal.copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy to Clipboard</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-amber-400/90 flex items-center gap-1 pt-1">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  Note: Text is copied for manual CRA sending. Nothing is sent automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Upload Leads Modal */}
      {showBulkUploadModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowBulkUploadModal(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-400" />
                Bulk Upload Leads (CSV / Plain Text)
              </h3>
              <button onClick={() => setShowBulkUploadModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Paste CSV rows or formatted lead text. Duplicate leads with existing emails or phone numbers will be skipped automatically.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                CSV Lines (Header: Name, Title, Company, Email, Phone, LinkedIn)
              </label>
              <textarea
                value={bulkUploadText}
                onChange={(e) => setBulkUploadText(e.target.value)}
                placeholder={`Jane Doe, Talent Acquisition, Acme Corp, jane@acme.com, +15550199, https://linkedin.com/in/janedoe\nJohn Smith, HR Director, Beta Tech, john@betatech.com, +15550188, https://linkedin.com/in/johnsmith`}
                rows={8}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-200 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkUploadModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUploadCSV}
                disabled={bulkProcessing || !bulkUploadText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {bulkProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import Leads</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Draft Modal */}
      {showBatchDraftModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowBatchDraftModal(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                Batch Generate Outreach Drafts
              </h3>
              <button onClick={() => setShowBatchDraftModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Generate AI outreach drafts for <span className="text-indigo-300 font-semibold">{selectedIds.length} selected contacts</span>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Target Outreach Channel</label>
              <select
                value={bulkChannel}
                onChange={(e) => setBulkChannel(e.target.value as OutreachChannelType)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-gray-200 focus:border-indigo-500"
              >
                <option value="mail">Email Template</option>
                <option value="call">Phone Call Talking Points</option>
                <option value="text">SMS / Text Draft</option>
                <option value="whatsapp">WhatsApp Note</option>
                <option value="linkedin">LinkedIn Connection Note</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBatchDraftModal(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBatchDrafts}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                {bulkProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Generating Drafts...</span>
                  </>
                ) : (
                  <span>Generate All Drafts</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Status Update Modal */}
      {showBatchStatusModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setShowBatchStatusModal(false)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-400" />
                Batch Outreach Status Update
              </h3>
              <button onClick={() => setShowBatchStatusModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Update outreach status for <span className="text-blue-300 font-semibold">{selectedIds.length} selected contacts</span>.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Target Channel</label>
                <select
                  value={bulkChannel}
                  onChange={(e) => setBulkChannel(e.target.value as OutreachChannelType)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-gray-200 focus:border-indigo-500"
                >
                  <option value="mail">Mail</option>
                  <option value="call">Call</option>
                  <option value="text">Text</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="linkedin">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">New Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as OutreachChannelStatus)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-gray-200 focus:border-indigo-500"
                >
                  <option value="not_started">Not Started</option>
                  <option value="sent">Sent</option>
                  <option value="replied">Replied</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBatchStatusModal(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBatchStatus}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
              >
                {bulkProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update All Selected</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
