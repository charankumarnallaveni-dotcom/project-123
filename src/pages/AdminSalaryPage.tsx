import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  DollarSign,
  TrendingUp,
  Download,
  Calendar,
  Sliders,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  User,
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  Info,
  Check,
  X,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { CRA, JD, Company, SalaryRecord } from '../types';
import { api } from '../services/api';
import { clientFallbackStore } from '../services/clientFallbackStore';
import { formatIndianNumber } from '../utils/formatters';

interface AdminSalaryPageProps {
  onNavigateToUser?: (userId: string) => void;
}

export const AdminSalaryPage: React.FC<AdminSalaryPageProps> = () => {
  const [users, setUsers] = useState<CRA[]>([]);
  const [jds, setJds] = useState<JD[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [searchQuery, setSearchQuery] = useState('');

  // Global Configurable Rate (₹ per converted JD)
  const [globalJdRate, setGlobalJdRate] = useState<number>(() => {
    const saved = localStorage.getItem('placemein_global_jd_rate');
    return saved ? parseInt(saved, 10) : 2500;
  });
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState<number>(globalJdRate);

  // Bonus overrides per CRA (stored in memory/localStorage)
  const [bonusMap, setBonusMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('placemein_cra_bonus_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Payout approval statuses (cra_id -> 'draft' | 'approved' | 'paid')
  const [statusMap, setStatusMap] = useState<Record<string, 'draft' | 'approved' | 'paid'>>(() => {
    try {
      const saved = localStorage.getItem('placemein_payout_status_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Modal to drill into specific converted JDs for a CRA
  const [inspectingCra, setInspectingCra] = useState<CRA | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [uList, jList, cList] = await Promise.all([
        api.getAdminUsers().catch(() => clientFallbackStore.getUsers(true)),
        api.getJDs().catch(() => clientFallbackStore.getJDs()),
        api.getCompanies().catch(() => clientFallbackStore.getCompanies()),
      ]);
      setUsers(uList || []);
      setJds(jList || []);
      setCompanies(cList || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSaveGlobalRate = () => {
    if (tempRate < 0) return;
    setGlobalJdRate(tempRate);
    localStorage.setItem('placemein_global_jd_rate', tempRate.toString());
    setIsEditingRate(false);
    setFeedback({
      type: 'success',
      text: `Default JD Conversion Payout Rate updated to ₹${formatIndianNumber(tempRate)} per JD`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleUpdateBonus = (craId: string, amount: number) => {
    const next = { ...bonusMap, [craId]: Math.max(0, amount) };
    setBonusMap(next);
    localStorage.setItem('placemein_cra_bonus_map', JSON.stringify(next));
  };

  const handleToggleStatus = (craId: string) => {
    const current = statusMap[craId] || 'draft';
    const next: 'draft' | 'approved' | 'paid' = current === 'draft' ? 'approved' : current === 'approved' ? 'paid' : 'draft';
    const nextMap: Record<string, 'draft' | 'approved' | 'paid'> = { ...statusMap, [craId]: next };
    setStatusMap(nextMap);
    localStorage.setItem('placemein_payout_status_map', JSON.stringify(nextMap));
    setFeedback({
      type: 'success',
      text: `Status updated to ${next.toUpperCase()} for team member.`,
    });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Helper: check if a JD matches selected month
  const isJdInMonth = (jd: JD, monthStr: string) => {
    if (!monthStr || monthStr === 'all') return true;
    const dateStr = jd.purchase_date || jd.date_found || jd.created_at;
    if (!dateStr) return true;
    return dateStr.startsWith(monthStr);
  };

  // Check if JD is converted / purchased
  const isJdConverted = (jd: JD) => {
    if (jd.is_purchased === true) return true;
    if (jd.status === 'converted' || jd.status === 'purchased') return true;
    // Check if raw text or title indicates converted engagement
    const text = (jd.raw_text + ' ' + jd.title).toLowerCase();
    return jd.is_verified && (text.includes('purchased') || text.includes('converted') || text.includes('engaged'));
  };

  // Toggle JD conversion status directly from the modal!
  const handleToggleJdConversion = (jdId: string) => {
    const updatedJds = jds.map((j) => {
      if (j.id !== jdId) return j;
      const currentlyConverted = isJdConverted(j);
      return {
        ...j,
        is_purchased: !currentlyConverted,
        status: (!currentlyConverted ? 'converted' : 'active') as any,
        purchase_date: !currentlyConverted ? new Date().toISOString() : undefined,
      };
    });
    setJds(updatedJds);
    clientFallbackStore.saveJDs(updatedJds);
    setFeedback({
      type: 'success',
      text: 'JD conversion status updated and salary recalculated.',
    });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Compute Salary Records per CRA
  const salaryRecords: SalaryRecord[] = useMemo(() => {
    return users
      .filter((u) => u.is_active !== false)
      .map((user) => {
        // Find all JDs for this CRA in the period
        const userJds = jds.filter((j) => {
          const isOwner =
            j.created_by === user.id ||
            (j.creator && j.creator.id === user.id) ||
            (user.name && j.raw_text?.includes(user.name));
          return isOwner && isJdInMonth(j, selectedMonth);
        });

        // Converted JDs
        const convertedJds = userJds.filter(isJdConverted);

        const baseSalary = user.base_salary !== undefined ? user.base_salary : 25000;
        const rate = user.jd_payout_rate !== undefined ? user.jd_payout_rate : globalJdRate;
        const jdIncentive = convertedJds.length * rate;
        const bonus = bonusMap[user.id] || 0;
        const totalPayout = baseSalary + jdIncentive + bonus;

        return {
          cra_id: user.id,
          cra_name: user.name,
          emp_id: user.emp_id || 'PM-EMP',
          email: user.email,
          role: user.role,
          base_salary: baseSalary,
          jd_payout_rate: rate,
          monthly_jd_target: user.monthly_jd_target || 10,
          converted_jds_count: convertedJds.length,
          converted_jds: convertedJds,
          total_jds_count: userJds.length,
          total_contacts_count: 0,
          jd_incentive_amount: jdIncentive,
          bonus_amount: bonus,
          total_payout: totalPayout,
          month: selectedMonth,
          status: statusMap[user.id] || 'draft',
        };
      });
  }, [users, jds, selectedMonth, globalJdRate, bonusMap, statusMap]);

  const filteredRecords = salaryRecords.filter(
    (r) =>
      r.cra_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.emp_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Aggregated Stats
  const totalPayroll = salaryRecords.reduce((sum, r) => sum + r.total_payout, 0);
  const totalConvertedJds = salaryRecords.reduce((sum, r) => sum + r.converted_jds_count, 0);
  const totalBaseSalaries = salaryRecords.reduce((sum, r) => sum + r.base_salary, 0);
  const totalIncentives = salaryRecords.reduce((sum, r) => sum + r.jd_incentive_amount, 0);

  // Export to CSV
  const handleExportSalaryCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Role',
      'Email',
      'Month',
      'Base Salary (INR)',
      'Converted JDs Count',
      'Incentive Rate (INR/JD)',
      'Total Incentive (INR)',
      'Discretionary Bonus (INR)',
      'Total Net Payout (INR)',
      'Approval Status',
    ].join(',');

    const rows = salaryRecords.map((r) =>
      [
        `"${r.emp_id || ''}"`,
        `"${r.cra_name}"`,
        `"${r.role}"`,
        `"${r.email}"`,
        `"${r.month}"`,
        r.base_salary,
        r.converted_jds_count,
        r.jd_payout_rate,
        r.jd_incentive_amount,
        r.bonus_amount,
        r.total_payout,
        `"${r.status.toUpperCase()}"`,
      ].join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `placemein_payroll_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in text-gray-100">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-gray-900 to-amber-950/30 p-6 rounded-3xl border border-amber-800/40 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Admin Leadership Only
            </span>
            <span className="text-xs text-amber-400/80 font-mono">Formula: Base + (Converted JDs × Rate) + Bonus</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Award className="h-7 w-7 text-amber-400" />
            <span>CRA Salary & JD Conversion Payouts</span>
          </h1>
          <p className="text-xs text-amber-200/70 mt-1 max-w-2xl">
            Automated compensation module tracking verified JD engagements, client purchases, and periodic incentive payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportSalaryCSV}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-900/30 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export Payroll CSV</span>
          </button>
        </div>
      </div>

      {/* Global JD Rate Configurator Bar */}
      <div className="bg-gray-900/90 border border-amber-700/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Configurable JD Conversion Payout Rate</span>
              <span className="text-[10px] text-amber-400 font-normal">(Per Converted / Purchased JD)</span>
            </h2>
            <p className="text-[11px] text-gray-400">
              Current benchmark payout: <strong className="text-amber-300 font-semibold">₹{formatIndianNumber(globalJdRate)}</strong> per converted JD
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditingRate ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">₹</span>
              <input
                type="number"
                min="0"
                step="250"
                value={tempRate}
                onChange={(e) => setTempRate(parseInt(e.target.value) || 0)}
                className="w-28 bg-gray-950 border border-amber-500 rounded-lg px-2.5 py-1 text-xs text-white font-bold"
              />
              <button
                onClick={handleSaveGlobalRate}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTempRate(globalJdRate);
                  setIsEditingRate(false);
                }}
                className="px-2.5 py-1 bg-gray-800 text-gray-400 rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempRate(globalJdRate);
                setIsEditingRate(true);
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-700/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <span>Adjust Rate</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
              : 'bg-red-950/60 border border-red-800/80 text-red-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/80 border border-gray-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold">Total Net Payroll</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white">₹{formatIndianNumber(totalPayroll)}</p>
          <span className="text-[11px] text-gray-500 mt-1 block">Sum of base + incentives + bonuses</span>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold">Converted JDs (Purchases)</span>
            <Award className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{totalConvertedJds}</p>
          <span className="text-[11px] text-gray-500 mt-1 block">Triggered conversion payouts</span>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold">Total Incentive Pool</span>
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400">₹{formatIndianNumber(totalIncentives)}</p>
          <span className="text-[11px] text-gray-500 mt-1 block">Generated from JD engagements</span>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="font-semibold">Base Salaries Pool</span>
            <CreditCard className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400">₹{formatIndianNumber(totalBaseSalaries)}</p>
          <span className="text-[11px] text-gray-500 mt-1 block">Fixed monthly base salary pool</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-gray-300">Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-950 border border-gray-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value="2026-09">September 2026 (Current)</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="all">All Time / Cumulative</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search CRA by name, email, EMP-ID..."
            className="w-full sm:w-64 bg-gray-950 border border-gray-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Primary Salary Records Table */}
      <div className="border border-gray-800 rounded-2xl overflow-hidden bg-gray-900/60 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-800/90 text-gray-300 font-bold uppercase tracking-wider text-[11px] border-b border-gray-700">
              <tr>
                <th className="p-3.5">CRA Team Member</th>
                <th className="p-3.5 text-right">Base Salary</th>
                <th className="p-3.5 text-center">JD Target</th>
                <th className="p-3.5 text-center">Converted JDs</th>
                <th className="p-3.5 text-right">Rate / JD</th>
                <th className="p-3.5 text-right">JD Incentive</th>
                <th className="p-3.5 text-right">Bonus (₹)</th>
                <th className="p-3.5 text-right">Net Payout</th>
                <th className="p-3.5 text-center">Payout Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredRecords.map((rec) => (
                <tr key={rec.cra_id} className="hover:bg-gray-800/30 transition">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-purple-900/50 border border-purple-700/50 flex items-center justify-center font-bold text-xs text-purple-300">
                        {rec.cra_name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-white text-xs block">{rec.cra_name}</span>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {rec.emp_id} • {rec.role === 'admin' ? 'Leadership' : 'CRA Specialist'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5 text-right font-semibold text-gray-200">
                    ₹{formatIndianNumber(rec.base_salary)}
                  </td>

                  <td className="p-3.5 text-center text-gray-300">
                    <span className="font-bold text-amber-300">{rec.converted_jds_count}</span>
                    <span className="text-gray-500"> / {rec.monthly_jd_target}</span>
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const targetCra = users.find((u) => u.id === rec.cra_id);
                        if (targetCra) setInspectingCra(targetCra);
                      }}
                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                      title="Click to view details of converted JDs"
                    >
                      <Award className="h-3 w-3" />
                      <span>{rec.converted_jds_count} JDs</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>

                  <td className="p-3.5 text-right text-gray-400 font-mono">
                    ₹{formatIndianNumber(rec.jd_payout_rate)}
                  </td>

                  <td className="p-3.5 text-right font-bold text-emerald-400 font-mono">
                    +₹{formatIndianNumber(rec.jd_incentive_amount)}
                  </td>

                  <td className="p-3.5 text-right">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={rec.bonus_amount || ''}
                      placeholder="0"
                      onChange={(e) => handleUpdateBonus(rec.cra_id, parseInt(e.target.value) || 0)}
                      className="w-20 bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-right text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </td>

                  <td className="p-3.5 text-right font-extrabold text-sm text-white">
                    ₹{formatIndianNumber(rec.total_payout)}
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(rec.cra_id)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition flex items-center gap-1 mx-auto ${
                        rec.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : rec.status === 'approved'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {rec.status === 'paid' && <Check className="h-2.5 w-2.5" />}
                      <span>{rec.status}</span>
                    </button>
                  </td>

                  <td className="p-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const targetCra = users.find((u) => u.id === rec.cra_id);
                        if (targetCra) setInspectingCra(targetCra);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-medium text-xs hover:underline"
                    >
                      Audit JDs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Converted JDs Modal */}
      {inspectingCra && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto"
          onClick={() => setInspectingCra(null)}
        >
          <div
            className="bg-gray-900 border border-amber-700/60 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800 bg-gray-950 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-400" />
                  <span>JD Conversion Audit — {inspectingCra.name}</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Verified Job Descriptions credited for payout calculation in {selectedMonth}
                </p>
              </div>
              <button
                onClick={() => setInspectingCra(null)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {jds
                .filter((j) => {
                  const isOwner =
                    j.created_by === inspectingCra.id ||
                    (j.creator && j.creator.id === inspectingCra.id) ||
                    (inspectingCra.name && j.raw_text?.includes(inspectingCra.name));
                  return isOwner;
                })
                .map((jd) => {
                  const converted = isJdConverted(jd);
                  return (
                    <div
                      key={jd.id}
                      className={`p-4 rounded-xl border transition flex items-start justify-between gap-3 ${
                        converted
                          ? 'bg-amber-950/20 border-amber-700/40'
                          : 'bg-gray-800/40 border-gray-700/40 opacity-75'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs">{jd.title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-300">
                            {jd.company?.name || 'Company'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              converted
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {converted ? 'Converted / Purchased' : 'Standard JD'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 line-clamp-2">{jd.raw_text}</p>
                        <p className="text-[10px] text-gray-500">
                          Date: {jd.date_found || 'Recent'} • Verification: {jd.is_verified ? 'Verified' : 'Pending'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleToggleJdConversion(jd.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                          converted
                            ? 'bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {converted ? 'Mark as Unconverted' : 'Mark as Converted'}
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end">
              <button
                onClick={() => setInspectingCra(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
