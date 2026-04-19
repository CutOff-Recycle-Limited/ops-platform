import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'Mulish, sans-serif' }}>
      {/* Left panel — brand */}
      <div className="hidden lg:flex w-1/2 bg-[#50ad32] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border-4 border-white"
              style={{
                width: `${(i + 2) * 80}px`,
                height: `${(i + 2) * 80}px`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
  <img src="/cr-logo.png" alt="CutOff Recycle" className="w-12 h-12" />
</div>

        <div className="relative z-10">
          <h1 className="text-5xl font-black text-white leading-tight mb-4">
            CutOff Recycle<br />Operations Hub
          </h1>
          <p className="text-white/80 text-lg font-medium leading-relaxed max-w-sm">
            Manage production, track tasks, coordinate your team — all in one place.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: 'Hair Recycled', value: '4+ Tons' },
              { label: 'Weekly Output', value: '200 L' },
              { label: 'Team Members', value: '8+' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/15 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-white font-black text-xl">{stat.value}</p>
                <p className="text-white/70 text-xs font-semibold mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/60 text-xs font-medium">
            Human Hair Waste Recycling · Arusha, Tanzania
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-[#f4f7f4] p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <img src="/cr-logo.png" alt="CutOff Recycle" className="w-10 h-10" />
            <div>
              <p className="font-black text-[#1a1a1a] text-lg leading-tight">CutOff Recycle</p>
              <p className="text-[#50ad32] text-xs font-bold">Operations Hub</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-[#1a1a1a]">
              {mode === 'login' ? 'Welcome back' : 'Join the team'}
            </h2>
            <p className="text-gray-500 mt-1 font-medium">
              {mode === 'login'
                ? 'Sign in to your workspace to continue'
                : 'Create your account to get started'}
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  placeholder="e.g. Mercy Alfayo"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}

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
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="member">Team Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 font-medium">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-[#50ad32] hover:text-[#459a2a] font-bold transition-colors"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400 font-medium">
              © {new Date().getFullYear()} CutOff Recycle Limited · Arusha, Tanzania
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
