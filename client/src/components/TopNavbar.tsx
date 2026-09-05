import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TopNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const role = user.role;

  const canSeeEmployees = ['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN'].includes(role);
  const canSeeContracts = ['ADMIN', 'HR_MANAGER'].includes(role);
  const canSeePayroll = ['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN'].includes(role);
  const canSeeReports = ['ADMIN', 'HR_PAYROLL_ADMIN'].includes(role);

  const navItems = [];

  if (canSeeReports) {
    navItems.push({ path: '/dashboard', label: 'Reports' });
  } else {
    navItems.push({ path: '/dashboard', label: 'Home' });
  }

  if (canSeeEmployees) {
    navItems.push({ path: '/employees', label: 'Employees' });
  }
  if (canSeeContracts) {
    navItems.push({ path: '/contracts', label: 'Contracts' });
  }
  navItems.push({ path: '/attendance', label: 'Attendance' });
  navItems.push({ path: '/time-off', label: 'Time Off' });
  
  if (canSeePayroll) {
    navItems.push({ path: '/payruns', label: 'Payroll' });
  } else {
    navItems.push({ path: '/payslips', label: 'My Payslips' });
  }

  return (
    <div style={{ backgroundColor: '#003366', color: 'white', borderBottom: '2px solid #000' }}>
      {/* Utility Bar */}
      <div style={{ padding: '6px 10px', fontSize: '15px', borderBottom: '1px solid #336699', display: 'flex', justifyContent: 'space-between', backgroundColor: '#002244' }}>
        <div>TruPRM - Official Human Resources Portal</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>User: {user.email} [{role}]</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/profile'); }} style={{ color: 'white', textDecoration: 'underline' }}>Profile</a>
          {role === 'ADMIN' && <a href="#" onClick={(e) => { e.preventDefault(); navigate('/users'); }} style={{ color: 'white', textDecoration: 'underline' }}>Admin</a>}
          {['ADMIN', 'HR_MANAGER'].includes(role) && <a href="#" onClick={(e) => { e.preventDefault(); navigate('/working-schedules'); }} style={{ color: 'white', textDecoration: 'underline' }}>Schedules</a>}
          {['ADMIN', 'HR_PAYROLL_ADMIN'].includes(role) && <a href="#" onClick={(e) => { e.preventDefault(); navigate('/salary-structures'); }} style={{ color: 'white', textDecoration: 'underline' }}>Config</a>}
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} style={{ color: '#FF9999', textDecoration: 'underline' }}>Logout</a>
        </div>
      </div>

      {/* Main Header */}
      <div style={{ padding: '20px 30px', display: 'flex', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>TruPRM ERP System</h1>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#c0c0c0', borderTop: '2px solid #fff', borderBottom: '2px solid #666', padding: '6px 10px', display: 'flex', gap: '8px' }}>
        {navItems.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                padding: '6px 15px',
                backgroundColor: isActive ? '#e0e0e0' : '#d4d0c8',
                color: '#000',
                border: isActive ? '2px inset #fff' : '2px outset #fff',
                borderColor: isActive ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
                fontSize: '14px',
                fontWeight: isActive ? 'bold' : 'normal',
                textDecoration: 'none',
                display: 'inline-block'
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default TopNavbar;
