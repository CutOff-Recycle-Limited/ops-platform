import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useOperations } from '../hooks/useOperations.js';
import Avatar from './Avatar.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { operations } = useOperations();

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7f4]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white shadow-sm">
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/cr-logo.png" alt="CR" className="w-9 h-9" />
            <div>
              <p className="font-black text-[#1a1a1a] text-sm leading-tight">CutOff Recycle</p>
              <p className="text-[#50ad32] text-[10px] font-bold tracking-wide">OPS PLATFORM</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <NavItem to="/dashboard" label="Dashboard"
            icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          <NavItem to="/tasks" label="Tasks"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          <NavItem to="/operations" label="Operations"
            icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          <NavItem to="/users" label="Team & Users"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />

          {/* Operations quick links */}
          {operations.length > 0 && (
            <div className="pt-4 pb-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 mb-2">Your Operations</p>
              {operations.slice(0, 6).map(op => (
                <NavLink
                  key={op.id}
                  to={`/operations/${op.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-[#50ad32]/10 text-[#50ad32]'
                        : 'text-gray-500 hover:text-[#50ad32] hover:bg-[#50ad32]/5'
                    }`
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: op.color }}
                  />
                  <span className="truncate">{op.name}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer">
            <Avatar name={user?.name} color={user?.avatar_color} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-400 font-semibold capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
          isActive
            ? 'bg-[#50ad32] text-white shadow-sm'
            : 'text-gray-500 hover:text-[#50ad32] hover:bg-[#50ad32]/8'
        }`
      }
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {label}
    </NavLink>
  );
}
