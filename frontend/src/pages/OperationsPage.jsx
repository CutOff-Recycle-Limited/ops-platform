import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOperations } from '../hooks/useOperations.js';
import { operations as opsApi } from '../services/api';
import SidePanel from '../components/SidePanel.jsx';
import Avatar from '../components/Avatar.jsx';
import { formatDistanceToNow } from 'date-fns';

const COLORS = ['#50ad32', '#1f4074', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#000000'];

function StatusBadge({ status }) {
  const cfg = {
    active: 'bg-[#50ad32]/10 text-[#50ad32]',
    archived: 'bg-gray-100 text-gray-500',
    completed: 'bg-[#1f4074]/10 text-[#1f4074]',
  };
  return (
    <span className={`badge capitalize ${cfg[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

export default function OperationsPage() {
  const { operations, loading, reload } = useOperations();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', key: '', color: '#50ad32' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await opsApi.create(form);
      setShowCreate(false);
      setForm({ name: '', description: '', key: '', color: '#50ad32' });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const autoKey = (name) => name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 5);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-black text-[#1a1a1a] text-lg">Operations</h1>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            {operations.length} operation{operations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Operation
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : operations.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#50ad32]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#50ad32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-black text-[#1a1a1a] text-lg mb-1">No operations yet</h3>
            <p className="text-sm text-gray-400 font-medium mb-5">Create your first operation to get started</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              Create Operation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {operations.map(op => (
              <Link
                key={op.id}
                to={`/operations/${op.id}`}
                className="card p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group border-l-4"
                style={{ borderLeftColor: op.color }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                      style={{ backgroundColor: op.color }}
                    >
                      {op.key?.substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-black text-[#1a1a1a] text-sm group-hover:text-[#50ad32] transition-colors">
                        {op.name}
                      </h3>
                      <StatusBadge status={op.status} />
                    </div>
                  </div>
                </div>

                {op.description && (
                  <p className="text-xs text-gray-400 font-medium mb-3 line-clamp-2">{op.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {op.task_count} tasks
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {op.member_count} members
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-300 font-medium">
                    {formatDistanceToNow(new Date(op.created_at), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Side Panel — Create Operation */}
      <SidePanel
        open={showCreate}
        onClose={() => { setShowCreate(false); setError(''); }}
        title="New Operation"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="label">Operation Name *</label>
            <input
              className="input"
              placeholder="e.g. Production & R&D"
              value={form.name}
              onChange={e => {
                const name = e.target.value;
                setForm(f => ({ ...f, name, key: f.key || autoKey(name) }));
              }}
              required
            />
          </div>

          <div>
            <label className="label">Key *</label>
            <input
              className="input font-mono"
              placeholder="PROD"
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10) }))}
              required
            />
            <p className="text-xs text-gray-400 font-medium mt-1.5">Used in task IDs e.g. PROD-1</p>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none h-24"
              placeholder="What is this operation about?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Color</label>
            <div className="flex gap-2.5 flex-wrap mt-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-xl transition-all hover:scale-110 border-2"
                  style={{
                    backgroundColor: c,
                    borderColor: form.color === c ? c : 'transparent',
                    outline: form.color === c ? `3px solid ${c}40` : 'none',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          {form.name && (
            <div className="p-4 rounded-xl bg-[#f4f7f4] border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm"
                  style={{ backgroundColor: form.color }}
                >
                  {form.key?.substring(0, 2) || '??'}
                </div>
                <div>
                  <p className="font-black text-[#1a1a1a] text-sm">{form.name || 'Operation Name'}</p>
                  <p className="text-xs text-gray-400 font-mono">{form.key || 'KEY'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : 'Create Operation'}
            </button>
          </div>
        </form>
      </SidePanel>
    </div>
  );
}
