import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TopNavbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [payrollOpen, setPayrollOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const payrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTimeOffOpen(false);
      }
      if (payrollRef.current && !payrollRef.current.contains(event.target as Node)) {
        setPayrollOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const role = user.role;

  const canSeeEmployees = ['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'].includes(role);
  const canSeeContracts = ['ADMIN', 'HR_MANAGER'].includes(role);
  const canSeePayroll = ['ADMIN', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'].includes(role);
  const canSeeReports = ['ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'].includes(role);
  const isManagerRole = ['ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'].includes(role);

  const isTimeOffActive = location.pathname.startsWith('/time-off') || location.pathname.startsWith('/timeoff');
  const isPayrollActive = location.pathname.startsWith('/payruns') || location.pathname.startsWith('/salary-structures') || location.pathname.startsWith('/salary-rules') || (canSeePayroll && location.pathname.startsWith('/payslips'));

  const portalTitle = isManagerRole
    ? 'TruPRM - HR Payroll Manager Portal'
    : role === 'HR_PAYROLL_USER'
    ? 'TruPRM - HR Payroll User Portal'
    : 'TruPRM - Official Human Resources Portal';

  return (
    <div style={{ backgroundColor: '#003366', color: 'white', borderBottom: '2px solid #000' }}>
      {/* Utility Bar */}
      <div style={{ padding: '6px 10px', fontSize: '15px', borderBottom: '1px solid #336699', display: 'flex', justifyContent: 'space-between', backgroundColor: '#002244' }}>
        <div>{portalTitle}</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>User: {user.email} [{role}]</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/profile'); }} style={{ color: 'white', textDecoration: 'underline' }}>Profile</a>
          {role === 'ADMIN' && <a href="#" onClick={(e) => { e.preventDefault(); navigate('/users'); }} style={{ color: 'white', textDecoration: 'underline' }}>Admin</a>}
          {['ADMIN', 'HR_MANAGER'].includes(role) && <a href="#" onClick={(e) => { e.preventDefault(); navigate('/working-schedules'); }} style={{ color: 'white', textDecoration: 'underline' }}>Schedules</a>}
          {isManagerRole && <a href="#" onClick={(e) => { e.preventDefault(); navigate('/salary-structures'); }} style={{ color: 'white', textDecoration: 'underline' }}>Config</a>}
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
          to={role === 'EMPLOYEE' ? '/payslips' : role === 'HR_PAYROLL_USER' ? '/payruns' : '/dashboard'}
          style={{
            padding: '6px 15px',
            backgroundColor: (location.pathname.startsWith('/dashboard') || (role === 'HR_PAYROLL_USER' && location.pathname.startsWith('/payruns'))) ? '#e0e0e0' : '#d4d0c8',
            color: '#000',
            border: (location.pathname.startsWith('/dashboard') || (role === 'HR_PAYROLL_USER' && location.pathname.startsWith('/payruns'))) ? '2px inset #fff' : '2px outset #fff',
            borderColor: (location.pathname.startsWith('/dashboard') || (role === 'HR_PAYROLL_USER' && location.pathname.startsWith('/payruns'))) ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
            fontSize: '14px',
            fontWeight: (location.pathname.startsWith('/dashboard') || (role === 'HR_PAYROLL_USER' && location.pathname.startsWith('/payruns'))) ? 'bold' : 'normal',
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

        {/* Payroll ▼ Interactive Dropdown */}
        {canSeePayroll && (
          <div ref={payrollRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              onClick={() => setPayrollOpen(!payrollOpen)}
              style={{
                padding: '6px 15px',
                backgroundColor: isPayrollActive ? '#e0e0e0' : '#d4d0c8',
                color: '#000',
                border: isPayrollActive ? '2px inset #fff' : '2px outset #fff',
                borderColor: isPayrollActive ? '#999 #fff #fff #999' : '#fff #999 #999 #fff',
                fontSize: '14px',
                fontWeight: isPayrollActive ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Payroll</span>
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {payrollOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: '#ffffff',
                  border: '2px solid #003366',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  zIndex: 1000,
                  minWidth: '210px',
                  marginTop: '2px',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <Link
                  to="/payruns"
                  onClick={() => setPayrollOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    color: '#003366',
                    fontSize: '13px',
                    fontWeight: location.pathname.startsWith('/payruns') ? 'bold' : '500',
                    backgroundColor: location.pathname.startsWith('/payruns') ? '#f0f4f8' : '#ffffff',
                    textDecoration: 'none',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  💳 Pay Runs
                </Link>
                <Link
                  to="/payslips"
                  onClick={() => setPayrollOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    color: '#003366',
                    fontSize: '13px',
                    fontWeight: location.pathname.startsWith('/payslips') ? 'bold' : '500',
                    backgroundColor: location.pathname.startsWith('/payslips') ? '#f0f4f8' : '#ffffff',
                    textDecoration: 'none',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  📄 Payslips
                </Link>
                <Link
                  to="/salary-structures"
                  onClick={() => setPayrollOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    color: '#003366',
                    fontSize: '13px',
                    fontWeight: location.pathname.startsWith('/salary-structures') ? 'bold' : '500',
                    backgroundColor: location.pathname.startsWith('/salary-structures') ? '#f0f4f8' : '#ffffff',
                    textDecoration: 'none',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  ⚙️ Salary Structures {!isManagerRole && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>(Read-Only)</span>}
                </Link>
                <Link
                  to="/salary-rules"
                  onClick={() => setPayrollOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    color: '#003366',
                    fontSize: '13px',
                    fontWeight: location.pathname.startsWith('/salary-rules') ? 'bold' : '500',
                    backgroundColor: location.pathname.startsWith('/salary-rules') ? '#f0f4f8' : '#ffffff',
                    textDecoration: 'none'
                  }}
                >
                  📐 Salary Rules {!isManagerRole && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>(Read-Only)</span>}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopNavbar;
