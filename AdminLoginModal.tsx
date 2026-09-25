import React, { useState } from 'react';
import { api, clearAuthToken } from '../services/api';
import { CRA } from '../types';
import { ShieldAlert, ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, X, CheckCircle, ArrowRight, Key } from 'lucide-react';
import { ALL_EMPLOYEE_CREDENTIALS, DEFAULT_EMPLOYEE_PASSWORD } from '../data/employeeCredentials';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (adminUser: CRA) => void;
  initialEmail?: string;
  isInlineGate?: boolean;
  onCancelToEmployee?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEmail,
  isInlineGate = false,
  onCancelToEmployee,
}) => {
  const [email, setEmail] = useState(initialEmail || 'aravindreddy.l@placemein.com');
  const [password, setPassword] = useState(DEFAULT_EMPLOYEE_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen && !isInlineGate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!email.trim() || !password) {
        throw new Error('Please enter both admin email and password.');
      }

      await api.login(email.trim(), password);
      const user = await api.getCurrentCRA();

      if (user.role !== 'admin') {
        clearAuthToken();
        throw new Error(`Access denied: "${user.name}" (${user.email}) is a CRA Employee account, not an Administrator. Please log in with an Admin account.`);
      }

      sessionStorage.setItem('placemein:admin_verified', 'true');
      localStorage.setItem('placemein:preferred_portal', 'admin');
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Admin authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const adminList = ALL_EMPLOYEE_CREDENTIALS.filter((e) => e.role === 'admin');

  const content = (
    <div className="w-full max-w-md bg-gray-900/95 border border-amber-500/50 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">Admin Authentication</h3>
            <p className="text-xs text-amber-300/80 font-medium">Log in to enter the Admin Portal</p>
          </div>
        </div>
        {!isInlineGate && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-xl hover:bg-gray-800 transition"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mb-4 p-3 bg-amber-950/40 border border-amber-700/40 rounded-2xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>Direct access prohibited:</strong> Administrator authentication is required to access system settings, employee management, and company oversight.
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-semibold text-rose-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-amber-200 mb-1">Admin Email *</label>
          <div className="relative">
            <Mail className="h-4 w-4 absolute left-3 top-3 text-amber-400/70" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@placemein.com"
              className="w-full bg-gray-950 border border-amber-700/50 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          {/* Quick email presets */}
          <div className="mt-2 space-y-1.5">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Quick Select Admin Account:</span>
            <div className="flex flex-wrap gap-1.5">
              {adminList.map((admin) => (
                <button
                  key={admin.email}
                  type="button"
                  onClick={() => {
                    setEmail(admin.email);
                    setPassword(admin.passwordDefault);
                  }}
                  className={`text-[11px] px-2 py-1 rounded-lg border transition font-medium flex items-center gap-1.5 ${
                    email === admin.email
                      ? 'bg-amber-600/30 border-amber-400 text-amber-200 shadow-sm'
                      : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${admin.avatarBg}`} />
                  <span>{admin.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-amber-200">Admin Password *</label>
            <button
              type="button"
              onClick={() => setPassword(DEFAULT_EMPLOYEE_PASSWORD)}
              className="text-[11px] text-amber-300/90 hover:text-amber-200 font-mono hover:underline flex items-center gap-1"
            >
              <Key className="h-3 w-3" />
              <span>Autofill {DEFAULT_EMPLOYEE_PASSWORD}</span>
            </button>
          </div>
          <div className="relative">
            <Lock className="h-4 w-4 absolute left-3 top-3 text-amber-400/70" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter administrator password"
              className="w-full bg-gray-950 border border-amber-700/50 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
              autoFocus={!isInlineGate}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-white"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-2">
          {(isInlineGate || onCancelToEmployee) && (
            <button
              type="button"
              onClick={onCancelToEmployee || onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-700 bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white text-xs font-bold transition text-center"
            >
              Return to Employee View
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-[0.98] text-white text-xs font-extrabold shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying Admin...</span>
            ) : (
              <>
                <span>Authenticate & Enter Admin</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );

  if (isInlineGate) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative">
        {content}
      </div>
    </div>
  );
};
