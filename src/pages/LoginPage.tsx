import React, { useState } from 'react';
import { api, clearAuthToken } from '../services/api';
import { CRA } from '../types';
import {
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  ShieldCheck,
  User,
  Eye,
  EyeOff,
  CheckCircle,
  LogIn,
  Loader2,
} from 'lucide-react';

interface Props {
  onLoginSuccess: (role?: 'admin' | 'cra', user?: CRA) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [loginRole, setLoginRole] = useState<'CRA' | 'ADMIN'>(() =>
    window.location.pathname.startsWith('/admin') ? 'ADMIN' : 'CRA'
  );
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');

  const handleRoleTabChange = (role: 'CRA' | 'ADMIN') => {
    setLoginRole(role);
    setError(null);
    setSuccessMessage(null);
  };

  const performLogin = async (targetEmail: string, targetPass: string, expectedRole?: 'CRA' | 'ADMIN') => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    setLoadingStep('Authenticating credentials...');

    try {
      const cleanEmail = targetEmail.trim().toLowerCase();
      if (!cleanEmail || !targetPass) {
        throw new Error('Please enter both your email address and password to log in.');
      }

      // Fast auth call that yields access_token & cached profile
      const loginRes = await api.login(cleanEmail, targetPass);
      localStorage.setItem(
        'placemein:login_timestamp',
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );

      setLoadingStep('Initializing workspace...');
      const currentUser = loginRes.user || (await api.getCurrentCRA());
      const roleToCheck = expectedRole || loginRole;

      if (roleToCheck === 'ADMIN' && currentUser.role !== 'admin') {
        clearAuthToken();
        sessionStorage.removeItem('placemein:admin_verified');
        setError(`Access denied: "${currentUser.name}" has a CRA Employee account, which cannot access the Admin Portal. Please use an authorized Admin account.`);
        setLoading(false);
        return;
      }

      if (currentUser.role === 'admin' && roleToCheck === 'ADMIN') {
        sessionStorage.setItem('placemein:admin_verified', 'true');
        localStorage.setItem('placemein:preferred_portal', 'admin');
        onLoginSuccess('admin', currentUser);
      } else {
        sessionStorage.removeItem('placemein:admin_verified');
        localStorage.setItem('placemein:preferred_portal', 'employee');
        onLoginSuccess('cra', currentUser);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify email and password.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      if (isForgotMode) {
        setLoading(true);
        if (resetToken.trim()) {
          await api.resetPassword(resetToken.trim(), password);
          setIsForgotMode(false);
          setResetToken('');
          setSuccessMessage('Password reset successfully. You can now log in.');
        } else {
          const result = await api.forgotPassword(email);
          setSuccessMessage(result.message);
        }
        setLoading(false);
      } else if (isRegisterMode) {
        setLoading(true);
        setLoadingStep('Registering account...');
        await api.register(
          name || email.split('@')[0],
          email.trim(),
          password,
          loginRole === 'ADMIN' ? 'admin' : 'cra'
        );
        setSuccessMessage(`Account registered as ${loginRole === 'ADMIN' ? 'Admin' : 'CRA Employee'}. Logging in...`);
        await performLogin(email.trim(), password, loginRole);
      } else {
        await performLogin(email.trim(), password, loginRole);
      }
    } catch (err: any) {
      setError(err.message || (isRegisterMode ? 'Registration failed' : 'Login failed'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-gray-950 to-amber-950 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-gray-900/90 border border-purple-800/60 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl shadow-black/80">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="bg-white p-3 rounded-2xl w-fit mx-auto shadow-xl shadow-purple-600/30 border border-purple-200 flex items-center justify-center">
            <img
              src="/placemein-logo.png"
              alt="Placemein Logo"
              className="h-12 w-12 object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('placemein-symbol.svg')) {
                  target.src = '/placemein-symbol.svg';
                }
              }}
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">PLACEMEIN</h1>
            <p className="text-xs sm:text-sm text-purple-200/80 font-medium">Recruitment Automation & CRA Sourcing CRM</p>
          </div>
        </div>

        {/* Dual Portal Selection Tabs */}
        {!isForgotMode && (
          <div className="grid grid-cols-2 gap-2 bg-purple-900/30 p-1.5 rounded-2xl border border-purple-800/50">
            <button
              type="button"
              onClick={() => handleRoleTabChange('ADMIN')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-extrabold rounded-xl transition-all ${
                loginRole === 'ADMIN'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40 border border-amber-400/30'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Portal</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabChange('CRA')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-extrabold rounded-xl transition-all ${
                loginRole === 'CRA'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 border border-purple-400/30'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <User className="h-4 w-4" />
              <span>CRA Employee</span>
            </button>
          </div>
        )}

        {/* Header Indicator Notice */}
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          loginRole === 'ADMIN' 
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
            : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
        }`}>
          <span className="flex items-center gap-2 font-medium">
            {loginRole === 'ADMIN' ? <ShieldCheck className="h-4 w-4 text-amber-400" /> : <User className="h-4 w-4 text-purple-400" />}
            {loginRole === 'ADMIN' ? 'Leadership & Admin Portal Access' : 'CRA Specialist Portal Access'}
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-950 border border-purple-700/50">
            {loginRole}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-start gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode && !isForgotMode && (
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Full Name *</label>
              <div className="relative">
                <UserCheck className="h-4 w-4 absolute left-3 top-3 text-purple-400" />
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-950/80 border border-purple-700/60 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 placeholder-gray-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1">
              {loginRole === 'ADMIN' ? 'Admin Email Address *' : 'Employee Email Address *'}
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 absolute left-3 top-3 text-purple-400" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder={loginRole === 'ADMIN' ? 'admin@placemein.com' : 'employee@placemein.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950/80 border border-purple-700/60 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 placeholder-gray-500"
              />
            </div>
          </div>

          {!isForgotMode && (
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Password *</label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-3 text-purple-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-950/80 border border-purple-700/60 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 placeholder-gray-500 font-mono"
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
          )}

          {isForgotMode && (
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">Reset Token (optional)</label>
              <input
                type="text"
                placeholder="Leave empty to request a reset link"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full bg-gray-950/80 border border-purple-700/60 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 placeholder-gray-500 font-mono"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-extrabold py-3.5 rounded-xl transition shadow-xl disabled:opacity-50 mt-2 text-sm flex items-center justify-center gap-2 ${
              loginRole === 'ADMIN' 
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30' 
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{loadingStep || 'Signing In...'}</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>
                  {isForgotMode 
                    ? (resetToken ? 'Reset Password' : 'Send Recovery Email') 
                    : isRegisterMode 
                    ? `Register as ${loginRole === 'ADMIN' ? 'Admin' : 'CRA Employee'}` 
                    : `Sign In to ${loginRole === 'ADMIN' ? 'Admin Portal' : 'Employee Portal'}`
                  }
                </span>
              </>
            )}
          </button>
        </form>

        {!isRegisterMode && !isForgotMode && (
          <button
            type="button"
            onClick={() => { setIsForgotMode(true); setError(null); setSuccessMessage(null); }}
            className="w-full text-xs text-purple-300 hover:text-white hover:underline font-semibold text-center block"
          >
            Forgot password? Reset password
          </button>
        )}

        <div className="text-center pt-2 border-t border-purple-800/40">
          <button
            type="button"
            onClick={() => {
              if (isForgotMode) {
                setIsForgotMode(false);
                setResetToken('');
                setError(null);
                setSuccessMessage(null);
                return;
              }
              setIsRegisterMode(!isRegisterMode);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-xs text-purple-300 hover:text-white hover:underline font-semibold"
          >
            {isForgotMode ? 'Back to login' : isRegisterMode ? 'Already registered? Login here' : 'Need a new account? Register here'}
          </button>
        </div>
      </div>
    </div>
  );
};
