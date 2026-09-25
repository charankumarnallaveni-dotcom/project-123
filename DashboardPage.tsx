import React, { useEffect, useState } from 'react';
import { DashboardStats, CRA, Task, LeaveRequest } from '../types';
import { api } from '../services/api';
import { formatIndianNumber } from '../utils/formatters';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  Send, 
  TrendingUp, 
  ArrowUpRight, 
  Calendar, 
  CheckSquare, 
  Clock, 
  ShieldCheck, 
  User, 
  Sparkles, 
  FileText, 
  Award,
  Key,
  Briefcase,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import { SystemReportModal } from '../components/SystemReportModal';
import { TaskNotificationModal } from '../components/TaskNotificationModal';

interface Props {
  setActiveTab: (tab: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ setActiveTab }) => {
  const [currentUser, setCurrentUser] = useState<CRA | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [loginTime, setLoginTime] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [snoozedTaskIds, setSnoozedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    // Read login timestamp from localStorage or default to current IST time
    const storedTime = localStorage.getItem('placemein:login_timestamp');
    if (storedTime) {
      setLoginTime(storedTime);
    } else {
      const nowFormatted = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setLoginTime(`${nowFormatted} IST`);
      localStorage.setItem('placemein:login_timestamp', `${nowFormatted} IST`);
    }

    // Regenerate recurring tasks according to their frequency
    try {
      api.regenerateRecurringTasks();
    } catch (_) {}

    Promise.all([
      api.getCurrentCRA().catch(() => null),
      api.getDashboardStats().catch(() => null),
      api.getTasks().catch(() => []),
      api.getLeaves().catch(() => []),
    ]).then(([userRes, statsRes, tasksRes, leavesRes]) => {
      setCurrentUser(userRes);
      setStats(statsRes);
      
      // Filter tasks assigned to me or created by me
      if (userRes) {
        const filteredTasks = tasksRes.filter(
          (t: Task) => t.assignee_id === userRes.id || t.assigned_by_id === userRes.id
        );
        setMyTasks(filteredTasks);

        const filteredLeaves = leavesRes.filter(
          (l: LeaveRequest) => l.cra_id === userRes.id
        );
        setMyLeaves(filteredLeaves);
      } else {
        setMyTasks(tasksRes);
        setMyLeaves(leavesRes);
      }

      setLoading(false);
    });
  }, []);

  const handleDismissNotification = (taskId: string) => {
    api.dismissTaskNotification(taskId);
    setDismissedTaskIds((prev) => [...prev, taskId]);
  };

  const handleSnoozeNotification = (taskId: string, minutes: number) => {
    api.snoozeTaskNotification(taskId, minutes);
    setSnoozedTaskIds((prev) => [...prev, taskId]);
  };

  // Newly assigned action items popup notification:
  // Must be assigned to this user, not completed, not dismissed, and snooze period expired
  const pendingNotificationTasks = myTasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (t.is_dismissed || dismissedTaskIds.includes(t.id)) return false;
    if (snoozedTaskIds.includes(t.id)) return false;
    if (t.snoozed_until && new Date(t.snoozed_until).getTime() > Date.now()) return false;
    if (currentUser && t.assignee_id && t.assignee_id !== currentUser.id) return false;
    return true;
  });

  const getDetailedRoleTitle = (email?: string, name?: string, role?: string) => {
    const e = email?.toLowerCase() || '';
    const n = name?.toLowerCase() || '';

    if (e.includes('aravindreddy') || n.includes('aravind') || e.includes('aravind')) {
      return { title: 'CRA for Placemein', access: 'Super Admin & CRA Portal', badgeColor: 'bg-purple-500/20 text-purple-200 border-purple-400/40' };
    }
    if (e.includes('mansi') || n.includes('mansi')) {
      return { title: 'Team Leader & Operations Manager', access: 'Admin Portal Access', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    if (e.includes('vineela') || e.includes('vinella') || n.includes('vineela')) {
      return { title: 'HR Lead & Talent Recruiter', access: 'Admin Portal Access', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    if (role === 'admin') {
      return { title: 'Executive Admin', access: 'Admin Portal Access', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    return { title: 'Candidate Relationship Associate', access: 'CRA Sourcing Portal', badgeColor: 'bg-purple-500/20 text-purple-200 border-purple-400/40' };
  };

  if (loading) {
    return <div className="p-12 text-center text-purple-300 font-semibold animate-pulse">Loading your personal dashboard...</div>;
  }

  const currentStats: DashboardStats = stats || {
    total_verified_opportunities: 0,
    total_contacts: 0,
    total_companies: 0,
    active_campaign_count: 0,
    unique_companies_onboarded: 0,
    active_placement_drives: 0,
    jd_received_rate: 0,
    community_funnel: [],
    jd_funnel: [],
    outreach_by_channel: [],
    outreach_by_status: [],
  };

  const userName = currentUser?.name || 'Team Member';
  const isUserAdmin = currentUser?.role === 'admin';
  const roleInfo = getDetailedRoleTitle(currentUser?.email, currentUser?.name, currentUser?.role);
  const pendingLeaves = myLeaves.filter(l => l.status === 'pending').length;
  const approvedLeaves = myLeaves.filter(l => l.status === 'approved').length;
  const pendingTasks = myTasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Warm Personal Greeting Hero Banner */}
      <div className="bg-gradient-to-r from-purple-900/90 via-purple-950/95 to-gray-950 border border-purple-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2 sm:space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-purple-500/20 text-purple-200 text-xs font-black px-2.5 sm:px-3 py-1 rounded-full border border-purple-400/30 flex items-center gap-1.5 shadow-inner">
                <Sparkles className="h-3.5 w-3.5 text-purple-300" />
                <span>Personal Hub</span>
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-extrabold px-2.5 sm:px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 shadow-inner">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span>Logged In Today: {loginTime}</span>
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              {userName.toLowerCase().includes('aravind') ? 'Aravind Reddy' : userName}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-purple-300 to-indigo-200">
                CRA for Placemein
              </span>
            </h1>
            
            <p className="text-xs sm:text-sm text-purple-200/90 font-medium max-w-xl leading-relaxed">
              Active Session: Logged in at <strong className="text-white font-bold">{loginTime}</strong> as <strong className="text-purple-200 font-bold">{roleInfo.title}</strong>.
            </p>
          </div>

          {/* Detailed Role Badge Box - Full width on mobile, auto width on tablet/desktop */}
          <div className="w-full md:w-auto bg-purple-900/50 border border-purple-700/60 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 flex items-center space-x-3 sm:space-x-4 shrink-0 shadow-xl backdrop-blur-md">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-purple-600 border border-purple-300/40 flex items-center justify-center text-white text-base sm:text-lg font-black shadow-md shrink-0">
              {isUserAdmin ? <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-amber-300" /> : <User className="h-5 w-5 sm:h-6 sm:w-6 text-purple-200" />}
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-white text-xs sm:text-sm leading-tight truncate">{userName}</p>
              <p className="text-[11px] sm:text-xs font-semibold text-purple-300/90 mt-0.5 truncate">{roleInfo.title}</p>
              <span className={`inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${roleInfo.badgeColor}`}>
                {roleInfo.access}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Personal Role & Login Details Section - 1 col on mobile, 2 cols on tablet, 4 cols on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
        {/* Box 1: Exact Login Time */}
        <div className="bg-purple-950/70 border border-purple-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80">Login Timestamp</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">{loginTime}</h3>
          <p className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Session Active (IST)
          </p>
        </div>

        {/* Box 2: Designation & Role */}
        <div className="bg-purple-950/70 border border-purple-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80">Current Designation</span>
            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
              <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <h3 className="text-xs sm:text-sm font-black text-white truncate">{roleInfo.title}</h3>
          <p className="text-[11px] text-purple-300/80 font-semibold truncate">{currentUser?.email}</p>
        </div>

        {/* Box 3: Access Level & Privileges */}
        <div className="bg-purple-950/70 border border-purple-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80">Access Level</span>
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30">
              <Key className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <h3 className="text-xs sm:text-sm font-black text-amber-300 truncate">{roleInfo.access}</h3>
          <p className="text-[11px] text-purple-300/80 font-semibold truncate">{isUserAdmin ? 'Task Delegation & Admin Active' : 'Outreach & Sourcing Enabled'}</p>
        </div>

        {/* Box 4: Leave Balance */}
        <div className="bg-purple-950/70 border border-purple-800/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80">Leave Balance</span>
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">14 Days</h3>
          <p className="text-[11px] text-purple-300/80 font-semibold">{approvedLeaves} Approved • {pendingLeaves} Pending</p>
        </div>
      </div>

      {/* Personal Quick Actions Shortcuts - 1 col on mobile (<640px), 3 cols on tablet (640-1024px), 6 cols on desktop (1024px+) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <button
          onClick={() => setActiveTab('team-sheets')}
          className="bg-gradient-to-br from-purple-900/70 to-indigo-950/80 hover:from-purple-800/80 hover:to-indigo-900/90 border border-purple-600/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition-all hover:scale-[1.02] shadow-lg group flex items-center space-x-3 min-h-[52px] cursor-pointer"
        >
          <div className="p-2.5 sm:p-3 bg-purple-500/20 text-purple-300 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white group-hover:text-purple-200 truncate">Team Worksheets</p>
            <p className="text-[11px] text-purple-300/80 font-semibold truncate">Separate Sheets</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className="bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition-all hover:scale-[1.02] shadow-lg group flex items-center space-x-3 min-h-[52px] cursor-pointer"
        >
          <div className="p-2.5 sm:p-3 bg-purple-600/20 text-purple-300 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white group-hover:text-purple-200 truncate">Apply for Leave</p>
            <p className="text-[11px] text-purple-300/70 truncate">{myLeaves.length} Requests</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className="bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition-all hover:scale-[1.02] shadow-lg group flex items-center space-x-3 min-h-[52px] cursor-pointer"
        >
          <div className="p-2.5 sm:p-3 bg-indigo-600/20 text-indigo-300 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white group-hover:text-indigo-200 truncate">My Tasks</p>
            <p className="text-[11px] text-purple-300/70 truncate">{pendingTasks} Pending</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('jd-intake')}
          className="bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition-all hover:scale-[1.02] shadow-lg group flex items-center space-x-3 min-h-[52px] cursor-pointer"
        >
          <div className="p-2.5 sm:p-3 bg-emerald-600/20 text-emerald-300 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white group-hover:text-emerald-200 truncate">+ Intake New JD</p>
            <p className="text-[11px] text-purple-300/70 truncate">Upload Document</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className="bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition-all hover:scale-[1.02] shadow-lg group flex items-center space-x-3 min-h-[52px] cursor-pointer"
        >
          <div className="p-2.5 sm:p-3 bg-amber-600/20 text-amber-300 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white group-hover:text-amber-200 truncate">My Performance</p>
            <p className="text-[11px] text-purple-300/70 truncate">View Analytics</p>
          </div>
        </button>

        <button
          onClick={() => setShowReportModal(true)}
          className="bg-gradient-to-br from-indigo-900/60 to-purple-950/70 hover:from-indigo-800/70 hover:to-purple-900/80 border border-indigo-500/40 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left transition-all hover:scale-[1.02] shadow-lg group flex items-center space-x-3 min-h-[52px] cursor-pointer"
        >
          <div className="p-2.5 sm:p-3 bg-indigo-500/20 text-indigo-300 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white group-hover:text-indigo-200 truncate">System Report</p>
            <p className="text-[11px] text-indigo-300/80 font-semibold flex items-center gap-1 truncate">
              <span>Export PDF</span>
              <span className="text-[9px] bg-indigo-500/30 px-1 rounded text-indigo-200 uppercase font-black">PDF</span>
            </p>
          </div>
        </button>
      </div>

      {/* Two Column Layout: My Assigned Tasks & My Leave Applications - 1 col on mobile, 2 cols on tablet & desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {/* Left: My Assigned Tasks */}
        <div className="bg-purple-950/60 border border-purple-800/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-purple-800/40">
            <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
              <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
              <span>My Assigned Tasks</span>
            </h3>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs font-bold text-purple-300 hover:text-white hover:underline flex items-center gap-1 min-h-[44px] sm:min-h-0"
            >
              <span>View Board</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {myTasks.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-purple-300/70 space-y-2">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 opacity-60" />
              <p className="font-semibold text-white">All caught up!</p>
              <p>No pending tasks assigned to you right now.</p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {myTasks.slice(0, 4).map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-purple-900/30 border border-purple-700/40 flex items-center justify-between gap-3 hover:border-purple-500/50 transition"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-xs truncate">{task.title}</h4>
                    <p className="text-[11px] text-purple-300/70 truncate">{task.description}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
                    task.status === 'completed' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : task.status === 'in_progress' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: My Recent Leave Applications */}
        <div className="bg-purple-950/60 border border-purple-800/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-purple-800/40">
            <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
              <span>My Recent Leaves</span>
            </h3>
            <button
              onClick={() => setActiveTab('leaves')}
              className="text-xs font-bold text-purple-300 hover:text-white hover:underline flex items-center gap-1 min-h-[44px] sm:min-h-0"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {myLeaves.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-purple-300/70 space-y-2">
              <Calendar className="h-8 w-8 mx-auto text-purple-400 opacity-60" />
              <p className="font-semibold text-white">No leave history</p>
              <p>You haven't submitted any leave applications yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {myLeaves.slice(0, 4).map((leave) => (
                <div 
                  key={leave.id} 
                  className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-purple-900/30 border border-purple-700/40 flex items-center justify-between gap-3 hover:border-purple-500/50 transition"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-xs capitalize">{leave.leave_type} Leave</h4>
                    <p className="text-[11px] text-purple-300/70 truncate">{leave.start_date} to {leave.end_date}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
                    leave.status === 'approved' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : leave.status === 'rejected' 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subtle Team Summary Banner (At Bottom) */}
      <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl sm:rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 text-xs text-purple-300/80">
        <div className="flex items-center space-x-3">
          <Building2 className="h-5 w-5 text-purple-400 shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-white font-bold">{currentStats.unique_companies_onboarded ?? currentStats.total_companies} Companies Onboarded</strong> & <strong className="text-white font-bold">{currentStats.total_contacts} Sourced HR Contacts</strong> across team.
          </span>
        </div>

        <button
          onClick={() => setActiveTab('crm')}
          className="text-xs font-bold text-purple-300 hover:text-white hover:underline shrink-0 min-h-[44px] sm:min-h-0 flex items-center"
        >
          View Company Directory →
        </button>
      </div>

      {/* Printable System Report Modal */}
      <SystemReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />

      {/* Action Item Assigned Popup Notification */}
      <TaskNotificationModal
        tasks={pendingNotificationTasks}
        onDismiss={handleDismissNotification}
        onSnooze={handleSnoozeNotification}
        onViewTask={() => setActiveTab('tasks')}
      />
    </div>
  );
};
