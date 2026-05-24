import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboard as dashApi, tasks as tasksApi } from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';
import Avatar from '../components/Avatar.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import { format, formatDistanceToNow } from 'date-fns';

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`card p-5 border-l-4 ${accent ? 'border-l-[#50ad32]' : 'border-l-gray-200'}`}>
      <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-black font-mono ${accent ? 'text-[#50ad32]' : 'text-[#1a1a1a]'}`}>{value ?? 0}</p>
      {sub && <p className="text-xs text-gray-400 font-medium mt-1">{sub}</p>}
    </div>
  );
}

function formatLoggedMinutes(value) {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function dateKey(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return format(date, 'yyyy-MM-dd');
}

function formatDueDate(value) {
  if (!value) return null;
  return format(new Date(`${String(value).slice(0, 10)}T00:00:00`), 'MMM d');
}

function linkedCrmLabel(task) {
  if (task.linked_entity?.customer_name) return `Customer: ${task.linked_entity.customer_name}`;
  if (task.linked_entity?.label) return `CRM: ${task.linked_entity.label}`;
  if (task.linked_entity_type) return `CRM: ${task.linked_entity_type.replace(/_/g, ' ')}`;
  return null;
}

const ACTION_LABELS = {
  status_change: (a) => <>moved to <span className="font-black text-[#50ad32]">{a.new_value?.status}</span></>,
  comment: () => 'added a comment',
  create: () => 'created a task',
  edit: () => 'updated a task',
  assign: () => 'assigned a task',
  time_add: (a) => <>logged <span className="font-black text-[#50ad32]">{formatLoggedMinutes(a.new_value?.minutes)}</span></>,
  time_edit: () => 'edited logged time',
  time_delete: () => 'deleted logged time',
};

const ACTION_COLORS = {
  status_change: 'bg-blue-50 text-blue-600',
  comment: 'bg-purple-50 text-purple-600',
  create: 'bg-[#50ad32]/10 text-[#50ad32]',
  edit: 'bg-yellow-50 text-yellow-600',
  assign: 'bg-orange-50 text-orange-600',
  time_add: 'bg-[#1f4074]/10 text-[#1f4074]',
  time_edit: 'bg-[#1f4074]/10 text-[#1f4074]',
  time_delete: 'bg-red-50 text-red-500',
};

const ACTION_ICONS = {
  status_change: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  comment: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  create: 'M12 4v16m8-8H4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  assign: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  time_add: 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
  time_edit: 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
  time_delete: 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
};

function TaskListCard({ title, count, tasks = [], empty, tone = 'blue', showAssignee = false }) {
  const toneClasses = {
    blue: 'bg-[#1f4074]/10 text-[#1f4074]',
    green: 'bg-[#50ad32]/10 text-[#50ad32]',
    red: 'bg-red-50 text-red-500',
    orange: 'bg-orange-50 text-orange-600',
    gray: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="card p-5 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-black text-[#1a1a1a]">{title}</h3>
        <span className={`badge ${toneClasses[tone] || toneClasses.gray}`}>{count ?? tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-300 font-medium py-6 text-center">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {tasks.map(task => {
            const dueDate = formatDueDate(task.due_date);
            const crmLabel = linkedCrmLabel(task);

            return (
              <Link
                key={task.id}
                to={`/operations/${task.operation_id}?task=${task.id}`}
                className="block p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-[#50ad32]/40 hover:bg-white transition-colors"
              >
                <div className="flex items-start gap-2">
                  <PriorityBadge priority={task.priority} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1a1a1a] truncate">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-gray-400 font-semibold">
                      <span className="font-mono">{task.operation_key}-{task.task_number}</span>
                      {dueDate && <span>Due {dueDate}</span>}
                      {task.status_name && <span>{task.status_name}</span>}
                    </div>
                    {crmLabel && (
                      <p className="text-[11px] text-[#1f4074] font-bold mt-1 truncate">{crmLabel}</p>
                    )}
                  </div>
                  {showAssignee && task.assignee_name && (
                    <Avatar name={task.assignee_name} color={task.assignee_color || task.avatar_color} size="xs" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      try {
        const today = dateKey();
        const soonCutoff = dateKey(8);
        const [
          dashboard,
          myTasks,
          overdueTasks,
          dueSoonTasks,
          highPriorityTasks,
          recentlyCompletedTasks,
        ] = await Promise.all([
          dashApi.get(),
          tasksApi.all({ assignee_id: user.id, status_category: 'open', limit: 5 }),
          tasksApi.all({ due_before: today, status_category: 'open', limit: 5 }),
          tasksApi.all({ due_after: today, due_before: soonCutoff, status_category: 'open', limit: 5 }),
          tasksApi.all({ priority: 'critical,high', status_category: 'open', limit: 5 }),
          tasksApi.all({ completed_recently: '14', limit: 5 }),
        ]);

        if (!mounted) return;
        setData({
          ...dashboard,
          launchTasks: {
            myTasks: myTasks.tasks || [],
            overdueTasks: overdueTasks.tasks || [],
            dueSoonTasks: dueSoonTasks.tasks || [],
            highPriorityTasks: highPriorityTasks.tasks || [],
            recentlyCompletedTasks: recentlyCompletedTasks.tasks || [],
          },
        });
      } catch (err) {
        console.error(err);
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (user?.id) loadDashboard();
    return () => { mounted = false; };
  }, [user?.id]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#f4f7f4]">
      <div className="flex flex-col items-center gap-3">
        <img src="/cr-logo.png" alt="CR" className="w-10 h-10 animate-pulse" />
        <div className="w-5 h-5 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const {
    summary = {},
    tasksByStatus = [],
    tasksByUser = [],
    recentActivity = [],
    launchTasks = {},
  } = data || {};
  const {
    myTasks = [],
    overdueTasks = [],
    dueSoonTasks = [],
    highPriorityTasks = [],
    recentlyCompletedTasks = [],
  } = launchTasks;
  const total = parseInt(summary.total) || 0;
  const canSeeTeamWorkload = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f7f4]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-black text-[#1a1a1a] text-lg">Dashboard</h1>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">Overview of all operations</p>
        </div>
        <Link to="/operations" className="btn-primary flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Operation
        </Link>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
          <StatCard label="My Open" value={summary.my_open ?? myTasks.length} sub="assigned to me" accent />
          <StatCard
            label="Overdue"
            value={summary.overdue ?? 0}
            sub="past due date"
            accent={parseInt(summary.overdue) > 0}
          />
          <StatCard label="Due Soon" value={summary.due_soon ?? dueSoonTasks.length} sub="next 7 days" />
          <StatCard label="High Priority" value={summary.high_priority ?? highPriorityTasks.length} sub="critical or high" />
          <StatCard label="In Progress" value={summary.in_progress ?? 0} sub="active right now" />
          <StatCard label="Completed" value={summary.done ?? 0} sub="finished tasks" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <TaskListCard
            title="My Tasks"
            count={summary.my_open ?? myTasks.length}
            tasks={myTasks}
            empty="No open tasks assigned to you"
            tone="green"
          />
          <TaskListCard
            title="Due Soon"
            count={summary.due_soon ?? dueSoonTasks.length}
            tasks={dueSoonTasks}
            empty="Nothing due in the next 7 days"
            tone="blue"
            showAssignee={canSeeTeamWorkload}
          />
          <TaskListCard
            title="High Priority"
            count={summary.high_priority ?? highPriorityTasks.length}
            tasks={highPriorityTasks}
            empty="No critical or high priority open tasks"
            tone="orange"
            showAssignee={canSeeTeamWorkload}
          />
          <TaskListCard
            title="Overdue"
            count={summary.overdue ?? overdueTasks.length}
            tasks={overdueTasks}
            empty="No overdue tasks"
            tone="red"
            showAssignee={canSeeTeamWorkload}
          />
          <TaskListCard
            title="Recently Completed"
            count={summary.recently_completed ?? recentlyCompletedTasks.length}
            tasks={recentlyCompletedTasks}
            empty="No tasks completed in the last 14 days"
            tone="gray"
            showAssignee={canSeeTeamWorkload}
          />
          <div className="card p-5">
            <h3 className="text-sm font-black text-[#1a1a1a] mb-4">Work Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</p>
                <p className="text-2xl font-black text-[#1a1a1a] font-mono mt-1">{summary.total ?? 0}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active</p>
                <p className="text-2xl font-black text-[#1f4074] font-mono mt-1">{summary.in_progress ?? 0}</p>
              </div>
            </div>
            <Link to="/tasks" className="btn-outline w-full mt-4 flex items-center justify-center">Open Tasks View</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks by status */}
          <div className="card p-5">
            <h3 className="text-sm font-black text-[#1a1a1a] mb-4">Tasks by Status</h3>
            {tasksByStatus.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-300 font-medium">No tasks yet</p>
                <Link to="/operations" className="text-xs text-[#50ad32] font-bold mt-1 inline-block">Create an operation →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {tasksByStatus.map(s => (
                  <div key={s.status_name} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-gray-600 font-semibold flex-1 truncate">{s.status_name}</span>
                    <span className="text-sm font-black text-[#1a1a1a] font-mono w-6 text-right">{s.count}</span>
                    <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: s.color,
                          width: total > 0 ? `${Math.min(100, (parseInt(s.count) / total) * 100)}%` : '0%'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {canSeeTeamWorkload && (
            <div className="card p-5">
              <h3 className="text-sm font-black text-[#1a1a1a] mb-4">Team Workload</h3>
              {tasksByUser.length === 0 ? (
                <p className="text-sm text-gray-300 font-medium text-center py-6">No assignments yet</p>
              ) : (
                <div className="space-y-3">
                  {tasksByUser.map(u => (
                    <div key={u.id} className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatar_color} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#1a1a1a] truncate">{u.name}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[11px] font-bold text-blue-500">{u.open} open</span>
                          <span className="text-[11px] text-gray-300">·</span>
                          <span className="text-[11px] font-bold text-[#50ad32]">{u.done} done</span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-[#1a1a1a] font-mono">{u.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <h3 className="text-sm font-black text-[#1a1a1a] mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-300 font-medium text-center py-6">No activity yet — tasks and comments will appear here</p>
          ) : (
            <div className="space-y-0 divide-y divide-gray-50">
              {recentActivity.map(a => {
                const iconPath = ACTION_ICONS[a.action] || ACTION_ICONS.edit;
                const colorClass = ACTION_COLORS[a.action] || ACTION_COLORS.edit;
                return (
                  <div key={a.id} className="flex items-start gap-3 py-3">
                    <div className={`w-7 h-7 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 font-medium">
                        <span className="font-black text-[#1a1a1a]">{a.user_name}</span>
                        {' '}
                        {ACTION_LABELS[a.action]?.(a) || a.action}
                        {' on '}
                        <span className="font-bold text-[#1a1a1a]">"{a.task_title}"</span>
                      </p>
                      <p className="text-[11px] text-gray-300 font-medium mt-0.5">
                        <span className="font-bold text-gray-400">{a.operation_key}</span>
                        {' · '}
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
