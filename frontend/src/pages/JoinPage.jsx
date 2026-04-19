import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { invites as invitesApi, auth as authApi } from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [role, setRole] = useState('member');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setValidating(false); return; }
    invitesApi.validate(token)
      .then(res => { setValid(true); setRole(res.role); })
      .catch(() => setValid(false))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      
      // Register with invite token
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, invite_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('ops_token', data.token);
      navigate('/dashboard');
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (validating) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7f4]">
      <div className="flex flex-col items-center gap-3">
        <img src="/cr-logo.png" alt="CR" className="w-12 h-12" />
        <div className="w-5 h-5 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!valid) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7f4] p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="font-black text-xl text-[#1a1a1a] mb-2">Invalid Invite Link</h2>
        <p className="text-gray-400 font-medium text-sm mb-5">This link has expired or already been used. Ask your admin for a new invite.</p>
        <a href="/login" className="btn-primary inline-flex">Go to Sign In</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7f4] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/cr-logo.png" alt="CutOff Recycle" className="w-14 h-14 mx-auto mb-4" />
          <h1 className="font-black text-2xl text-[#1a1a1a]">You're invited!</h1>
          <p className="text-gray-400 font-medium mt-1">
            Join CutOff Recycle Operations Platform as a{' '}
            <span className="font-black text-[#50ad32] capitalize">{role}</span>
          </p>
        </div>

        <div className="card p-6 shadow-sm">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Work Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@cutoffrecycle.co.tz"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
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
              ) : 'Create My Account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 font-medium mt-4">
            Already have an account?{' '}
            <a href="/login" className="text-[#50ad32] font-bold">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
