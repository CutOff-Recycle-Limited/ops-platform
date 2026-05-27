import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auth as authApi } from '../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7f4] p-6" style={{ fontFamily: 'Mulish, sans-serif' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-black text-xl text-[#1a1a1a] mb-2">Invalid Reset Link</h2>
          <p className="text-gray-400 font-medium text-sm mb-5">
            This link is missing a reset token. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary inline-flex">Request New Link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7f4] p-6" style={{ fontFamily: 'Mulish, sans-serif' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/cr-logo.png" alt="CutOff Recycle" className="w-14 h-14 mx-auto mb-4" />
          <h1 className="font-black text-2xl text-[#1a1a1a]">Set a new password</h1>
          <p className="text-gray-400 font-medium mt-1 text-sm">
            Choose a new password for your account.
          </p>
        </div>

        <div className="card p-6 shadow-sm">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#50ad32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-black text-lg text-[#1a1a1a] mb-2">Password updated!</h2>
              <p className="text-gray-400 text-sm font-medium mb-5">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <Link to="/login" className="btn-primary inline-flex">Sign In</Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
                  {error}
                  {error.toLowerCase().includes('invalid or has expired') && (
                    <span className="block mt-1 font-medium">
                      <Link to="/forgot-password" className="underline">Request a new link →</Link>
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="Re-enter your new password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : 'Update Password'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400 font-medium mt-4">
                <Link to="/login" className="text-[#50ad32] font-bold hover:text-[#459a2a] transition-colors">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
