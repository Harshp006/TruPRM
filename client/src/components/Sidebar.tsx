import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', roles: [] },
  { path: '/employees', label: 'Employees', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
  { path: '/working-schedules', label: 'Schedules', roles: ['HR_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
  { path: '/contracts', label: 'Contracts', roles: ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] },
  { path: '/users', label: 'Users', roles: ['ADMIN'] },
];

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full">
      <div className="p-4 text-xl font-bold border-b border-slate-700">
        TruPRM
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          if (item.roles.length > 0 && user && !item.roles.includes(user.role)) return null;
          
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={`block px-4 py-2 rounded-md ${isActive ? 'bg-indigo-600' : 'hover:bg-slate-800'}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="text-sm truncate mb-2">{user?.email}</div>
        <button
          onClick={logout}
          className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-left text-sm"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
