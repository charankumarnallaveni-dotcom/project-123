import React, { useEffect, useState } from 'react';
import { Task, LeaveRequest, CRA, LeaveType, LeaveStatus, TaskStatus, TaskPriority } from '../types';
import { api } from '../services/api';
import { formatIndianDate } from '../utils/formatters';
import {
  CheckSquare,
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  User,
  Filter,
  RefreshCw,
  Send,
  X,
  Building2,
  Sparkles,
} from 'lucide-react';

interface TaskManagementPageProps {
  employeeMode?: boolean;
}

export const TaskManagementPage: React.FC<TaskManagementPageProps> = ({ employeeMode = false }) => {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'leaves'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [cras, setCras] = useState<CRA[]>([]);
  const [currentUser, setCurrentUser] = useState<CRA | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all');

  // Modals / forms
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);

  // Create Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Apply Leave Form State
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic feedback and confirmation states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [leaveToCancel, setLeaveToCancel] = useState<string | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((current) => (current?.text === text ? null : current));
    }, 4500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [user, craList] = await Promise.all([
        api.getCurrentCRA().catch(() => null),
        api.getCRAs().catch(() => []),
      ]);
      setCurrentUser(user);
      setCras(craList);

      const [taskList, leaveList] = await Promise.all([
        api.getTasks(
          undefined,
          employeeMode && user?.id ? user.id : undefined
        ).catch(() => []),
        api.getLeaves(
          undefined,
          !employeeMode // all employees if admin
        ).catch(() => []),
      ]);

      setTasks(taskList);
      setLeaves(leaveList);
      if (user?.id && !taskAssigneeId) {
        setTaskAssigneeId(user.id);
      }
    } catch (err) {
      console.error('Failed to load tasks and leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employeeMode]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskAssigneeId) return;

    setIsSubmitting(true);
    try {
      await api.createTask({
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        assignee_id: taskAssigneeId,
        priority: taskPriority,
        due_date: taskDueDate || undefined,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? recurringFrequency : undefined,
      });
      setShowCreateTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
      setIsRecurring(false);
      setRecurringFrequency('weekly');
      showNotification('success', isRecurring ? `Recurring task (${recurringFrequency}) dispatched successfully.` : 'Task dispatched successfully.');
      await loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await api.updateTask(taskId, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      showNotification('success', `Task marked as ${newStatus.replace('_', ' ')}.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update task status');
    }
  };

  const executeDeleteTask = async () => {
    if (!taskToDelete) return;
    const id = taskToDelete;
    setTaskToDelete(null);
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      showNotification('success', 'Task deleted.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete task');
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
      showNotification('error', 'Please fill out all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.applyLeave({
        leave_type: leaveType,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        reason: leaveReason.trim(),
      });
      setShowApplyLeaveModal(false);
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
      showNotification('success', 'Leave request submitted for review.');
      await loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLeaveStatus = async (leaveId: string, status: LeaveStatus) => {
    try {
      await api.updateLeaveStatus(leaveId, status);
      showNotification('success', `Leave request ${status}.`);
      await loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update leave status');
    }
  };

  const executeCancelLeave = async () => {
    if (!leaveToCancel) return;
    const id = leaveToCancel;
    setLeaveToCancel(null);
    try {
      await api.cancelLeave(id);
      showNotification('success', 'Leave request cancelled.');
      await loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to cancel leave');
    }
  };

  // Filtered lists
  const filteredTasks = tasks.filter((t) => {
    if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
    if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
    return true;
  });

  const filteredLeaves = leaves.filter((l) => {
    if (leaveStatusFilter !== 'all' && l.status !== leaveStatusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200 shadow-lg'
              : 'bg-red-950/80 border-red-500/50 text-red-200 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/90 via-purple-950/95 to-gray-950 border border-purple-800/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-purple-400" />
              {employeeMode ? 'Personal Workspace' : 'Team Operations'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {employeeMode ? 'My Action Items & Leave Tracker' : 'Task Dispatch & Team Leave Portal'}
          </h1>
          <p className="text-purple-200/70 text-sm max-w-2xl">
            {employeeMode
              ? 'Organize your high-priority recruitment follow-ups, outreach quotas, and submit time-off requests.'
              : 'Assign outreach tasks, monitor deliverables across CRAs, and approve or reject employee leave requests.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeSubTab === 'tasks') {
                setShowCreateTaskModal(true);
              } else {
                setShowApplyLeaveModal(true);
              }
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>{activeSubTab === 'tasks' ? 'New Task' : 'Apply Leave'}</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-2.5 rounded-xl bg-purple-900/50 hover:bg-purple-800/50 border border-purple-700/60 text-purple-200 hover:text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Sub tabs: Tasks vs Leaves */}
      <div className="flex items-center gap-3 border-b border-purple-800/50 pb-3">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'tasks'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-purple-300 hover:bg-purple-900/40'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>Tasks ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('leaves')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeSubTab === 'leaves'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-purple-300 hover:bg-purple-900/40'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>Leaves & Time Off ({leaves.length})</span>
        </button>
      </div>

      {/* TASKS VIEW */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-purple-950/40 border border-purple-800/50 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-purple-400" /> Filter by:
              </span>
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="bg-purple-900/50 border border-purple-700/60 text-purple-100 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                className="bg-purple-900/50 border border-purple-700/60 text-purple-100 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div className="text-purple-300/70">
              Showing <span className="font-bold text-white">{filteredTasks.length}</span> tasks
            </div>
          </div>

          {/* Task Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-purple-300/60 flex flex-col items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
              <p>Loading tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 rounded-3xl bg-purple-950/30 border border-purple-800/40 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400 opacity-60" />
              <h3 className="text-base font-bold text-white">No tasks found</h3>
              <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
                {taskStatusFilter !== 'all' || taskPriorityFilter !== 'all'
                  ? 'Try changing the filters above.'
                  : 'You have no active tasks. Click "New Task" to create one.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isInProgress = task.status === 'in_progress';

                return (
                  <div
                    key={task.id}
                    className={`p-5 rounded-3xl border transition flex flex-col justify-between gap-4 ${
                      isCompleted
                        ? 'bg-purple-950/20 border-purple-900/40 opacity-70'
                        : 'bg-purple-950/40 border-purple-800/50 hover:border-purple-600/60 shadow-lg'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            task.priority === 'high'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : task.priority === 'medium'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {task.priority} Priority
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isInProgress
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-gray-500/20 text-gray-300'
                          }`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>

                      <h3
                        className={`text-sm font-bold leading-snug ${
                          isCompleted ? 'text-gray-400 line-through' : 'text-white'
                        }`}
                      >
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-xs text-purple-300/70 line-clamp-3">
                          {task.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-purple-800/30 text-[11px] text-purple-300/60 space-y-1">
                        {task.assignee && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-purple-400" />
                            <span>Assigned to: {task.assignee.name}</span>
                          </div>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-amber-400" />
                            <span>Due: {formatIndianDate(task.due_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Task Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-purple-800/30">
                      <div className="flex items-center gap-1.5">
                        {!isCompleted ? (
                          <>
                            {!isInProgress && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30 transition"
                              >
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 transition flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Complete
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.id, 'pending')}
                            className="px-2.5 py-1 rounded-lg bg-purple-900/50 hover:bg-purple-800 text-purple-300 text-[11px] font-semibold transition"
                          >
                            Reopen
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => setTaskToDelete(task.id)}
                        className="p-1.5 hover:bg-red-950/50 rounded-lg text-purple-400 hover:text-red-400 transition"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEAVES VIEW */}
      {activeSubTab === 'leaves' && (
        <div className="space-y-6">
          {/* Leaves Filter */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-purple-950/40 border border-purple-800/50 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-purple-400" /> Filter by Status:
              </span>
              <select
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
                className="bg-purple-900/50 border border-purple-700/60 text-purple-100 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">All Leaves</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              onClick={() => setShowApplyLeaveModal(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Apply Leave Request
            </button>
          </div>

          {/* Leaves Table */}
          {loading ? (
            <div className="p-12 text-center text-purple-300/60 flex flex-col items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
              <p>Loading leave requests...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-12 rounded-3xl bg-purple-950/30 border border-purple-800/40 text-center space-y-3">
              <Calendar className="h-10 w-10 mx-auto text-purple-400 opacity-60" />
              <h3 className="text-base font-bold text-white">No leave requests found</h3>
              <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
                No leave requests match your criteria.
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-purple-950/40 border border-purple-800/50 shadow-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-purple-200">
                <thead className="bg-purple-900/40 text-purple-300 font-semibold border-b border-purple-800/60">
                  <tr>
                    {!employeeMode && <th className="py-3 px-4">Employee</th>}
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-800/30">
                  {filteredLeaves.map((leave) => {
                    const isPending = leave.status === 'pending';

                    return (
                      <tr key={leave.id} className="hover:bg-purple-900/20 transition">
                        {!employeeMode && (
                          <td className="py-3 px-4 font-bold text-white">
                            {leave.cra?.name || 'CRA'}
                          </td>
                        )}
                        <td className="py-3 px-4 capitalize font-semibold text-purple-200">
                          {leave.leave_type} Leave
                        </td>
                        <td className="py-3 px-4">
                          {formatIndianDate(leave.start_date)} →{' '}
                          {formatIndianDate(leave.end_date)}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {leave.days_count} day(s)
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate" title={leave.reason}>
                          {leave.reason}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              leave.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : leave.status === 'rejected'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : leave.status === 'cancelled'
                                ? 'bg-gray-500/20 text-gray-400'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {leave.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isPending && !employeeMode && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')}
                                className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded text-[11px] font-semibold border border-emerald-500/30 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected')}
                                className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white rounded text-[11px] font-semibold border border-red-500/30 transition"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {isPending && employeeMode && (
                            <button
                              onClick={() => setLeaveToCancel(leave.id)}
                              className="px-2.5 py-1 bg-gray-700/50 hover:bg-gray-600 text-gray-300 rounded text-[11px] font-semibold transition"
                            >
                              Cancel Request
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TASK DELETE CONFIRMATION MODAL */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-gray-950 border border-purple-800/70 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Trash2 className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Task</h3>
            </div>
            <p className="text-xs text-gray-300">
              Are you sure you want to permanently delete this task? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-800/40">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteTask}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAVE CANCEL CONFIRMATION MODAL */}
      {leaveToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-gray-950 border border-purple-800/70 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-white">Cancel Leave Request</h3>
            </div>
            <p className="text-xs text-gray-300">
              Are you sure you want to cancel this pending leave request?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-800/40">
              <button
                type="button"
                onClick={() => setLeaveToCancel(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white"
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={executeCancelLeave}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-gray-950 border border-purple-800/70 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-purple-800/40 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-purple-400" />
                Create New Action Item
              </h3>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-purple-200 font-semibold mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Follow up with TCS campus team on phone"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-purple-200 font-semibold mb-1">
                  Description / Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Add background details, outreach instructions, or guidelines..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-200 font-semibold mb-1">
                    Assignee *
                  </label>
                  <select
                    required
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {cras.filter((cra) => cra.is_active !== false && !cra.deleted_at).map((cra) => (
                      <option key={cra.id} value={cra.id}>
                        {cra.name} ({cra.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-purple-200 font-semibold mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-purple-200 font-semibold mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Recurring Task Configuration */}
              <div className="p-3.5 bg-purple-950/40 rounded-2xl border border-purple-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${isRecurring ? 'text-purple-400 animate-spin' : 'text-gray-400'}`} />
                    <label htmlFor="recurringToggle" className="text-xs font-semibold text-purple-200 cursor-pointer select-none">
                      Make this a recurring task
                    </label>
                  </div>
                  <input
                    id="recurringToggle"
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded accent-purple-600 bg-gray-900 border-purple-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>

                {isRecurring && (
                  <div className="pt-2 border-t border-purple-800/30 flex items-center justify-between gap-3 animate-in fade-in duration-200">
                    <span className="text-[11px] text-purple-300 font-medium">
                      Recurring Frequency:
                    </span>
                    <select
                      value={recurringFrequency}
                      onChange={(e) => setRecurringFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                      className="bg-purple-900/60 border border-purple-600/70 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none font-semibold"
                    >
                      <option value="daily">Daily (Every 24 Hours)</option>
                      <option value="weekly">Weekly (Every 7 Days)</option>
                      <option value="monthly">Monthly (Every 30 Days)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-800/40">
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition"
                >
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPLY LEAVE MODAL */}
      {showApplyLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-gray-950 border border-purple-800/70 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-purple-800/40 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                Submit Leave Application
              </h3>
              <button
                onClick={() => setShowApplyLeaveModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
              <div>
                <label className="block text-purple-200 font-semibold mb-1">
                  Leave Category *
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="casual">Casual Leave (CL)</option>
                  <option value="sick">Sick / Medical Leave (SL)</option>
                  <option value="earned">Earned Leave (EL)</option>
                  <option value="unpaid">Leave Without Pay (LWP)</option>
                  <option value="other">Other Emergency</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-200 font-semibold mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                  </input>
                </div>

                <div>
                  <label className="block text-purple-200 font-semibold mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block text-purple-200 font-semibold mb-1">
                  Reason for Absence *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide reason for leave for management review..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full px-3.5 py-2 bg-purple-950/50 border border-purple-700/60 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-800/40">
                <button
                  type="button"
                  onClick={() => setShowApplyLeaveModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
