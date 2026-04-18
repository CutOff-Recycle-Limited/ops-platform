import { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import Avatar from '../components/Avatar.jsx';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-surface border-b border-surface-border px-6 py-3.5">
        <h1 className="font-semibold text-white text-base">Settings</h1>
        <p className="text-xs text-slate-500">Manage your account and preferences</p>
      </div>

      <div className="p-6 max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-1 p-1 rounded-xl border border-surface-border w-fit">
          {['profile', 'account'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-surface-border">
              <Avatar name={user?.name} color={user?.avatar_color} size="xl" />
              <div>
                <h3 className="font-semibold text-white text-base">{user?.name}</h3>
                <p className="text-sm text-slate-400">{user?.email}</p>
                <span className="badge bg-accent/10 text-accent-light mt-1.5 capitalize">{user?.role}</span>
              </div>
            </div>

            <div>
              <label className="label">Full Name</label>
              <input className="input" defaultValue={user?.name} />
            </div>

            <div>
              <label className="label">Email</label>
              <input className="input" type="email" defaultValue={user?.email} />
            </div>

            <div className="pt-2">
              <button className="btn-primary">Save Changes</button>
            </div>
          </div>
        )}

        {tab === 'account' && (
          <div className="card p-6 space-y-5">
            <h3 className="font-semibold text-white">Change Password</h3>

            <div>
              <label className="label">Current Password</label>
              <input className="input" type="password" placeholder="••••••••" />
            </div>

            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" placeholder="••••••••" />
            </div>

            <div>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" placeholder="••••••••" />
            </div>

            <div className="pt-2">
              <button className="btn-primary">Update Password</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
