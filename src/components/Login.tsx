import React, { useState } from 'react';
import { Lock, User, Radio, AlertCircle, UserPlus, CheckCircle, Key } from 'lucide-react';
import { safeFetchJson } from '../utils';

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isRegisterMode && !licenseKey) {
      setError('Please enter a valid license key');
      return;
    }

    if (isRegisterMode && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
      const { data, error: fetchErr } = await safeFetchJson<{ token: string; username: string }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, licenseKey }),
      });

      if (fetchErr || !data) {
        throw new Error(fetchErr || 'Authentication failed');
      }

      if (isRegisterMode) {
        setSuccess('Registration successful! Logging you in...');
        setTimeout(() => {
          onLoginSuccess(data.token, data.username);
        }, 1200);
      } else {
        onLoginSuccess(data.token, data.username);
      }
    } catch (err: any) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setLicenseKey('');
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* Dynamic background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse delay-750"></div>

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur-xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4">
            {isRegisterMode ? (
              <UserPlus className="w-8 h-8 text-red-500 animate-pulse" />
            ) : (
              <Radio className="w-8 h-8 text-red-500 animate-pulse" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isRegisterMode ? 'Create Account' : 'StreamManager 24/7'}
          </h1>
          <p className="text-sm text-slate-400 mt-1 text-center">
            {isRegisterMode ? 'Sign up to control your streaming hub' : 'Live Streaming Control System'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
            <p className="text-sm text-emerald-200">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                placeholder={isRegisterMode ? 'Choose a username' : 'Enter admin username'}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                placeholder={isRegisterMode ? 'Create a secure password' : 'Enter password'}
                required
              />
            </div>
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Repeat your password"
                  required
                />
              </div>
            </div>
          )}

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">License Key</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Key className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors font-mono"
                  placeholder="STREAM-XXXX-YYYY"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">First-time registration requires a valid system permission license key.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isRegisterMode ? (
              'Create Account & Log In'
            ) : (
              'Access Admin Dashboard'
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800/60 pt-6">
          <p className="text-sm text-slate-400">
            {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-red-500 hover:text-red-400 font-semibold focus:outline-none cursor-pointer transition-colors ml-1"
            >
              {isRegisterMode ? 'Login here' : 'Register here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
