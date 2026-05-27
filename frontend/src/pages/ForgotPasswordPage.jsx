import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth as authApi } from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
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
          <h1 className="font-black text-2xl text-[#1a1a1a]">Forgot your password?</h1>
          <p className="text-gray-400 font-medium mt-1 text-sm">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <div className="card p-6 shadow-sm">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#50ad32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-black text-lg text-[#1a1a1a] mb-2">Check your inbox</h2>
              <p className="text-gray-400 text-sm font-medium mb-5">
                If <span className="font-bold text-gray-600">{email}</span> is registered, you'll receive a reset link shortly. The link expires in 1 hour.
              </p>
              <Link to="/login" className="text-[#50ad32] hover:text-[#459a2a] font-bold text-sm transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Work Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@cutoffrecycle.co.tz"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : 'Send Reset Link'}
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
