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

function formatLoggedMinutes(value) {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function linkedCrmLabel(task) {
  if (task.linked_entity?.customer_name) return `Customer: ${task.linked_entity.customer_name}`;
  if (task.linked_entity?.label) return `CRM: ${task.linked_entity.label}`;
  if (task.linked_entity_type) return `CRM: ${task.linked_entity_type.replace(/_/g, ' ')}`;
  return null;
}

function LinkedCrmContext({ task }) {
  const linked = task.linked_entity;
  const primaryLabel = linkedCrmLabel(task);
  if (!linked && !task.linked_entity_type && !task.linked_entity_id) return null;

  if (!linked) {
    return (
      <div className="mb-5 p-3 rounded-lg bg-[#1f4074]/5 border border-[#1f4074]/10">
        <p className="label">Linked Entity</p>
        <p className="text-xs text-[#1f4074] font-bold">{primaryLabel}</p>
        {task.linked_entity_id && (
          <p className="text-[11px] text-gray-300 font-mono break-all mt-1">
            {task.linked_entity_type}: {task.linked_entity_id}
          </p>
        )}
      </div>
    );
  }

  const details = [
    linked.customer_name && ['Customer', linked.customer_phone ? `${linked.customer_name} · ${linked.customer_phone}` : linked.customer_name],
    linked.channel && ['Interaction', [linked.channel, linked.outcome].filter(Boolean).join(' · ')],
    linked.lead_score && ['Lead score', linked.lead_score],
    linked.urgency && ['Urgency', linked.urgency],
    linked.sentiment && ['Sentiment', linked.sentiment],
  ].filter(Boolean);

  return (
    <div className="mb-5 p-3 rounded-lg bg-[#1f4074]/5 border border-[#1f4074]/10">
      <p className="label">Linked CRM Context</p>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-black text-[#1a1a1a]">{primaryLabel || linked.label}</p>
          {linked.summary && <p className="text-xs text-gray-500 font-semibold mt-0.5">{linked.summary}</p>}
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 text-xs">
              <span className="text-gray-400 font-bold">{label}</span>
              <span className="text-gray-700 font-semibold text-right capitalize">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-300 font-mono break-all">
          {task.linked_entity_type}: {task.linked_entity_id}
        </p>
      </div>
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
      await tasksApi.update(task.id, { ...editForm, assignee_id: editForm.assignee_id || null, due_date: editForm.due_date || null });
      setEditing(false);
      reload();
      onUpdate?.();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleTransition = async (statusId) => {
    try {
      await tasksApi.transition(task.id, statusId);
      reload();
      onUpdate?.();
    } catch (err) { alert(err.message); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await commentsApi.create(task.id, commentText.trim());
      setCommentList(prev => [...prev, res.comment]);
      setCommentText('');
    } catch (err) { alert(err.message); }
    finally { setSubmittingComment(false); }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await commentsApi.delete(commentId);
      setCommentList(prev => prev.filter(c => c.id !== commentId));
    } catch (err) { alert(err.message); }
  };

  if (loading || !task) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const currentStatus = statuses.find(s => s.id === task.status_id);

  return (
    <div className="flex h-full max-h-[85vh]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 border-r border-gray-100">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-4">
          <span className="font-mono">{operationKey}-{task.task_number}</span>
          <span>/</span>
          <span className="font-bold" style={{ color: currentStatus?.color }}>{currentStatus?.name}</span>
        </div>

        {/* Title */}
        {editing ? (
          <input className="input text-base font-black mb-4" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
        ) : (
          <h2 className="text-lg font-black text-[#1a1a1a] mb-4 leading-snug">{task.title}</h2>
        )}

        {/* Transitions */}
        {allowedTransitions.length > 0 && !editing && (
          <div className="flex flex-wrap gap-2 mb-5 pb-5 border-b border-gray-100">
            {allowedTransitions.map(t => {
              const toStatus = statuses.find(s => s.id === t.to_status_id);
              return (
                <button key={t.id} onClick={() => handleTransition(t.to_status_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all hover:opacity-80"
                  style={{ borderColor: toStatus?.color, color: toStatus?.color, backgroundColor: toStatus?.color + '10' }}
                >
                  → {t.name || toStatus?.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Description */}
        <div className="mb-5">
          <p className="label">Description</p>
          {editing ? (
            <textarea className="input resize-none h-28" placeholder="Add a description..." value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
          ) : (
            <p className="text-sm text-gray-500 font-medium whitespace-pre-wrap min-h-[40px]">
              {task.description || <span className="text-gray-300 italic">No description</span>}
            </p>
          )}
        </div>

        <LinkedCrmContext task={task} />

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div className="mb-5">
            <p className="label">Subtasks ({subtasks.length})</p>
            <div className="space-y-1.5">
              {subtasks.map(s => {
                const sStatus = statuses.find(st => st.id === s.status_id);
                return (
                  <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sStatus?.color || '#9ca3af' }} />
                    <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{s.title}</span>
                    {s.assignee_name && <Avatar name={s.assignee_name} color="#50ad32" size="xs" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-100 mb-4">
          <div className="flex gap-4">
            {['comments', 'activity'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`py-2.5 text-sm font-black border-b-2 transition-colors capitalize ${
                  activeTab === tab ? 'border-[#50ad32] text-[#50ad32]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab}
                {tab === 'comments' && comments.length > 0 && (
                  <span className="ml-1.5 text-xs bg-[#50ad32]/10 text-[#50ad32] rounded-full px-1.5 py-0.5">{comments.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'comments' && (
          <div className="space-y-4">
            <form onSubmit={handleComment} className="flex gap-2">
              <input className="input flex-1" placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
              <button type="submit" disabled={submittingComment || !commentText.trim()} className="btn-primary px-3">
                {submittingComment ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
            </form>
            {comments.length === 0 ? (
              <p className="text-sm text-gray-300 font-medium text-center py-4">No comments yet</p>
            ) : comments.map(c => (
              <div key={c.id} className="flex gap-3 group">
                <Avatar name={c.user_name} color={c.avatar_color} size="sm" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-[#1a1a1a]">{c.user_name}</span>
                    <span className="text-[11px] text-gray-300 font-medium">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                    {c.edited && <span className="text-[11px] text-gray-300">(edited)</span>}
                  </div>
                  <p className="text-sm text-gray-600 font-medium whitespace-pre-wrap">{c.content}</p>
                </div>
                <button onClick={() => handleDeleteComment(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 self-start mt-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-gray-300 font-medium text-center py-4">No activity yet</p>
            ) : activity.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                <Avatar name={a.user_name} color={a.avatar_color} size="xs" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">
                    <span className="font-black text-[#1a1a1a]">{a.user_name}</span>{' '}
                    {a.action === 'status_change' && <>moved to <span className="font-bold text-[#50ad32]">{a.new_value?.status}</span></>}
                    {a.action === 'create' && 'created this task'}
                    {a.action === 'comment' && 'added a comment'}
                    {a.action === 'edit' && 'edited this task'}
                    {a.action === 'time_add' && <>logged <span className="font-bold text-[#50ad32]">{formatLoggedMinutes(a.new_value?.minutes)}</span></>}
                    {a.action === 'time_edit' && 'edited logged time'}
                    {a.action === 'time_delete' && 'deleted logged time'}
                  </p>
                  <p className="text-[11px] text-gray-300 font-medium mt-0.5">{format(new Date(a.created_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 p-5 space-y-4 overflow-y-auto bg-gray-50/50">
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-1.5 text-xs">{saving ? '...' : 'Save'}</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="w-full py-1.5 text-xs font-bold border-2 border-gray-200 rounded-lg text-gray-500 hover:border-[#50ad32] hover:text-[#50ad32] transition-all flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit Task
            </button>
          )}
        </div>

        {[
          { label: 'Status', content: (
            <div className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatus?.color }} />
              <span className="text-sm font-semibold text-gray-700">{currentStatus?.name}</span>
            </div>
          )},
          { label: 'Type', content: editing ? (
            <select className="input text-xs py-1.5" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          ) : <p className="text-sm font-semibold text-gray-700 capitalize py-0.5">{task.type}</p> },
          { label: 'Priority', content: editing ? (
            <select className="input text-xs py-1.5" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          ) : <PriorityBadge priority={task.priority} showLabel /> },
          { label: 'Assignee', content: editing ? (
            <select className="input text-xs py-1.5" value={editForm.assignee_id} onChange={e => setEditForm(f => ({ ...f, assignee_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : task.assignee_name ? (
            <div className="flex items-center gap-2 py-0.5">
              <Avatar name={task.assignee_name} color={task.assignee_color || '#50ad32'} size="xs" />
              <span className="text-sm font-semibold text-gray-700">{task.assignee_name}</span>
            </div>
          ) : <p className="text-sm text-gray-300 font-medium py-0.5">Unassigned</p> },
          { label: 'Reporter', content: (
            <div className="flex items-center gap-2 py-0.5">
              <Avatar name={task.reporter_name} color={task.reporter_color || '#50ad32'} size="xs" />
              <span className="text-sm font-semibold text-gray-700">{task.reporter_name}</span>
            </div>
          )},
          { label: 'Due Date', content: editing ? (
            <input type="date" className="input text-xs py-1.5" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
          ) : task.due_date ? (
            <p className={`text-sm font-semibold py-0.5 ${new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-gray-700'}`}>
              {format(new Date(task.due_date), 'MMM d, yyyy')}
            </p>
          ) : <p className="text-sm text-gray-300 font-medium py-0.5">No due date</p> },
          { label: 'Logged Time', content: (
            <p className="text-sm font-semibold text-[#1f4074] py-0.5">{formatLoggedMinutes(task.total_logged_minutes)}</p>
          )},
        ].map(({ label, content }) => (
          <div key={label}>
            <p className="label">{label}</p>
            {content}
          </div>
        ))}

        <div>
          <p className="label">Created</p>
          <p className="text-xs text-gray-400 font-medium">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</p>
        </div>
      </div>
    </div>
  );
}
