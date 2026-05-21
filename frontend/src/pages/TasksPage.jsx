import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { auth as authApi, operations as opsApi, tasks as tasksApi } from '../services/api';
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

function TaskRow({ task, updating, onStatusChange }) {
  const linkedReference = task.linked_entity_type || task.linked_entity_id
    ? [task.linked_entity_type, task.linked_entity_id].filter(Boolean).join(': ')
    : null;
  const dueDate = formatDueDate(task.due_date);

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
          <h2 className="text-sm font-black text-[#1a1a1a] leading-snug truncate">{task.title}</h2>
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
              <span className="font-mono text-[#1f4074]">{linkedReference}</span>
            )}
            <span>{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:w-72 lg:justify-end">
          {task.assignee_name ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar name={task.assignee_name} color={task.assignee_color || '#50ad32'} size="xs" />
              <span className="text-xs font-bold text-gray-600 truncate">{task.assignee_name}</span>
            </div>
          ) : (
            <span className="text-xs font-bold text-gray-300">Unassigned</span>
          )}

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
    </div>
  );
}

export default function TasksPage() {
  const [taskList, setTaskList] = useState([]);
  const [operations, setOperations] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    const res = await tasksApi.today();
    setTaskList(res.tasks || []);
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
      setTaskList(current => current.map(item => item.id === task.id ? res.task : item));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingTaskId(null);
    }
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
                onStatusChange={handleStatusChange}
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
