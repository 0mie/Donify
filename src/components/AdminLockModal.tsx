import React, { useState } from 'react';
import { Lock, Unlock, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface AdminLockModalProps {
  mode: 'login' | 'setup' | 'change';
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (token: string) => void;
}

export const AdminLockModal: React.FC<AdminLockModalProps> = ({
  mode,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'setup' || mode === 'change') {
      if (password.length < 4) {
        setError('Passcode must be at least 4 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passcodes do not match.');
        return;
      }
    } else {
      if (!password) {
        setError('Please enter your admin passcode.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let endpoint = '/api/auth/login';
      let payload: any = { password };

      if (mode === 'setup') {
        endpoint = '/api/auth/setup';
        payload = { password };
      } else if (mode === 'change') {
        endpoint = '/api/auth/change-password';
        payload = { newPassword: password };
      }

      const token = localStorage.getItem('tiltify_admin_token') || '';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      setPassword('');
      setConfirmPassword('');
      onSuccess(data.token);
    } catch (err: any) {
      setError(err?.message || 'Action failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePasscode = async () => {
    if (!window.confirm('Are you sure you want to disable passcode protection? Anyone with your URL will be able to modify your bot.')) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('tiltify_admin_token') || '';
      const res = await fetch('/api/auth/remove-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove passcode');
      }
      onSuccess('');
      if (onClose) onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to disable passcode');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFullScreenLogin = mode === 'login';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isFullScreenLogin
          ? 'bg-neutral-950/90 backdrop-blur-md'
          : 'bg-black/60 backdrop-blur-sm'
      }`}
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden animate-in fade-in duration-200">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/40 flex items-center justify-center text-indigo-400 shrink-0">
            {mode === 'login' ? <Lock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              {mode === 'login' && 'Admin Passcode Required'}
              {mode === 'setup' && 'Secure Your Dashboard'}
              {mode === 'change' && 'Change Admin Passcode'}
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {mode === 'login' && 'Enter your passcode to manage webhook, bot tokens, and campaign settings.'}
              {mode === 'setup' && 'Create a passcode so only you can view or modify your bot on this URL.'}
              {mode === 'change' && 'Enter a new passcode to update your dashboard lock.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/40 border border-red-800/60 rounded-xl p-3 text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-neutral-300 font-medium block mb-1.5">
              {mode === 'login' ? 'Admin Passcode' : 'New Passcode'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Enter passcode...' : 'Choose a passcode (e.g. 4+ characters)'}
                autoFocus
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 pr-10 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {(mode === 'setup' || mode === 'change') && (
            <div>
              <label className="text-neutral-300 font-medium block mb-1.5">
                Confirm Passcode
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter passcode..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            {!isFullScreenLogin && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Checking...</span>
              ) : mode === 'login' ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Dashboard</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{mode === 'setup' ? 'Set Passcode & Lock' : 'Update Passcode'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {mode === 'change' && (
          <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
            <button
              type="button"
              onClick={handleRemovePasscode}
              disabled={isSubmitting}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
            >
              Disable passcode protection
            </button>
          </div>
        )}

        {mode === 'login' && (
          <div className="mt-5 pt-4 border-t border-neutral-800/80 text-[11px] text-neutral-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-neutral-300 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              <span>Background Webhooks Unaffected</span>
            </div>
            <p>
              Tiltify live donation and auction webhook events continue to deliver to Discord normally while this dashboard is locked.
            </p>
            <p className="text-neutral-500 pt-1">
              Tip: If you ever forget your passcode, set the <code className="text-neutral-300 bg-neutral-950 px-1 py-0.5 rounded">ADMIN_PASSWORD</code> environment variable in your Render dashboard to override it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
