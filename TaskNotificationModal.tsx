import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { api } from '../services/api';
import {
  Bell,
  Clock,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  RefreshCw,
  X,
  User,
  ArrowRight,
} from 'lucide-react';

interface TaskNotificationModalProps {
  tasks: Task[];
  onDismiss: (taskId: string) => void;
  onSnooze: (taskId: string, minutes: number) => void;
  onViewTask?: (taskId: string) => void;
}

export const TaskNotificationModal: React.FC<TaskNotificationModalProps> = ({
  tasks,
  onDismiss,
  onSnooze,
  onViewTask,
}) => {
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(60);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    try {
      const dur = api.getTaskSnoozeDuration();
      if (dur) setSnoozeMinutes(dur);
    } catch (_) {}
  }, []);

  if (!tasks || tasks.length === 0) return null;

  const activeTask = tasks[Math.min(currentIndex, tasks.length - 1)];
  if (!activeTask) return null;

  const handleDismiss = () => {
    onDismiss(activeTask.id);
    if (currentIndex >= tasks.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleSnooze = () => {
    onSnooze(activeTask.id, snoozeMinutes);
    if (currentIndex >= tasks.length - 1) {
      setCurrentIndex(0);
    }
  };

  const formatDue = (dateStr?: string) => {
    if (!dateStr) return 'No due date specified';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-gray-950 border-2 border-purple-500/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-purple-950/80 space-y-6 relative overflow-hidden">
        
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-600/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-purple-800/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600/20 border border-purple-500/40 rounded-2xl text-purple-300 shadow-md shadow-purple-900/40">
              <Bell className="h-6 w-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">New Action Item Assigned</h3>
                {tasks.length > 1 && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-900 text-purple-200 border border-purple-700">
                    {currentIndex + 1} of {tasks.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-purple-200/80 font-medium">
                Action is required for this newly assigned task on your dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition"
            title="Dismiss notification"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Task Details Card */}
        <div className="p-5 rounded-2xl bg-purple-950/40 border border-purple-700/50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
              activeTask.priority === 'high' 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                : activeTask.priority === 'medium'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              {activeTask.priority} Priority
            </span>

            {activeTask.is_recurring && (
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 capitalize">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Recurring ({activeTask.recurring_frequency || 'daily'})</span>
              </span>
            )}

            <span className="text-xs text-purple-200/70 flex items-center gap-1 ml-auto">
              <Calendar className="h-3.5 w-3.5 text-purple-400" />
              <span>Due: {formatDue(activeTask.due_date)}</span>
            </span>
          </div>

          <div>
            <h4 className="text-sm sm:text-base font-extrabold text-white leading-snug">
              {activeTask.title}
            </h4>
            {activeTask.description && (
              <p className="text-xs text-gray-300 mt-2 leading-relaxed bg-black/30 p-3 rounded-xl border border-purple-900/40">
                {activeTask.description}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-purple-800/30 flex items-center justify-between text-[11px] text-purple-300">
            <span className="flex items-center gap-1.5 font-medium">
              <User className="h-3.5 w-3.5 text-purple-400" />
              <span>Assigned By: Leadership / Admin Portal</span>
            </span>
            <span className="font-mono text-gray-400">
              ID: {activeTask.id.slice(0, 12)}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSnooze}
              className="py-3 px-4 rounded-xl border border-purple-500/40 bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              title={`Snoozes this popup for ${snoozeMinutes} minutes`}
            >
              <Clock className="h-4 w-4 text-purple-400" />
              <span>Remind Later</span>
              <span className="text-[10px] text-purple-400 font-mono">({snoozeMinutes}m)</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
              title="Marks as seen and dismisses notification"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Dismiss</span>
            </button>
          </div>

          {onViewTask && (
            <button
              type="button"
              onClick={() => {
                onViewTask(activeTask.id);
                handleDismiss();
              }}
              className="w-full text-center text-xs text-purple-300 hover:text-white font-medium flex items-center justify-center gap-1.5 hover:underline py-1"
            >
              <span>Go to My Tasks to begin work</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
