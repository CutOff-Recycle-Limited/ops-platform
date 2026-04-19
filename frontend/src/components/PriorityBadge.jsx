const PRIORITIES = {
  critical: { label: 'Critical', color: 'text-red-600 bg-red-50 border border-red-200', dot: '#dc2626' },
  high: { label: 'High', color: 'text-orange-600 bg-orange-50 border border-orange-200', dot: '#ea580c' },
  medium: { label: 'Medium', color: 'text-yellow-700 bg-yellow-50 border border-yellow-200', dot: '#ca8a04' },
  low: { label: 'Low', color: 'text-gray-500 bg-gray-50 border border-gray-200', dot: '#9ca3af' },
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
