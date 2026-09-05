import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navSections = [
  {
    title: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', roles: [] },
    ],
  },
  {
    title: 'HR Operations',
    items: [
      { path: '/employees', label: 'Employees', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/contracts', label: 'Contracts', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/working-schedules', label: 'Working Schedules', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/attendance', label: 'Attendance', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/time-off', label: 'Time Off', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
    ],
  },
  {
    title: 'Payroll Management',
    items: [
      { path: '/payroll/payruns', label: 'Payruns', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/payroll/payslips', label: 'Payslips', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/payroll/salary-structures', label: 'Salary Structures', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
      { path: '/payroll/salary-rules', label: 'Salary Rules', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { path: '/users', label: 'User Accounts', roles: ['ADMIN'] },
    ],
  },
];

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0 border-r border-slate-800">
      <div className="p-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-base tracking-wider">
            T
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white leading-none">
              Tru<span className="text-indigo-400">PRM</span>
            </div>
            <div className="text-[10px] uppercase font-semibold text-slate-400 mt-1 tracking-wider">
              HR & Payroll
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-5 overflow-y-auto custom-scrollbar">
        {navSections.map((section) => {
          // Filter items based on user's role
          const visibleItems = section.items.filter(
            (item) => item.roles.length === 0 || (user && item.roles.includes(user.role))
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {section.title}
              </div>
              {visibleItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400 uppercase">
            {user?.email?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{user?.email}</div>
            <div className="text-[10px] font-medium text-indigo-300 truncate">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium transition text-center border border-slate-700/60"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
