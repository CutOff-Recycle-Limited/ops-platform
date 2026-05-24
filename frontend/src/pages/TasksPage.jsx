import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { auth as authApi, operations as opsApi, tasks as tasksApi } from '../services/api';
import { useAuth } from '../hooks/useAuth.jsx';
import Avatar from '../components/Avatar.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';

const EMPTY_FORM = {
  operation_id: '',
  title: '',
  description: '',
  assignee_id: '',
  priority: 'medium',
  due_date: '',
  linked_entity_type: '',
  linked_entity_id: '',
};

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function parseDate(value) {
  if (!value) return null;
  return new Date(`${String(value).slice(0, 10)}T00:00:00`);
}

function formatDueDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  return format(date, 'MMM d, yyyy');
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  const due = parseDate(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function statusLabel(status) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label || status;
}

function formatLoggedMinutes(value) {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function TimePanel({ task, entries = [], loading, currentUser, onLogTime, onEditTime, onDeleteTime }) {
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ minutes: '', note: '' });
  const [entryActionId, setEntryActionId] = useState(null);
  const [error, setError] = useState('');

  const handleLog = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onLogTime(task, { minutes: Number(minutes), note: note.trim() || null });
      setMinutes('');
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (entry) => {
    setError('');
    setEntryActionId(entry.id);
    try {
      await onEditTime(task, entry, {
        minutes: Number(editForm.minutes),
        note: editForm.note.trim() || null,
      });
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEntryActionId(null);
    }
  };

  const handleDelete = async (entry) => {
    if (!confirm('Delete this time entry?')) return;
    setError('');
    setEntryActionId(entry.id);
    try {
      await onDeleteTime(task, entry);
    } catch (err) {
      setError(err.message);
    } finally {
      setEntryActionId(null);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditForm({ minutes: String(entry.minutes), note: entry.note || '' });
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 rounded-lg bg-gray-50 p-4">
        <form onSubmit={handleLog} className="space-y-3">
          <div>
            <label className="label">Minutes</label>
            <input
              type="number"
              min="1"
              step="1"
              className="input"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Note</label>
            <input
              className="input"
              placeholder="Optional"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !minutes}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : 'Log Time'}
          </button>
          {error && <p className="text-xs font-bold text-red-500">{error}</p>}
        </form>

        <div className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="label mb-0">Time Entries</p>
            <p className="text-xs font-black text-[#1a1a1a]">{formatLoggedMinutes(task.total_logged_minutes)} total</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-300 font-medium py-4">No time logged yet</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => {
                const canManage = entry.user_id === currentUser?.id || currentUser?.role === 'admin';
                const isEditing = editingId === entry.id;
                const busy = entryActionId === entry.id;

                return (
                  <div key={entry.id} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                    <div className="flex items-start gap-3">
                      <Avatar name={entry.user_name} color={entry.user_avatar_color || '#50ad32'} size="xs" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-[#1a1a1a]">{entry.user_name}</span>
                          <span className="text-xs font-black text-[#50ad32]">{formatLoggedMinutes(entry.minutes)}</span>
                          <span className="text-[11px] text-gray-300 font-medium">{format(new Date(entry.logged_at), 'MMM d, h:mm a')}</span>
                        </div>

                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-[90px_minmax(0,1fr)_auto] gap-2 mt-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className="input py-1.5 text-xs"
                              value={editForm.minutes}
                              onChange={e => setEditForm(f => ({ ...f, minutes: e.target.value }))}
                            />
                            <input
                              className="input py-1.5 text-xs"
                              placeholder="Note"
                              value={editForm.note}
                              onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setEditingId(null)} className="btn-ghost py-1.5 text-xs">Cancel</button>
                              <button type="button" onClick={() => handleEdit(entry)} disabled={busy} className="btn-primary py-1.5 text-xs">
                                {busy ? '...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          entry.note && <p className="text-xs text-gray-500 font-medium mt-1 truncate">{entry.note}</p>
                        )}
                      </div>

                      {canManage && !isEditing && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => startEdit(entry)} className="text-xs font-bold text-gray-400 hover:text-[#50ad32]">Edit</button>
                          <button type="button" onClick={() => handleDelete(entry)} disabled={busy} className="text-xs font-bold text-gray-400 hover:text-red-500">Delete</button>
                        </div>
                      )}
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

function TaskRow({
  task,
  updating,
  expanded,
  timeEntries,
  timeEntriesLoading,
  currentUser,
  onToggleTime,
  onStatusChange,
  onLogTime,
  onEditTime,
  onDeleteTime,
}) {
  const linkedReference = task.linked_entity?.label
    ? `CRM: ${task.linked_entity.label}`
    : task.linked_entity_type || task.linked_entity_id
    ? [task.linked_entity_type, task.linked_entity_id].filter(Boolean).join(': ')
    : null;
  const linkedSummary = task.linked_entity?.summary;
  const dueDate = formatDueDate(task.due_date);
  const canonicalTaskPath = `/operations/${task.operation_id}?task=${task.id}`;

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-black text-gray-400 font-mono">
              {task.operation_key}-{task.task_number}
            </span>
            <PriorityBadge priority={task.priority} showLabel />
            <span className="badge bg-gray-100 text-gray-500 capitalize">{statusLabel(task.status)}</span>
          </div>
          <Link
            to={canonicalTaskPath}
            className="block text-sm font-black text-[#1a1a1a] leading-snug truncate hover:text-[#50ad32] transition-colors"
          >
            {task.title}
          </Link>
          {task.description && (
            <p className="text-xs text-gray-400 font-medium mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-gray-400 font-semibold">
            <span className="font-mono">{task.operation_name}</span>
            {dueDate && (
              <span className={isOverdue(task) ? 'text-red-500 font-bold' : ''}>
                Due {dueDate}
              </span>
            )}
            {linkedReference && (
              <span className="text-[#1f4074]">
                {linkedReference}
                {linkedSummary ? <span className="text-gray-400"> · {linkedSummary}</span> : null}
              </span>
            )}
            <span className="text-[#1f4074]">Logged: {formatLoggedMinutes(task.total_logged_minutes)}</span>
            <span>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap lg:w-[30rem] lg:justify-end">
          {task.assignee_name ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={task.assignee_name} color={task.assignee_color || '#50ad32'} size="xs" />
              <span className="text-xs font-bold text-gray-600 truncate">{task.assignee_name}</span>
            </div>
          ) : (
            <span className="text-xs font-bold text-gray-300">Unassigned</span>
          )}

          <Link
            to={canonicalTaskPath}
            className="btn-ghost py-1.5 text-xs"
          >
            Open in Operation
          </Link>

          <button
            type="button"
            onClick={() => onToggleTime(task)}
            className={`btn-ghost py-1.5 text-xs ${expanded ? 'bg-[#50ad32]/10 text-[#50ad32]' : ''}`}
          >
            Log Time
          </button>

          <select
            className="input w-36 py-1.5 text-xs font-bold"
            value={task.status || 'todo'}
            disabled={updating}
            onChange={e => onStatusChange(task, e.target.value)}
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {expanded && (
        <TimePanel
          task={task}
          entries={timeEntries}
          loading={timeEntriesLoading}
          currentUser={currentUser}
          onLogTime={onLogTime}
          onEditTime={onEditTime}
          onDeleteTime={onDeleteTime}
        />
      )}
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuth();
  const [taskList, setTaskList] = useState([]);
  const [operations, setOperations] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [timeEntriesByTask, setTimeEntriesByTask] = useState({});
  const [timeLoadingTaskId, setTimeLoadingTaskId] = useState(null);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    const res = await tasksApi.today();
    setTaskList(res.tasks || []);
  };

  const updateTaskSummary = (task) => {
    setTaskList(current => current.map(item => item.id === task.id ? task : item));
  };

  const loadTimeEntries = async (taskId) => {
    setTimeLoadingTaskId(taskId);
    try {
      const res = await tasksApi.timeEntries(taskId);
      setTimeEntriesByTask(current => ({ ...current, [taskId]: res.entries || [] }));
    } finally {
      setTimeLoadingTaskId(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [tasksRes, opsRes, usersRes] = await Promise.all([
          tasksApi.today(),
          opsApi.list(),
          authApi.users(),
        ]);
        if (!mounted) return;
        const nextOperations = opsRes.operations || [];
        setTaskList(tasksRes.tasks || []);
        setOperations(nextOperations);
        setUsers(usersRes.users || []);
        setForm(f => ({ ...f, operation_id: f.operation_id || nextOperations[0]?.id || '' }));
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const openCount = useMemo(
    () => taskList.filter(task => task.status !== 'done').length,
    [taskList]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required');
    if (!form.operation_id) return setError('Choose an operation before creating a task');

    setSaving(true);
    try {
      await tasksApi.createGeneral({
        ...form,
        title: form.title.trim(),
        description: form.description.trim() || null,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
        linked_entity_type: form.linked_entity_type.trim() || null,
        linked_entity_id: form.linked_entity_id.trim() || null,
      });
      const operationId = form.operation_id;
      setForm({ ...EMPTY_FORM, operation_id: operationId });
      await loadTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (task, status) => {
    if (status === task.status) return;
    setUpdatingTaskId(task.id);
    setError('');
    try {
      const res = await tasksApi.patch(task.id, { status });
      updateTaskSummary(res.task);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleToggleTime = async (task) => {
    if (expandedTaskId === task.id) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(task.id);
    if (!timeEntriesByTask[task.id]) {
      try {
        await loadTimeEntries(task.id);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleLogTime = async (task, payload) => {
    const res = await tasksApi.createTimeEntry(task.id, payload);
    setTimeEntriesByTask(current => ({
      ...current,
      [task.id]: [res.entry, ...(current[task.id] || [])],
    }));
    if (res.task) updateTaskSummary(res.task);
  };

  const handleEditTime = async (task, entry, payload) => {
    const res = await tasksApi.updateTimeEntry(task.id, entry.id, payload);
    setTimeEntriesByTask(current => ({
      ...current,
      [task.id]: (current[task.id] || []).map(item => item.id === entry.id ? res.entry : item),
    }));
    if (res.task) updateTaskSummary(res.task);
  };

  const handleDeleteTime = async (task, entry) => {
    const res = await tasksApi.deleteTimeEntry(task.id, entry.id);
    setTimeEntriesByTask(current => ({
      ...current,
      [task.id]: (current[task.id] || []).filter(item => item.id !== entry.id),
    }));
    if (res.task) updateTaskSummary(res.task);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f7f4]">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-black text-[#1a1a1a] text-lg">Tasks</h1>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">
            {openCount} open task{openCount !== 1 ? 's' : ''} in today's view
          </p>
        </div>
        <button
          onClick={() => loadTasks().catch(err => setError(err.message))}
          className="btn-outline flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5.64 18.36A9 9 0 0118.36 5.64M18.36 5.64H14m4.36 0V10M5.64 18.36H10m-4.36 0V14" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <section className="space-y-3 min-w-0">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : taskList.length === 0 ? (
            <div className="card p-10 text-center">
              <h2 className="font-black text-[#1a1a1a] text-base">No tasks to show</h2>
              <p className="text-sm text-gray-400 font-medium mt-1">Create a task to add it to the daily view.</p>
            </div>
          ) : (
            taskList.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                updating={updatingTaskId === task.id}
                expanded={expandedTaskId === task.id}
                timeEntries={timeEntriesByTask[task.id] || []}
                timeEntriesLoading={timeLoadingTaskId === task.id}
                currentUser={user}
                onToggleTime={handleToggleTime}
                onStatusChange={handleStatusChange}
                onLogTime={handleLogTime}
                onEditTime={handleEditTime}
                onDeleteTime={handleDeleteTime}
              />
            ))
          )}
        </section>

        <aside className="card p-5 h-fit">
          <h2 className="text-sm font-black text-[#1a1a1a] mb-4">Create Task</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Operation *</label>
              <select
                className="input"
                value={form.operation_id}
                onChange={e => setForm(f => ({ ...f, operation_id: e.target.value }))}
                disabled={operations.length === 0}
                required
              >
                {operations.length === 0 ? (
                  <option value="">No operations available</option>
                ) : (
                  operations.map(op => <option key={op.id} value={op.id}>{op.name}</option>)
                )}
              </select>
            </div>

            <div>
              <label className="label">Title *</label>
              <input
                className="input"
                placeholder="What needs doing?"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input resize-none h-20"
                placeholder="Optional details"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                >
                  {PRIORITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="label">Assignee</label>
              <select
                className="input"
                value={form.assignee_id}
                onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Entity Type</label>
                <input
                  className="input"
                  placeholder="order"
                  value={form.linked_entity_type}
                  onChange={e => setForm(f => ({ ...f, linked_entity_type: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Entity ID</label>
                <input
                  className="input"
                  placeholder="123"
                  value={form.linked_entity_id}
                  onChange={e => setForm(f => ({ ...f, linked_entity_id: e.target.value }))}
                />
              </div>
            </div>

            {operations.length === 0 && (
              <p className="text-xs text-gray-400 font-semibold">Create an operation before adding tasks.</p>
            )}

            <button
              type="submit"
              disabled={saving || operations.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Task'
              )}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
