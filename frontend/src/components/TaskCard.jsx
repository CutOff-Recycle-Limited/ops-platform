import Avatar from './Avatar.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import { formatDistanceToNow, isPast } from 'date-fns';

const TYPE_ICONS = {
  task: { d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: 'text-[#1f4074]' },
  epic: { d: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'text-[#50ad32]' },
  subtask: { d: 'M4 6h16M4 10h16M4 14h8', color: 'text-gray-400' },
};

function formatLoggedMinutes(value) {
  const minutes = Number(value) || 0;
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export default function TaskCard({ task, operationKey, onClick, onDragStart, onDragEnd }) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date));
  const typeIcon = TYPE_ICONS[task.type] || TYPE_ICONS.task;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-xl p-3.5 cursor-pointer shadow-sm
        hover:border-[#50ad32]/40 hover:shadow-md hover:-translate-y-0.5
        transition-all group active:opacity-70 select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <svg className={`w-3.5 h-3.5 flex-shrink-0 ${typeIcon.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={typeIcon.d} />
          </svg>
          <span className="text-[11px] font-mono font-bold text-gray-300">
            {operationKey}-{task.task_number}
          </span>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Title */}
      <p className="text-sm text-[#1a1a1a] font-bold leading-snug mb-3 group-hover:text-[#50ad32] transition-colors line-clamp-2">
        {task.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.comment_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gray-300 font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comment_count}
            </span>
          )}
          {task.subtask_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gray-300 font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
              </svg>
              {task.subtask_count}
            </span>
          )}
          {task.due_date && (
            <span className={`text-[11px] font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-300'}`}>
              {isOverdue ? '⚠ ' : ''}
              {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
            </span>
          )}
          {task.total_logged_minutes > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[#1f4074] font-semibold">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              {formatLoggedMinutes(task.total_logged_minutes)}
            </span>
          )}
        </div>
        {task.assignee_name && (
          <Avatar name={task.assignee_name} color={task.assignee_color || '#50ad32'} size="xs" />
        )}
      </div>
    </div>
  );
}
