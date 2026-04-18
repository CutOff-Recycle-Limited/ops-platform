import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboard as dashApi } from '../services/api';
import Avatar from '../components/Avatar.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color} font-mono`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function ActivityIcon({ action }) {
  const icons = {
    create: { d: 'M12 4v16m8-8H4', color: 'text-green-400 bg-green-400/10' },
    status_change: { d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', color: 'text-blue-400 bg-blue-400/10' },
    comment: { d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'text-purple-400 bg-purple-400/10' },
    edit: { d: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'text-yellow-400 bg-yellow-400/10' },
    assign: { d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'text-orange-400 bg-orange-400/10' },
  };
  const cfg = icons[action] || icons.edit;
  return (
    <div className={`w-7 h-7 rounded-full ${cfg.color} flex items-center justify-center flex-shrink-0`}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={cfg.d} />
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashApi.get()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { summary, tasksByStatus, overdueTasks, tasksByUser, recentActivity } = data || {};

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-surface-border px-6 py-3.5 flex items-center justify-between backdrop-blur-sm">
        <div>
          <h1 className="font-semibold text-white text-base">Dashboard</h1>
          <p className="text-xs text-slate-500">Overview of all operations</p>
        </div>
        <Link to="/operations" className="btn-primary flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Operation
        </Link>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={summary?.total || 0} sub="across all operations" />
          <StatCard label="In Progress" value={summary?.in_progress || 0} color="text-blue-400" sub="active tasks" />
          <StatCard label="Completed" value={summary?.done || 0} color="text-green-400" sub="done this cycle" />
          <StatCard label="Overdue" value={summary?.overdue || 0} color={summary?.overdue > 0 ? 'text-red-400' : 'text-white'} sub="past due date" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks by status */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Tasks by Status</h3>
            {tasksByStatus?.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No data yet</p>
            )}
            <div className="space-y-2.5">
              {tasksByStatus?.map(s => (
                <div key={s.status_name} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-slate-300 flex-1 truncate">{s.status_name}</span>
                  <span className="text-sm font-semibold text-white font-mono">{s.count}</span>
                  <div className="w-20 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ backgroundColor: s.color, width: `${Math.min(100, (s.count / (summary?.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks per user */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Team Workload</h3>
            {tasksByUser?.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No assignments yet</p>
            )}
            <div className="space-y-3">
              {tasksByUser?.map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <Avatar name={u.name} color={u.avatar_color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{u.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[11px] text-blue-400">{u.open} open</span>
                      <span className="text-[11px] text-slate-600">·</span>
                      <span className="text-[11px] text-green-400">{u.done} done</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white font-mono">{u.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Overdue tasks */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              Overdue Tasks
              {overdueTasks?.length > 0 && (
                <span className="badge bg-red-500/10 text-red-400">{overdueTasks.length}</span>
              )}
            </h3>
            {overdueTasks?.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-sm text-slate-500">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {overdueTasks?.map(t => (
                  <div key={t.id} className="p-2.5 rounded-lg bg-surface-2 border border-surface-border hover:border-red-500/30 transition-colors">
                    <div className="flex items-start gap-2">
                      <PriorityBadge priority={t.priority} />
                      <p className="text-sm text-slate-200 truncate flex-1">{t.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-slate-500">{t.operation_key}</span>
                      <span className="text-[11px] text-red-400">
                        Due {formatDistanceToNow(new Date(t.due_date), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
          {recentActivity?.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No activity yet</p>
          )}
          <div className="space-y-3">
            {recentActivity?.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-surface-border last:border-0">
                <ActivityIcon action={a.action} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300">
                    <span className="font-medium text-white">{a.user_name}</span>
                    {' '}
                    {a.action === 'status_change' && (
                      <>moved <span className="text-slate-200">"{a.task_title}"</span> to <span className="text-blue-400">{a.new_value?.status}</span></>
                    )}
                    {a.action === 'comment' && <>commented on <span className="text-slate-200">"{a.task_title}"</span></>}
                    {a.action === 'create' && <>created <span className="text-slate-200">"{a.task_title}"</span></>}
                    {a.action === 'edit' && <>updated <span className="text-slate-200">"{a.task_title}"</span></>}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {a.operation_key} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
