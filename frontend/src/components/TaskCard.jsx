import Avatar from './Avatar.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import { formatDistanceToNow, isPast } from 'date-fns';

const TYPE_ICONS = {
  task: { d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'text-blue-400' },
  epic: { d: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'text-purple-400' },
  subtask: { d: 'M4 6h16M4 10h16M4 14h8', color: 'text-slate-400' },
};

export default function TaskCard({ task, operationKey, onClick, onDragStart, onDragEnd }) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date));
  const typeIcon = TYPE_ICONS[task.type] || TYPE_ICONS.task;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-surface-2 border border-surface-border rounded-xl p-3.5 cursor-pointer
        hover:border-accent/40 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5
        transition-all group active:opacity-70 select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${typeIcon.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={typeIcon.d} />
          </svg>
          <span className="text-[11px] font-mono text-slate-600">
            {operationKey}-{task.task_number}
          </span>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Title */}
      <p className="text-sm text-slate-200 font-medium leading-snug mb-3 group-hover:text-white transition-colors line-clamp-2">
        {task.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Comment count */}
          {task.comment_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comment_count}
            </span>
          )}
          {/* Subtask count */}
          {task.subtask_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
              </svg>
              {task.subtask_count}
            </span>
          )}
          {/* Due date */}
          {task.due_date && (
            <span className={`text-[11px] ${isOverdue ? 'text-red-400' : 'text-slate-600'}`}>
              {isOverdue ? '⚠ ' : ''}
              {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Assignee */}
        {task.assignee_name && (
          <Avatar name={task.assignee_name} color={task.assignee_color} size="xs" />
        )}
      </div>
    </div>
  );
}
