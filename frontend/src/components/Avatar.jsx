export default function Avatar({ name = '?', color = '#50ad32', size = 'md', className = '' }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
    xl: 'w-12 h-12 text-lg',
  };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-black flex-shrink-0 ${className}`}
      style={{ backgroundColor: color + '20', color, border: `2px solid ${color}40` }}
      title={name}
    >
      {initials}
    </div>
  );
}
