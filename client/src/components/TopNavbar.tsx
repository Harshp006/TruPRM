import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TopNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTimeOffOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const role = user.role;

  const canSeeEmployees = ['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN'].includes(role);
  const canSeeContracts = ['ADMIN', 'HR_MANAGER'].includes(role);
  const canSeePayroll = ['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN'].includes(role);
  const canSeeReports = ['ADMIN', 'HR_PAYROLL_ADMIN'].includes(role);

  const isTimeOffActive = location.pathname.startsWith('/time-off') || location.pathname.startsWith('/timeoff');

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

      {/* Tabs Bar */}
      <div style={{ backgroundColor: '#c0c0c0', borderTop: '2px solid #fff', borderBottom: '2px solid #666', padding: '6px 10px', display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
        {/* Reports / Home */}
        <Link
          to="/dashboard"
          style={{
            padding: '6px 15px',
            backgroundColor: location.pathname.startsWith('/dashboard') ? '#e0e0e0' : '#d4d0c8',
            color: '#000',
            border: location.pathname.startsWith('/dashboard') ? '2px inset #fff' : '2px outset #fff',
            borderColor: location.pathname.startsWith('/dashboard') ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
            fontSize: '14px',
            fontWeight: location.pathname.startsWith('/dashboard') ? 'bold' : 'normal',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          {canSeeReports ? 'Reports' : 'Home'}
        </Link>

        {/* Employees */}
        {canSeeEmployees && (
          <Link
            to="/employees"
            style={{
              padding: '6px 15px',
              backgroundColor: location.pathname.startsWith('/employees') ? '#e0e0e0' : '#d4d0c8',
              color: '#000',
              border: location.pathname.startsWith('/employees') ? '2px inset #fff' : '2px outset #fff',
              borderColor: location.pathname.startsWith('/employees') ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
              fontSize: '14px',
              fontWeight: location.pathname.startsWith('/employees') ? 'bold' : 'normal',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Employees
          </Link>
        )}

        {/* Contracts */}
        {canSeeContracts && (
          <Link
            to="/contracts"
            style={{
              padding: '6px 15px',
              backgroundColor: location.pathname.startsWith('/contracts') ? '#e0e0e0' : '#d4d0c8',
              color: '#000',
              border: location.pathname.startsWith('/contracts') ? '2px inset #fff' : '2px outset #fff',
              borderColor: location.pathname.startsWith('/contracts') ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
              fontSize: '14px',
              fontWeight: location.pathname.startsWith('/contracts') ? 'bold' : 'normal',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Contracts
          </Link>
        )}

        {/* Attendance */}
        <Link
          to="/attendance"
          style={{
            padding: '6px 15px',
            backgroundColor: location.pathname.startsWith('/attendance') ? '#e0e0e0' : '#d4d0c8',
            color: '#000',
            border: location.pathname.startsWith('/attendance') ? '2px inset #fff' : '2px outset #fff',
            borderColor: location.pathname.startsWith('/attendance') ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
            fontSize: '14px',
            fontWeight: location.pathname.startsWith('/attendance') ? 'bold' : 'normal',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          Attendance
        </Link>

        {/* Time Off ▼ Interactive Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            onClick={() => setTimeOffOpen(!timeOffOpen)}
            style={{
              padding: '6px 15px',
              backgroundColor: isTimeOffActive ? '#e0e0e0' : '#d4d0c8',
              color: '#000',
              border: isTimeOffActive ? '2px inset #fff' : '2px outset #fff',
              borderColor: isTimeOffActive ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
              fontSize: '14px',
              fontWeight: isTimeOffActive ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Time Off</span>
            <span style={{ fontSize: '10px' }}>▼</span>
          </button>

          {timeOffOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                backgroundColor: '#ffffff',
                border: '2px solid #003366',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                zIndex: 1000,
                minWidth: '180px',
                marginTop: '2px',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              <Link
                to="/time-off/requests"
                onClick={() => setTimeOffOpen(false)}
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  color: '#003366',
                  fontSize: '13px',
                  fontWeight: location.pathname.includes('/requests') ? 'bold' : '500',
                  backgroundColor: location.pathname.includes('/requests') ? '#f0f4f8' : '#ffffff',
                  textDecoration: 'none',
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                📋 Requests
              </Link>
              <Link
                to="/time-off/allocations"
                onClick={() => setTimeOffOpen(false)}
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  color: '#003366',
                  fontSize: '13px',
                  fontWeight: location.pathname.includes('/allocations') ? 'bold' : '500',
                  backgroundColor: location.pathname.includes('/allocations') ? '#f0f4f8' : '#ffffff',
                  textDecoration: 'none'
                }}
              >
                📊 Allocations
              </Link>
            </div>
          )}
        </div>

        {/* Payroll */}
        {canSeePayroll ? (
          <Link
            to="/payruns"
            style={{
              padding: '6px 15px',
              backgroundColor: location.pathname.startsWith('/payruns') ? '#e0e0e0' : '#d4d0c8',
              color: '#000',
              border: location.pathname.startsWith('/payruns') ? '2px inset #fff' : '2px outset #fff',
              borderColor: location.pathname.startsWith('/payruns') ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
              fontSize: '14px',
              fontWeight: location.pathname.startsWith('/payruns') ? 'bold' : 'normal',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            Payroll
          </Link>
        ) : (
          <Link
            to="/payslips"
            style={{
              padding: '6px 15px',
              backgroundColor: location.pathname.startsWith('/payslips') ? '#e0e0e0' : '#d4d0c8',
              color: '#000',
              border: location.pathname.startsWith('/payslips') ? '2px inset #fff' : '2px outset #fff',
              borderColor: location.pathname.startsWith('/payslips') ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
              fontSize: '14px',
              fontWeight: location.pathname.startsWith('/payslips') ? 'bold' : 'normal',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            My Payslips
          </Link>
        )}
      </div>
    </div>
  );
};

export default TopNavbar;
