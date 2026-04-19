import { useState, useEffect } from 'react';
import { users as usersApi, invites as invitesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import { formatDistanceToNow } from 'date-fns';

const ROLE_COLORS = {
  admin: 'bg-[#1f4074]/10 text-[#1f4074]',
  manager: 'bg-[#50ad32]/10 text-[#50ad32]',
  member: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [userList, setUserList] = useState([]);
  const [inviteList, setInviteList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const load = async () => {
    try {
      setLoading(true);
      const [usersRes, invitesRes] = await Promise.all([
        usersApi.list(),
        invitesApi.list().catch(() => ({ invites: [] })),
      ]);
      setUserList(usersRes.users);
      setInviteList(invitesRes.invites || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const res = await invitesApi.create(inviteRole);
      setGeneratedLink(res.inviteUrl);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await usersApi.updateRole(userId, role);
      setUserList(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (userId, name) => {
    if (!confirm(`Remove ${name} from the platform?`)) return;
    try {
      await usersApi.delete(userId);
      setUserList(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-black text-[#1a1a1a] text-lg">Team & Users</h1>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">{userList.length} team members</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowInviteModal(true); setGeneratedLink(''); }}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Generate Invite Link
          </button>
        )}
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Users table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-black text-[#1a1a1a] text-sm">All Team Members</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {userList.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <Avatar name={u.name} color={u.avatar_color} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#1a1a1a] text-sm">{u.name}</p>
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] font-black text-[#50ad32] bg-[#50ad32]/10 px-1.5 py-0.5 rounded">YOU</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-medium">{u.email}</p>
                  </div>

                  {/* Role selector */}
                  {isAdmin && u.id !== currentUser?.id ? (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#50ad32] bg-white"
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`badge capitalize ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  )}

                  <p className="text-xs text-gray-400 font-medium w-28 text-right hidden sm:block">
                    Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </p>

                  {isAdmin && u.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                      title="Remove user"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite history */}
        {isAdmin && inviteList.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-black text-[#1a1a1a] text-sm">Invite History</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {inviteList.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-gray-400 truncate">{inv.token?.substring(0, 24)}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Created by <span className="font-bold text-gray-600">{inv.created_by_name}</span>
                      {' · '}{formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`badge capitalize ${ROLE_COLORS[inv.role]}`}>{inv.role}</span>
                  <span className={`badge ${inv.used ? 'bg-gray-100 text-gray-500' : 'bg-[#50ad32]/10 text-[#50ad32]'}`}>
                    {inv.used ? `Used by ${inv.used_by_name || 'someone'}` : 'Active'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Invite Modal */}
      <Modal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Generate Invite Link" size="md">
        <div className="space-y-5">
          <p className="text-sm text-gray-500 font-medium">
            Generate a unique invite link to share with your team member. The link expires in 7 days and can only be used once.
          </p>

          <div>
            <label className="label">Role for new member</label>
            <div className="grid grid-cols-3 gap-3">
              {['member', 'manager', 'admin'].map(r => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                    inviteRole === r
                      ? 'border-[#50ad32] bg-[#50ad32]/10 text-[#50ad32]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {!generatedLink ? (
            <button
              onClick={handleGenerateInvite}
              disabled={generating}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {generating ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Generate Link
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-[#f4f7f4] rounded-xl border border-[#50ad32]/20">
                <p className="text-xs font-bold text-gray-500 mb-1.5">INVITE LINK (expires in 7 days)</p>
                <p className="text-xs font-mono text-[#1a1a1a] break-all">{generatedLink}</p>
              </div>
              <button
                onClick={handleCopy}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  copied
                    ? 'bg-[#50ad32] text-white'
                    : 'bg-[#50ad32]/10 text-[#50ad32] hover:bg-[#50ad32]/20'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy to Clipboard
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 text-center font-medium">
                Share this link via WhatsApp, email, or Slack
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
