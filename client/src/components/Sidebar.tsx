import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface NavGroup {
  title?: string;
  items: Array<{
    path: string;
    label: string;
    roles: Role[];
  }>;
}

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const role = user.role;

  // Define navigation groups tailored by role
  const getNavGroups = (): NavGroup[] => {
    if (role === 'HR_PAYROLL_ADMIN') {
      return [
        {
          items: [
            { path: '/dashboard', label: 'Dashboard', roles: ['HR_PAYROLL_ADMIN'] },
            { path: '/employees', label: 'Employees', roles: ['HR_PAYROLL_ADMIN'] },
            { path: '/salary-structures', label: 'Salary Structures', roles: ['HR_PAYROLL_ADMIN'] },
            { path: '/payruns', label: 'Pay Runs', roles: ['HR_PAYROLL_ADMIN'] },
            { path: '/payslips', label: 'Payroll History', roles: ['HR_PAYROLL_ADMIN'] },
            { path: '/profile', label: 'My Profile', roles: ['HR_PAYROLL_ADMIN'] },
          ],
        },
      ];
    }

    if (role === 'ADMIN') {
      return [
        {
          items: [
            { path: '/dashboard', label: 'Dashboard', roles: ['ADMIN'] },
            { path: '/profile', label: 'My Profile', roles: ['ADMIN'] },
          ],
        },
        {
          title: 'PAYROLL',
          items: [
            { path: '/payruns', label: 'Pay Runs', roles: ['ADMIN'] },
            { path: '/payslips', label: 'Payslips', roles: ['ADMIN'] },
          ],
        },
        {
          title: 'SALARY CONFIGURATION',
          items: [
            { path: '/salary-structures', label: 'Salary Structures', roles: ['ADMIN'] },
            { path: '/salary-rules', label: 'Salary Rules', roles: ['ADMIN'] },
          ],
        },
        {
          title: 'HR OPERATIONS',
          items: [
            { path: '/employees', label: 'Employees', roles: ['ADMIN'] },
            { path: '/contracts', label: 'Contracts', roles: ['ADMIN'] },
            { path: '/working-schedules', label: 'Schedules', roles: ['ADMIN'] },
            { path: '/attendance', label: 'Attendance', roles: ['ADMIN'] },
            { path: '/time-off', label: 'Time Off', roles: ['ADMIN'] },
          ],
        },
        {
          title: 'ADMINISTRATION',
          items: [
            { path: '/users', label: 'User Management', roles: ['ADMIN'] },
          ],
        },
      ];
    }

    if (role === 'HR_PAYROLL_USER') {
      return [
        {
          title: 'PAYROLL OPERATIONS',
          items: [
            { path: '/payruns', label: 'Pay Runs', roles: ['HR_PAYROLL_USER'] },
            { path: '/payslips', label: 'Payslips', roles: ['HR_PAYROLL_USER'] },
            { path: '/salary-structures', label: 'Salary Structures (Read-Only)', roles: ['HR_PAYROLL_USER'] },
            { path: '/employees', label: 'Employees', roles: ['HR_PAYROLL_USER'] },
          ],
        },
        {
          title: 'MY PORTAL',
          items: [
            { path: '/profile', label: 'My Profile', roles: ['HR_PAYROLL_USER'] },
            { path: '/attendance', label: 'My Attendance', roles: ['HR_PAYROLL_USER'] },
            { path: '/time-off', label: 'My Time Off', roles: ['HR_PAYROLL_USER'] },
          ],
        },
      ];
    }

    if (role === 'HR_MANAGER') {
      return [
        {
          title: 'HR MANAGEMENT',
          items: [
            { path: '/employees', label: 'Employees', roles: ['HR_MANAGER'] },
            { path: '/contracts', label: 'Contracts', roles: ['HR_MANAGER'] },
            { path: '/working-schedules', label: 'Schedules', roles: ['HR_MANAGER'] },
            { path: '/attendance', label: 'Attendance', roles: ['HR_MANAGER'] },
            { path: '/time-off', label: 'Time Off', roles: ['HR_MANAGER'] },
            { path: '/profile', label: 'My Profile', roles: ['HR_MANAGER'] },
          ],
        },
      ];
    }

    // Default: EMPLOYEE
    return [
      {
        title: 'MY PORTAL',
        items: [
          { path: '/payslips', label: 'My Payslips', roles: ['EMPLOYEE'] },
          { path: '/attendance', label: 'My Attendance', roles: ['EMPLOYEE'] },
          { path: '/time-off', label: 'My Time Off', roles: ['EMPLOYEE'] },
          { path: '/profile', label: 'My Profile', roles: ['EMPLOYEE'] },
        ],
      },
    ];
  };

  const navGroups = getNavGroups();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 text-slate-800 flex flex-col h-full shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold tracking-tight text-brand-600">
            TruPRM
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            {role.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.title && (
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-600 font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-brand-600'
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="text-xs font-semibold text-slate-700 truncate">{user.email}</div>
        <div className="text-[11px] text-slate-500 mb-3 uppercase font-semibold">
          Role: {user.role}
        </div>
        <button
          onClick={logout}
          className="w-full py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
