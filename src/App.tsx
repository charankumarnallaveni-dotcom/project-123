import React, { useState, useEffect } from 'react';
import { CRA } from './types';
import { api, clearAuthToken, getAuthToken } from './services/api';
import { clientFallbackStore } from './services/clientFallbackStore';
import { Sidebar } from './components/Sidebar';
import { AdminLoginModal } from './components/AdminLoginModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TeamLeadDashboardPage } from './pages/TeamLeadDashboardPage';
import { TeamSheetsPage } from './pages/TeamSheetsPage';
import { HRSourcingPage } from './pages/HRSourcingPage';
import { JDIntakePage } from './pages/JDIntakePage';
import { CRMListPage } from './pages/CRMListPage';
import { OutreachTrackerPage } from './pages/OutreachTrackerPage';
import { TaskManagementPage } from './pages/TaskManagementPage';
import { PerformancePage } from './pages/PerformancePage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { AdminSalaryPage } from './pages/AdminSalaryPage';
import { AdminFullDataPage } from './pages/AdminFullDataPage';
import { Menu, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CRA | null>(null);
  const [mode, setMode] = useState<'employee' | 'admin'>('employee');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Initialize authentication on load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = getAuthToken();
        const savedUser = clientFallbackStore.getCurrentUser();
        if (token || savedUser) {
          try {
            const me = await api.getCurrentCRA();
            if (me) {
              setCurrentUser(me);
              if (me.role === 'admin' && window.location.pathname.startsWith('/admin')) {
                setMode('admin');
                setActiveTab('admin-team-lead-dashboard');
              } else {
                setMode('employee');
                setActiveTab('dashboard');
              }
            } else if (savedUser) {
              setCurrentUser(savedUser);
            }
          } catch {
            if (savedUser) setCurrentUser(savedUser);
          }
        }
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initializeAuth();
  }, []);

  const handleLoginSuccess = (role?: 'admin' | 'cra', user?: CRA) => {
    const targetUser = user || clientFallbackStore.getCurrentUser();
    setCurrentUser(targetUser);
    if (role === 'admin') {
      setMode('admin');
      setActiveTab('admin-team-lead-dashboard');
    } else {
      setMode('employee');
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (_) {}
    clearAuthToken();
    localStorage.removeItem('placemein_current_user');
    setCurrentUser(null);
    setMode('employee');
    setActiveTab('dashboard');
  };

  const handleSwitchToEmployee = () => {
    setMode('employee');
    setActiveTab('dashboard');
  };

  const handleAdminLoginSuccess = (adminUser: CRA) => {
    setCurrentUser(adminUser);
    setMode('admin');
    setActiveTab('admin-team-lead-dashboard');
    setShowAdminModal(false);
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm font-semibold tracking-wide">Initializing PLACEMEIN CRA Outreach...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Render appropriate content page
  const renderPageContent = () => {
    if (mode === 'admin') {
      switch (activeTab) {
        case 'admin-team-lead-dashboard':
          return <TeamLeadDashboardPage setActiveTab={setActiveTab} adminMode={true} />;
        case 'admin-salary':
          return <AdminSalaryPage />;
        case 'admin-all-data':
          return <AdminFullDataPage currentUser={currentUser} />;
        case 'admin-users':
          return <AdminPortalPage initialTab="users" currentUser={currentUser} />;
        case 'admin-sheets':
          return <TeamSheetsPage adminMode={true} currentUser={currentUser} />;
        case 'admin-tasks':
          return <TaskManagementPage employeeMode={false} />;
        case 'admin-companies':
          return <AdminPortalPage initialTab="companies" currentUser={currentUser} />;
        case 'admin-performance':
          return <PerformancePage employeeMode={false} />;
        case 'admin-settings':
          return <AdminPortalPage initialTab="settings" currentUser={currentUser} />;
        default:
          return <TeamLeadDashboardPage setActiveTab={setActiveTab} adminMode={true} />;
      }
    }

    // Employee Workspace
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'team-lead-dashboard':
        return <TeamLeadDashboardPage setActiveTab={setActiveTab} adminMode={false} />;
      case 'team-sheets':
        return <TeamSheetsPage adminMode={false} currentUser={currentUser} />;
      case 'hr-sourcing':
        return <HRSourcingPage onNavigateToJDIntake={() => setActiveTab('jd-intake')} />;
      case 'jd-intake':
        return <JDIntakePage />;
      case 'crm':
        return <CRMListPage onAddRole={() => setActiveTab('jd-intake')} />;
      case 'outreach':
        return <OutreachTrackerPage />;
      case 'tasks':
        return <TaskManagementPage employeeMode={true} />;
      case 'performance':
        return <PerformancePage employeeMode={true} />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col lg:flex-row antialiased">
      {/* Mobile Top Navigation Bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shadow-md">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white border border-gray-700 focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <span className="font-extrabold text-sm text-white">PLACEMEIN</span>
          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${mode === 'admin' ? 'bg-amber-900/60 text-amber-300 border border-amber-600/40' : 'bg-purple-900/60 text-purple-300 border border-purple-600/40'}`}>
            {mode === 'admin' ? 'Admin' : 'CRA'}
          </span>
        </div>

        {mode === 'employee' ? (
          <button
            onClick={() => setShowAdminModal(true)}
            className="p-1.5 rounded-xl bg-amber-950 text-amber-300 border border-amber-700/50 hover:bg-amber-900/50"
            title="Admin Login"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSwitchToEmployee}
            className="text-xs font-semibold text-purple-300 bg-purple-950 px-2 py-1 rounded-lg border border-purple-700/50"
          >
            Employee
          </button>
        )}
      </header>

      {/* Main Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        currentUser={currentUser}
        mode={mode}
        onRequestAdminLogin={() => setShowAdminModal(true)}
        onSwitchToEmployee={handleSwitchToEmployee}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Primary Page Canvas */}
      <main className="flex-1 min-w-0 overflow-y-auto min-h-screen">
        {renderPageContent()}
      </main>

      {/* Admin Login Modal Gate */}
      <AdminLoginModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={handleAdminLoginSuccess}
        initialEmail={currentUser?.email}
      />
    </div>
  );
};

export default App;
