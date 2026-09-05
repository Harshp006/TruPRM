import React from 'react';
import { Link } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/employees', label: 'Employees' },
  { path: '/contracts', label: 'Contracts' },
  { path: '/attendance', label: 'Attendance' },
  { path: '/time-off', label: 'Time Off' },
  { path: '/salary-structures', label: 'Salary Structures' },
  { path: '/salary-rules', label: 'Salary Rules' },
  { path: '/payruns', label: 'Payruns' },
  { path: '/payslips', label: 'Payslips' },
  { path: '/users', label: 'Users' },
  { path: '/settings', label: 'Settings' },
];

const Sidebar: React.FC = () => {
  return (
    <aside style={{ width: '250px', backgroundColor: '#fff', borderRight: '1px solid #e0e0e0', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {navItems.map((item) => (
        <Link 
          key={item.path} 
          to={item.path}
          style={{ padding: '0.75rem 1rem', borderRadius: '4px', backgroundColor: '#f9f9f9', border: '1px solid #eee', display: 'block' }}
        >
          {item.label}
        </Link>
      ))}
    </aside>
  );
};

export default Sidebar;
