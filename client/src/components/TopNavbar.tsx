import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import NotificationBell from './NotificationBell';

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
  const canSeeReports = ['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'].includes(role);
  const isManagerRole = ['ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'].includes(role);

  const isTimeOffActive = location.pathname.startsWith('/time-off') || location.pathname.startsWith('/timeoff');
  const isPayrollActive = location.pathname.startsWith('/payruns') || location.pathname.startsWith('/salary-structures') || location.pathname.startsWith('/salary-rules') || (canSeePayroll && location.pathname.startsWith('/payslips'));

  const portalTitle = role === 'HR_MANAGER'
    ? 'HR Manager Portal'
    : isManagerRole
    ? 'Manager Portal'
    : role === 'HR_PAYROLL_USER'
    ? 'Payroll User Portal'
    : 'HR Portal';

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm font-sans">
      {/* Top Utility Bar (Black & Violet theme) */}
      <div className="bg-black text-white px-6 py-2 flex justify-between items-center text-xs font-medium tracking-wide">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-secondary animate-pulse"></span>
          TruPRM {portalTitle}
        </div>
        <div className="flex items-center gap-6">
          <span className="text-slate-300 hidden sm:inline-block">Logged in as: <strong className="text-white">{user.email}</strong></span>
          <NotificationBell />
          {role === 'ADMIN' && (
            <Link to="/users" className="hover:text-brand-secondary transition-colors">Admin Settings</Link>
          )}
          {['ADMIN', 'HR_MANAGER'].includes(role) && (
            <Link to="/working-schedules" className="hover:text-brand-secondary transition-colors">Schedules</Link>
          )}
          {isManagerRole && (
            <Link to="/salary-structures" className="hover:text-brand-secondary transition-colors">Config</Link>
          )}
          <Link to="/profile" className="hover:text-brand-secondary transition-colors">Profile</Link>
          <button onClick={() => logout()} className="text-rose-400 hover:text-rose-300 font-semibold transition-colors">Logout</button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="px-6 h-16 flex items-center justify-between">
        {/* Brand/Logo */}
        <div className="flex items-center gap-8 h-full">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/images/logo.png" alt="TruPRM" className="h-10 object-contain" />
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex h-full gap-1 ml-4">
            <Link
              to={role === 'EMPLOYEE' ? '/payslips' : role === 'HR_PAYROLL_USER' ? '/payroll-home' : '/dashboard'}
              className={`flex items-center px-4 h-full text-sm font-semibold transition-colors border-b-2 ${
                (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/payroll-home'))
                  ? 'border-brand-secondary text-brand-secondary'
                  : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
              }`}
            >
              {canSeeReports ? 'Dashboard' : 'Home'}
            </Link>

            {canSeeEmployees && (
              <Link
                to="/employees"
                className={`flex items-center px-4 h-full text-sm font-semibold transition-colors border-b-2 ${
                  location.pathname.startsWith('/employees')
                    ? 'border-brand-secondary text-brand-secondary'
                    : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
                }`}
              >
                Employees
              </Link>
            )}

            {canSeeContracts && (
              <Link
                to="/contracts"
                className={`flex items-center px-4 h-full text-sm font-semibold transition-colors border-b-2 ${
                  location.pathname.startsWith('/contracts')
                    ? 'border-brand-secondary text-brand-secondary'
                    : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
                }`}
              >
                Contracts
              </Link>
            )}

            <Link
              to="/attendance"
              className={`flex items-center px-4 h-full text-sm font-semibold transition-colors border-b-2 ${
                location.pathname.startsWith('/attendance')
                  ? 'border-brand-secondary text-brand-secondary'
                  : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
              }`}
            >
              Attendance
            </Link>

            {/* Time Off Dropdown */}
            <div ref={dropdownRef} className="relative h-full flex items-center">
              <button
                onClick={() => setTimeOffOpen(!timeOffOpen)}
                className={`flex items-center gap-1.5 px-4 h-full text-sm font-semibold transition-colors border-b-2 outline-none ${
                  isTimeOffActive
                    ? 'border-brand-secondary text-brand-secondary'
                    : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
                }`}
              >
                Time Off
                <svg className={`w-4 h-4 transition-transform ${timeOffOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>

              {timeOffOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 animate-fadeIn z-50">
                  <Link
                    to="/time-off/requests"
                    onClick={() => setTimeOffOpen(false)}
                    className={`block px-4 py-2.5 text-sm transition-colors ${
                      location.pathname.includes('/requests') ? 'bg-brand-secondary/10 text-brand-secondary font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                    }`}
                  >
                    Requests
                  </Link>
                  <Link
                    to="/time-off/allocations"
                    onClick={() => setTimeOffOpen(false)}
                    className={`block px-4 py-2.5 text-sm transition-colors ${
                      location.pathname.includes('/allocations') ? 'bg-brand-secondary/10 text-brand-secondary font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                    }`}
                  >
                    Allocations
                  </Link>
                </div>
              )}
            </div>

            {/* Payroll Dropdown */}
            {canSeePayroll && (
              <div ref={payrollRef} className="relative h-full flex items-center">
                <button
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className={`flex items-center gap-1.5 px-4 h-full text-sm font-semibold transition-colors border-b-2 outline-none ${
                    isPayrollActive
                      ? 'border-brand-secondary text-brand-secondary'
                      : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
                  }`}
                >
                  Payroll
                  <svg className={`w-4 h-4 transition-transform ${payrollOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {payrollOpen && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 animate-fadeIn z-50">
                    <Link
                      to="/payruns"
                      onClick={() => setPayrollOpen(false)}
                      className={`block px-4 py-2.5 text-sm transition-colors ${
                        location.pathname.startsWith('/payruns') ? 'bg-brand-secondary/10 text-brand-secondary font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                      }`}
                    >
                      Pay Runs
                    </Link>
                    <Link
                      to="/payslips"
                      onClick={() => setPayrollOpen(false)}
                      className={`block px-4 py-2.5 text-sm transition-colors ${
                        location.pathname.startsWith('/payslips') ? 'bg-brand-secondary/10 text-brand-secondary font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                      }`}
                    >
                      Payslips
                    </Link>
                    <Link
                      to="/salary-structures"
                      onClick={() => setPayrollOpen(false)}
                      className={`block px-4 py-2.5 text-sm transition-colors ${
                        location.pathname.startsWith('/salary-structures') ? 'bg-brand-secondary/10 text-brand-secondary font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                      }`}
                    >
                      Salary Structures {!isManagerRole && <span className="text-[10px] text-slate-400 font-normal ml-1">(Read-Only)</span>}
                    </Link>
                    {isManagerRole && (
                      <Link
                        to="/salary-rules"
                        onClick={() => setPayrollOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          location.pathname.startsWith('/salary-rules') ? 'bg-brand-secondary/10 text-brand-secondary font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-black'
                        }`}
                      >
                        Salary Rules
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {role !== 'EMPLOYEE' && (
              <Link
                to="/audit-logs"
                className={`flex items-center px-4 h-full text-sm font-semibold transition-colors border-b-2 ${
                  location.pathname.startsWith('/audit-logs')
                    ? 'border-brand-secondary text-brand-secondary'
                    : 'border-transparent text-slate-600 hover:text-black hover:bg-slate-50'
                }`}
              >
                Audit Logs
              </Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;
