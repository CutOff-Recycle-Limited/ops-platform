const PRIORITIES = {
  critical: { label: 'Critical', color: 'text-red-400 bg-red-400/10', dot: '#ef4444' },
  high: { label: 'High', color: 'text-orange-400 bg-orange-400/10', dot: '#f97316' },
  medium: { label: 'Medium', color: 'text-yellow-400 bg-yellow-400/10', dot: '#eab308' },
  low: { label: 'Low', color: 'text-slate-400 bg-slate-400/10', dot: '#94a3b8' },
};

export default function PriorityBadge({ priority, showLabel = false }) {
  const cfg = PRIORITIES[priority] || PRIORITIES.medium;
  return (
    <span className={`badge ${cfg.color}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {showLabel && cfg.label}
    </span>
  );
}

export { PRIORITIES };
