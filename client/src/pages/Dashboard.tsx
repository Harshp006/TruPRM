import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import HRPayrollManagerDashboard from './HRPayrollManagerDashboard';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 1. HR Payroll Manager (`HR_PAYROLL_ADMIN`)
  if (user.role === 'HR_PAYROLL_ADMIN') {
    return <HRPayrollManagerDashboard />;
  }

  // 2. HR Payroll User -> Redirect to Pay Runs or render Pay Runs dashboard
  if (user.role === 'HR_PAYROLL_USER') {
    return <Navigate to="/payruns" replace />;
  }

  // 3. HR Manager -> Redirect to Employees portal
  if (user.role === 'HR_MANAGER') {
    return <Navigate to="/employees" replace />;
  }

  // 4. Employee -> Redirect to Payslips portal
  if (user.role === 'EMPLOYEE') {
    return <Navigate to="/payslips" replace />;
  }

  // 5. ADMIN -> Full Admin Dashboard overview
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin System Dashboard</h1>
          <p className="text-slate-500 text-sm">
            Full system control, role permissions, and cross-departmental operations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow">
          <div className="text-xs uppercase font-semibold text-indigo-400">System Role</div>
          <div className="text-2xl font-bold mt-1">ADMINISTRATOR</div>
          <p className="text-xs text-slate-400 mt-2">Full administrative read & write access.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-400">Quick Access</div>
          <div className="mt-3 space-y-2 text-sm">
            <a href="/users" className="block text-indigo-600 font-semibold hover:underline">
              • Manage System Users & Roles
            </a>
            <a href="/salary-structures" className="block text-indigo-600 font-semibold hover:underline">
              • Manage Salary Structures & Rules
            </a>
            <a href="/payruns" className="block text-indigo-600 font-semibold hover:underline">
              • Monitor Pay Runs & Payslips
            </a>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-400">Active User</div>
          <div className="mt-2 font-medium text-slate-800">{user.email}</div>
          <div className="text-xs text-slate-500 mt-1">User ID: {user.id}</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
