import React, { useEffect, useState } from 'react';
import { CRAPerformanceResponse, CRAPerformanceItem, CRA } from '../types';
import { api } from '../services/api';
import { formatIndianNumber } from '../utils/formatters';
import {
  Award,
  TrendingUp,
  Target,
  Users,
  Send,
  FileCheck,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Edit2,
  Check,
  X,
  Building2,
} from 'lucide-react';
import { Company } from '../types';

interface PerformancePageProps {
  employeeMode?: boolean;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ employeeMode = false }) => {
  const [data, setData] = useState<CRAPerformanceResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<CRA | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTargetCraId, setEditingTargetCraId] = useState<string | null>(null);
  const [newTargetValue, setNewTargetValue] = useState<number>(10);
  const [selectedCraId, setSelectedCraId] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [perfRes, userRes, compRes] = await Promise.all([
        api.getCRAPerformance(employeeMode),
        api.getCurrentCRA().catch(() => null),
        api.getCompanies().catch(() => []),
      ]);
      setData(perfRes);
      setCurrentUser(userRes);
      setCompanies(compRes || []);
    } catch (err: any) {
      console.error('Failed to load performance data:', err);
      setErrorMsg(err.message || 'Failed to load performance analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employeeMode]);

  const handleUpdateTarget = async (craId: string) => {
    if (newTargetValue < 1) return;
    try {
      await api.updateCRATarget(craId, newTargetValue);
      setEditingTargetCraId(null);
      setFeedback({ type: 'success', text: `Target successfully updated to ${newTargetValue} JDs/month.` });
      setTimeout(() => setFeedback(null), 4000);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update target' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
        <p className="text-purple-200/80 text-sm font-medium">Loading performance analytics...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-8 rounded-3xl bg-purple-950/40 border border-purple-800/50 text-center space-y-4">
        <p className="text-red-400 text-sm">{errorMsg || 'No performance data available.'}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const fallbackItem: CRAPerformanceItem = {
    cra_id: 'default',
    cra_name: 'Team Member',
    cra_email: '',
    monthly_jd_target: 20,
    jds_this_month: 0,
    target_progress_pct: 0,
    contacts_sourced: 0,
    outreach_sent: 0,
    outreach_by_channel: {},
    replies_received: 0,
    jds_received: 0,
    eligible_jds: 0,
    conversion_rate: 0,
    eligibility_rate: 0,
    contact_to_jd_ratio: 0,
    community_joins: 0,
    community_funnel: [],
    jd_funnel: [],
    channel_performance: [],
    attendance_status: 'logged_in',
    hours_worked: 0,
    sourced_roles_breakdown: [],
    total_companies_worked: 0,
    jds_sourced_all_time: 0,
    jds_sourced_this_month: 0,
    jds_received_this_month: 0,
  };

  // Active item to display
  const activeItem: CRAPerformanceItem =
    (employeeMode
      ? (currentUser ? data.cras?.find((c) => c.cra_id === currentUser.id || c.cra_email === currentUser.email) : null) || data.totals || data.cras?.[0]
      : selectedCraId === 'all'
        ? data.totals || data.cras?.[0]
        : data.cras?.find((c) => c.cra_id === selectedCraId) || data.totals || data.cras?.[0]) || fallbackItem;

  const targetProgress = Math.min(100, Math.round(activeItem.target_progress_pct || 0));

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/80 border-red-500/50 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <X className="h-5 w-5 text-red-400" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/90 via-purple-950/95 to-gray-950 border border-purple-800/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-purple-400" />
              {employeeMode ? 'Personal Scorecard' : 'Team Performance Analytics'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {employeeMode ? 'My Outreach & Target Performance' : 'Recruitment Team Target Tracking'}
          </h1>
          <p className="text-purple-200/70 text-sm max-w-2xl">
            Real-time tracking of sourced HR contacts, multi-channel outreach conversion, and verified JD yields against monthly targets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!employeeMode && data.cras.length > 1 && (
            <select
              value={selectedCraId}
              onChange={(e) => setSelectedCraId(e.target.value)}
              className="bg-purple-900/50 border border-purple-700/60 text-purple-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">📊 Team Aggregate View</option>
              {data.cras.map((c) => (
                <option key={c.cra_id} value={c.cra_id}>
                  👤 {c.cra_name} ({c.jds_this_month}/{c.monthly_jd_target} JDs)
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadData}
            title="Refresh metrics"
            className="p-2.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/50 border border-purple-700/60 text-purple-200 hover:text-white transition flex items-center gap-2 text-xs"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Target Progress Card */}
      <div className="p-6 rounded-3xl bg-purple-950/40 border border-purple-800/50 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Monthly Verified JD Target</h2>
              <p className="text-xs text-purple-300/70">
                Target achievement for current monthly cycle (
                {activeItem.cra_name || 'Team Total'})
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {activeItem.jds_this_month || 0}
            </span>
            <span className="text-sm font-semibold text-purple-300/70">
              / {activeItem.monthly_jd_target || 0} JDs
            </span>
            <span
              className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                targetProgress >= 100
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : targetProgress >= 50
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {targetProgress}% Complete
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-purple-950/80 rounded-full h-3.5 border border-purple-800/60 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              targetProgress >= 100
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-400'
            }`}
            style={{ width: `${Math.max(4, targetProgress)}%` }}
          />
        </div>
      </div>

      {/* 4 Core Metric KPI Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-800/50 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70">Contacts Sourced</span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatIndianNumber(activeItem.contacts_sourced)}
          </div>
          <p className="text-xs text-purple-300/60">
            Across {formatIndianNumber(activeItem.total_companies_worked || 0)} companies
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-800/50 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70">Outreach Sent</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatIndianNumber(activeItem.outreach_sent)}
          </div>
          <p className="text-xs text-purple-300/60">
            {formatIndianNumber(activeItem.replies_received)} replies (
            {activeItem.outreach_sent > 0
              ? Math.round((activeItem.replies_received / activeItem.outreach_sent) * 100)
              : 0}
            % response)
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-800/50 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70">JDs Received</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatIndianNumber(activeItem.jds_received)}
          </div>
          <p className="text-xs text-purple-300/60">
            {formatIndianNumber(activeItem.eligible_jds)} verified eligible for hiring
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-800/50 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70">Conversion Yield</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {activeItem.conversion_rate || 0}%
          </div>
          <p className="text-xs text-purple-300/60">
            {activeItem.eligibility_rate || 0}% JD qualification rate
          </p>
        </div>
      </div>

      {/* Channel Breakdown & Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance */}
        <div className="p-6 rounded-3xl bg-purple-950/40 border border-purple-800/50 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-400" />
              Channel Performance Breakdown
            </h3>
          </div>

          <div className="space-y-3">
            {(activeItem.channel_performance || []).length > 0 ? (
              activeItem.channel_performance.map((ch) => (
                <div
                  key={ch.channel}
                  className="p-3.5 rounded-2xl bg-purple-900/30 border border-purple-700/40 flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white capitalize">{ch.channel}</p>
                    <p className="text-[11px] text-purple-300/70">
                      {formatIndianNumber(ch.sent)} sent • {formatIndianNumber(ch.replied)} replies
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-purple-200">
                      {formatIndianNumber(ch.jds_yielded)} JDs
                    </p>
                    <p className="text-[11px] text-emerald-400 font-semibold">
                      {ch.conversion_rate || 0}% conversion
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-purple-300/60 text-center py-6">
                No channel outreach logged for this period yet.
              </p>
            )}
          </div>
        </div>

        {/* Funnel Overview */}
        <div className="p-6 rounded-3xl bg-purple-950/40 border border-purple-800/50 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Recruitment Conversion Funnel
            </h3>
          </div>

          <div className="space-y-3">
            {[
              {
                stage: 'HR Contacts Sourced',
                count: activeItem.contacts_sourced,
                pct: '100%',
                color: 'bg-purple-600',
              },
              {
                stage: 'Outreach Initiated',
                count: activeItem.outreach_sent,
                pct:
                  activeItem.contacts_sourced > 0
                    ? `${Math.min(100, Math.round((activeItem.outreach_sent / activeItem.contacts_sourced) * 100))}%`
                    : '0%',
                color: 'bg-indigo-600',
              },
              {
                stage: 'Replies Received',
                count: activeItem.replies_received,
                pct:
                  activeItem.outreach_sent > 0
                    ? `${Math.min(100, Math.round((activeItem.replies_received / activeItem.outreach_sent) * 100))}%`
                    : '0%',
                color: 'bg-blue-600',
              },
              {
                stage: 'Verified JDs Onboarded',
                count: activeItem.jds_received,
                pct:
                  activeItem.replies_received > 0
                    ? `${Math.min(100, Math.round((activeItem.jds_received / activeItem.replies_received) * 100))}%`
                    : '0%',
                color: 'bg-emerald-600',
              },
            ].map((step, idx) => (
              <div
                key={step.stage}
                className="p-3.5 rounded-2xl bg-purple-900/30 border border-purple-700/40 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-200">
                    {idx + 1}. {step.stage}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{formatIndianNumber(step.count)}</span>
                    <span className="text-[11px] text-purple-300/70">({step.pct})</span>
                  </div>
                </div>
                <div className="w-full bg-purple-950/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${step.color} rounded-full`}
                    style={{ width: step.pct }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Leaderboard (Shown in Admin or when team list is available) */}
      {!employeeMode && data.cras.length > 0 && (
        <div className="p-6 rounded-3xl bg-purple-950/40 border border-purple-800/50 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-400" />
              CRA Team Leaderboard & Target Controls
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-purple-200">
              <thead className="bg-purple-900/40 text-purple-300 font-semibold border-b border-purple-800/60">
                <tr>
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Companies Uploaded</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Sourced Contacts</th>
                  <th className="py-3 px-4">Outreach</th>
                  <th className="py-3 px-4">Monthly Target</th>
                  <th className="py-3 px-4">Achievement</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-800/30">
                {data.cras.map((cra) => {
                  const pct = Math.round(cra.target_progress_pct || 0);
                  const isEditing = editingTargetCraId === cra.cra_id;

                  const normMem = cra.cra_name.toLowerCase().split(' ')[0];
                  const compCount = companies.filter((c) => {
                    const entered = (c.entered_by_name || c.created_by || (c.creator ? c.creator.name : '')).toLowerCase();
                    return entered.includes(normMem);
                  }).length;

                  return (
                    <tr key={cra.cra_id} className="hover:bg-purple-900/20 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{cra.cra_name}</div>
                        <div className="text-[11px] text-purple-300/60">{cra.cra_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 font-bold text-white bg-indigo-900/40 border border-indigo-700/50 px-2.5 py-1 rounded-lg text-xs">
                          <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{compCount}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            cra.attendance_status === 'logged_in'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {cra.attendance_status === 'logged_in' ? 'Active' : 'Offline'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {formatIndianNumber(cra.contacts_sourced)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white">
                          {formatIndianNumber(cra.outreach_sent)}
                        </span>{' '}
                        <span className="text-[11px] text-purple-300/60">
                          ({cra.replies_received} replies)
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={newTargetValue}
                              onChange={(e) => setNewTargetValue(parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 bg-purple-900 border border-purple-600 rounded text-xs text-white"
                            />
                            <button
                              onClick={() => handleUpdateTarget(cra.cra_id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingTargetCraId(null)}
                              className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-semibold text-white">
                            {cra.jds_this_month} / {cra.monthly_jd_target} JDs
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-purple-950 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${
                                pct >= 100
                                  ? 'bg-emerald-500'
                                  : pct >= 50
                                  ? 'bg-purple-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                            />
                          </div>
                          <span className="font-bold text-white text-[11px]">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setEditingTargetCraId(cra.cra_id);
                              setNewTargetValue(cra.monthly_jd_target || 10);
                            }}
                            className="p-1.5 hover:bg-purple-800/60 rounded-lg text-purple-300 hover:text-white transition"
                            title="Edit monthly target"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
