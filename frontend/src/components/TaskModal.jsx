import { useState, useEffect } from 'react';
import { useTask } from '../hooks/useTasks.js';
import { tasks as tasksApi, comments as commentsApi } from '../services/api';
import Avatar from './Avatar.jsx';
import PriorityBadge, { PRIORITIES } from './PriorityBadge.jsx';
import { formatDistanceToNow, format } from 'date-fns';

const TYPE_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'epic', label: 'Epic' },
  { value: 'subtask', label: 'Subtask' },
];

function Section({ title, children }) {
  return (
    <div>
      <p className="label">{title}</p>
      {children}
    </div>
  );
}

export default function TaskModal({ taskId, operationKey, statuses = [], transitions = [], users = [], onClose, onUpdate }) {
  const { task, subtasks, comments, activity, loading, reload, setTask, setCommentList } = useTask(taskId);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');

  useEffect(() => {
    if (task) {
      setEditForm({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        assignee_id: task.assignee_id || '',
        due_date: task.due_date ? task.due_date.substring(0, 10) : '',
        type: task.type,
      });
    }
  }, [task]);

  const allowedTransitions = transitions.filter(t =>
    t.from_status_id === task?.status_id || t.from_status_id === null
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        assignee_id: editForm.assignee_id || null,
        due_date: editForm.due_date || null,
      };
      await tasksApi.update(task.id, payload);
      setEditing(false);
      reload();
      onUpdate?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (statusId) => {
    try {
      await tasksApi.transition(task.id, statusId);
      reload();
      onUpdate?.();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await commentsApi.create(task.id, commentText.trim());
      setCommentList(prev => [...prev, res.comment]);
      setCommentText('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await commentsApi.delete(commentId);
      setCommentList(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !task) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentStatus = statuses.find(s => s.id === task.status_id);

  return (
    <div className="flex h-full max-h-[85vh]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 border-r border-surface-border">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <span className="font-mono">{operationKey}-{task.task_number}</span>
          <span>/</span>
          <span style={{ color: currentStatus?.color }}>{currentStatus?.name}</span>
        </div>

        {/* Title */}
        {editing ? (
          <input
            className="input text-base font-semibold mb-4 text-white"
            value={editForm.title}
            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
          />
        ) : (
          <h2 className="text-lg font-semibold text-white mb-4 leading-snug">{task.title}</h2>
        )}

        {/* Transitions */}
        {allowedTransitions.length > 0 && !editing && (
          <div className="flex flex-wrap gap-2 mb-5 pb-5 border-b border-surface-border">
            {allowedTransitions.map(t => {
              const toStatus = statuses.find(s => s.id === t.to_status_id);
              return (
                <button
                  key={t.id}
                  onClick={() => handleTransition(t.to_status_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                  style={{
                    borderColor: toStatus?.color + '50',
                    color: toStatus?.color,
                    backgroundColor: toStatus?.color + '10',
                  }}
                >
                  <span>→</span>
                  {t.name || toStatus?.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Description */}
        <div className="mb-5">
          <p className="label">Description</p>
          {editing ? (
            <textarea
              className="input resize-none h-28"
              placeholder="Add a description..."
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
            />
          ) : (
            <p className="text-sm text-slate-400 whitespace-pre-wrap min-h-[40px]">
              {task.description || <span className="text-slate-600 italic">No description</span>}
            </p>
          )}
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div className="mb-5">
            <p className="label">Subtasks ({subtasks.length})</p>
            <div className="space-y-1.5">
              {subtasks.map(s => {
                const sStatus = statuses.find(st => st.id === s.status_id);
                return (
                  <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-2 border border-surface-border">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sStatus?.color || '#6b7280' }} />
                    <span className="text-sm text-slate-300 flex-1 truncate">{s.title}</span>
                    {s.assignee_name && <Avatar name={s.assignee_name} color="#6366f1" size="xs" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-surface-border mb-4">
          <div className="flex gap-4">
            {['comments', 'activity'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-accent text-accent-light'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab}
                {tab === 'comments' && comments.length > 0 && (
                  <span className="ml-1.5 text-xs bg-surface-2 rounded-full px-1.5 py-0.5">{comments.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Comment input */}
            <form onSubmit={handleComment} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
              />
              <button type="submit" disabled={submittingComment || !commentText.trim()} className="btn-primary px-3">
                {submittingComment ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>

            {comments.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">No comments yet. Be the first!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className="flex gap-3 group">
                  <Avatar name={c.user_name} color={c.avatar_color} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{c.user_name}</span>
                      <span className="text-[11px] text-slate-600">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                      {c.edited && <span className="text-[11px] text-slate-600">(edited)</span>}
                    </div>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 self-start mt-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">No activity yet</p>
            ) : (
              activity.map(a => (
                <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-surface-border last:border-0">
                  <Avatar name={a.user_name} color={a.avatar_color} size="xs" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-200 font-medium">{a.user_name}</span>
                      {' '}
                      {a.action === 'status_change' && <>moved to <span className="text-blue-400">{a.new_value?.status}</span></>}
                      {a.action === 'create' && 'created this task'}
                      {a.action === 'comment' && 'added a comment'}
                      {a.action === 'edit' && 'edited this task'}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {format(new Date(a.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 p-5 space-y-4 overflow-y-auto">
        {/* Edit / Save actions */}
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-1.5 text-xs">
                {saving ? '...' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-ghost w-full py-1.5 text-xs flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Task
            </button>
          )}
        </div>

        {/* Status */}
        <Section title="Status">
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatus?.color }} />
            <span className="text-sm text-slate-300">{currentStatus?.name}</span>
          </div>
        </Section>

        {/* Type */}
        <Section title="Type">
          {editing ? (
            <select className="input text-xs py-1.5" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          ) : (
            <p className="text-sm text-slate-300 capitalize py-0.5">{task.type}</p>
          )}
        </Section>

        {/* Priority */}
        <Section title="Priority">
          {editing ? (
            <select className="input text-xs py-1.5" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          ) : (
            <PriorityBadge priority={task.priority} showLabel />
          )}
        </Section>

        {/* Assignee */}
        <Section title="Assignee">
          {editing ? (
            <select className="input text-xs py-1.5" value={editForm.assignee_id} onChange={e => setEditForm(f => ({ ...f, assignee_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : task.assignee_name ? (
            <div className="flex items-center gap-2 py-0.5">
              <Avatar name={task.assignee_name} color={task.assignee_color} size="xs" />
              <span className="text-sm text-slate-300">{task.assignee_name}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-600 py-0.5">Unassigned</p>
          )}
        </Section>

        {/* Reporter */}
        <Section title="Reporter">
          <div className="flex items-center gap-2 py-0.5">
            <Avatar name={task.reporter_name} color={task.reporter_color} size="xs" />
            <span className="text-sm text-slate-300">{task.reporter_name}</span>
          </div>
        </Section>

        {/* Due Date */}
        <Section title="Due Date">
          {editing ? (
            <input
              type="date"
              className="input text-xs py-1.5"
              value={editForm.due_date}
              onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
            />
          ) : task.due_date ? (
            <p className={`text-sm py-0.5 ${
              new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-slate-300'
            }`}>
              {format(new Date(task.due_date), 'MMM d, yyyy')}
            </p>
          ) : (
            <p className="text-sm text-slate-600 py-0.5">No due date</p>
          )}
        </Section>

        {/* Created */}
        <Section title="Created">
          <p className="text-xs text-slate-500 py-0.5">
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
          </p>
        </Section>
      </div>
    </div>
  );
}
