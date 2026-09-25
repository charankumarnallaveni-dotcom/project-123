import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Search,
  Users,
  Send,
  LogOut,
  Award,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Settings,
  Building2,
  UserCog,
  ShieldCheck,
  User,
  ArrowLeftRight,
  FileSpreadsheet,
} from 'lucide-react';
import { CRA } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  currentUser?: CRA | null;
  mode: 'employee' | 'admin';
  onRequestAdminLogin: () => void;
  onSwitchToEmployee?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const employeeItems = [
  { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { id: 'team-lead-dashboard', label: 'Team Lead Dashboard', icon: LayoutDashboard },
  { id: 'team-sheets', label: 'Team Worksheets', icon: FileSpreadsheet },
  { id: 'hr-sourcing', label: 'HR Sourcing', icon: Search },
  { id: 'jd-intake', label: 'JD Intake', icon: FileText },
  { id: 'crm', label: 'CRM Directory', icon: Users },
  { id: 'outreach', label: 'Outreach Tracker', icon: Send },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'performance', label: 'My Performance', icon: Award },
];

const adminItems = [
  { id: 'admin-team-lead-dashboard', label: 'Team Lead Dashboard', icon: LayoutDashboard },
  { id: 'admin-users', label: 'User Management', icon: UserCog },
  { id: 'admin-sheets', label: 'All Worksheets & PDF', icon: FileSpreadsheet },
  { id: 'admin-tasks', label: 'Task Management', icon: CheckSquare },
  { id: 'admin-companies', label: 'Company & JD Oversight', icon: Building2 },
  { id: 'admin-performance', label: 'Team Performance', icon: Award },
  { id: 'admin-settings', label: 'System Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  currentUser,
  mode,
  onRequestAdminLogin,
  onSwitchToEmployee,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = mode === 'admin';
  const items = isAdmin ? adminItems : employeeItems;

  const handlePortalSwitchClick = () => {
    onCloseMobile?.();
    if (isAdmin) {
      if (onSwitchToEmployee) {
        onSwitchToEmployee();
      } else {
        setActiveTab('dashboard');
      }
    } else {
      // Must login to access Admin portal - no direct bypass!
      onRequestAdminLogin();
    }
  };

  const handleItemClick = (id: string) => {
    setActiveTab(id);
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 z-50 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`bg-gradient-to-b ${
          isAdmin
            ? 'from-amber-950 via-gray-950 to-amber-950 border-amber-800/50'
            : 'from-purple-950 via-gray-950 to-purple-950 border-purple-800/50'
        } border-r h-screen fixed lg:sticky top-0 left-0 flex flex-col justify-between transition-all duration-300 z-50 shadow-2xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-64 md:w-72'}`}
      >
        <div className={`p-4 border-b ${isAdmin ? 'border-amber-800/40' : 'border-purple-800/40'} flex items-center justify-between`}>
          <button
            onClick={() => handleItemClick(isAdmin ? 'admin-users' : 'dashboard')}
            className="flex items-center space-x-3 text-left overflow-hidden"
          >
            <div className="bg-white p-2 rounded-2xl shrink-0 shadow-sm border border-purple-200/50 flex items-center justify-center">
              <img
                src="/placemein-logo.png"
                alt="Placemein"
                className="h-7 w-7 object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('placemein-symbol.svg')) {
                    target.src = '/placemein-symbol.svg';
                  }
                }}
              />
            </div>
            {!collapsed && (
              <div>
                <span className="text-lg font-black text-white block">PLACEMEIN</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-amber-300' : 'text-purple-300'}`}>
                  {isAdmin ? 'Admin Portal' : 'CRA Employee Portal'}
                </span>
              </div>
            )}
          </button>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`hidden lg:flex p-1.5 rounded-xl border ${
                isAdmin ? 'bg-amber-900/40 border-amber-700/50 text-amber-300' : 'bg-purple-900/40 border-purple-700/50 text-purple-300'
              }`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
                title="Close Navigation"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Admin Portal Gateway Switcher inside Sidebar */}
        <div className="px-3 pt-3">
          <button
            onClick={handlePortalSwitchClick}
            title={collapsed ? (isAdmin ? 'Exit to Employee View' : 'Admin Portal (Login Required)') : undefined}
            className={`w-full flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-extrabold border transition shadow-lg ${
              isAdmin
                ? 'bg-purple-900/40 hover:bg-purple-800/60 border-purple-600/50 text-purple-200'
                : 'bg-amber-900/40 hover:bg-amber-800/60 border-amber-600/50 text-amber-200'
            }`}
          >
            {isAdmin ? (
              <User className="h-3.5 w-3.5 shrink-0 text-purple-300" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
            {!collapsed && (
              <span>{isAdmin ? 'Exit to Employee View' : 'Admin Portal (Login)'}</span>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <p className={`px-3 mb-2 text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'text-amber-400' : 'text-purple-400'}`}>
              {isAdmin ? 'Administration Oversight' : 'Employee Workspace'}
            </p>
          )}
          <div className="space-y-1">
            {items.map(({ id, label, icon: Icon }) => {
              const active =
                id === activeTab ||
                (id === 'admin-sheets' && activeTab === 'team-sheets') ||
                (id === 'admin-team-lead-dashboard' && activeTab === 'team-lead-dashboard');
              return (
                <button
                  key={id}
                  onClick={() => handleItemClick(id)}
                  title={collapsed ? label : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                    active
                      ? isAdmin
                        ? 'bg-amber-600 border border-amber-400/50 text-white shadow-lg shadow-amber-900/30'
                        : 'bg-purple-600 border border-purple-400/50 text-white shadow-lg shadow-purple-900/30'
                      : isAdmin
                      ? 'text-amber-100/80 hover:bg-amber-900/40'
                      : 'text-purple-100/80 hover:bg-purple-900/40'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className={`p-3 border-t ${isAdmin ? 'border-amber-800/40 bg-amber-950/40' : 'border-purple-800/40 bg-purple-950/40'}`}>
          {currentUser && !collapsed && (
            <div className="mb-2 px-3 text-xs">
              <p className="font-bold text-white truncate">
                {currentUser.email?.toLowerCase().includes('aravind') || currentUser.name?.toLowerCase().includes('aravind') ? 'Aravind Reddy' : currentUser.name}
              </p>
              <p className={isAdmin ? 'text-amber-300 font-medium' : 'text-purple-300 font-medium'}>
                {currentUser.email?.toLowerCase().includes('aravind') || currentUser.name?.toLowerCase().includes('aravind')
                  ? 'CRA for Placemein'
                  : (currentUser.role === 'admin' ? (isAdmin ? 'Admin Portal Active' : 'Admin (Employee Mode)') : 'CRA Employee')}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              onCloseMobile?.();
              onLogout();
            }}
            title="Log out"
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Log out'}
          </button>
        </div>
      </aside>
    </>
  );
};
