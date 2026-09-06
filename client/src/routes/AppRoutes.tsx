import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';

import { useAuth } from '../context/AuthContext';

import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import Dashboard from '../pages/Dashboard';
import Employees from '../pages/Employees';
import Contracts from '../pages/Contracts';
import AttendancePage from '../pages/AttendancePage';
import TimeOffPage from '../pages/TimeOffPage';
import ProfilePage from '../pages/ProfilePage';
import ChangePasswordPage from '../pages/ChangePasswordPage';
import WorkingSchedules from '../pages/WorkingSchedules';
import SalaryStructures from '../pages/SalaryStructures';
import SalaryStructureDetail from '../pages/SalaryStructureDetail';
import SalaryStructureCreate from '../pages/SalaryStructureCreate';
import SalaryRules from '../pages/SalaryRules';
import Payruns from '../pages/Payruns';
import Payslips from '../pages/Payslips';
import PayrollHome from '../pages/PayrollHome';
import Users from '../pages/Users';
import Settings from '../pages/Settings';

const RoleDefaultRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'EMPLOYEE') {
    return <Navigate to="/payslips" replace />;
  }
  if (user?.role === 'HR_PAYROLL_USER') {
    return <Navigate to="/payroll-home" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        {/* Route accessible without Layout */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<RoleDefaultRedirect />} />

          {/* Default Dashboard (Role Aware) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/payroll-home" element={<PayrollHome />} />
          <Route path="/profile" element={<ProfilePage />} />


          {/* Directory & Contracts (HR roles & Admin) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HR_MANAGER',
                  'HR_PAYROLL_USER',
                  'HR_PAYROLL_MANAGER',
                  'HR_PAYROLL_ADMIN',
                  'ADMIN',
                ]}
              />
            }
          >
            <Route path="/employees" element={<Employees />} />
            <Route path="/contracts" element={<Contracts />} />
          </Route>

          {/* Schedules, Attendance & Time-off */}
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/attendance/:attendanceId" element={<AttendancePage />} />
          <Route path="/employees/:employeeId/attendance" element={<AttendancePage />} />
          <Route path="/time-off" element={<Navigate to="/time-off/requests" replace />} />
          <Route path="/timeoff" element={<Navigate to="/time-off/requests" replace />} />
          <Route path="/time-off/requests" element={<TimeOffPage initialTab="requests" />} />
          <Route path="/time-off/requests/:requestId" element={<TimeOffPage initialTab="requests" />} />
          <Route path="/time-off/allocations" element={<TimeOffPage initialTab="allocations" />} />
          <Route path="/time-off/allocations/:allocationId" element={<TimeOffPage initialTab="allocations" />} />
          <Route path="/time-off/types" element={<Navigate to="/time-off/requests" replace />} />
          <Route path="/time-off/types/:typeId" element={<Navigate to="/time-off/requests" replace />} />
          <Route path="/employees/:employeeId/timeoff" element={<TimeOffPage />} />
          <Route path="/employees/:employeeId/time-off" element={<TimeOffPage />} />

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HR_MANAGER',
                  'HR_PAYROLL_USER',
                  'HR_PAYROLL_MANAGER',
                  'HR_PAYROLL_ADMIN',
                  'ADMIN',
                ]}
              />
            }
          >
            <Route path="/working-schedules" element={<WorkingSchedules />} />
          </Route>

          {/* Salary Structure Management (Admin & HR Payroll Manager full, HR Payroll User read-only) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={['HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN']}
              />
            }
          >
            <Route path="/salary-structures/new" element={<SalaryStructureCreate />} />
            <Route path="/salary-rules" element={<SalaryRules />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={['HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN']}
              />
            }
          >
            <Route path="/salary-structures" element={<SalaryStructures />} />
            <Route path="/salary-structures/:id" element={<SalaryStructureDetail />} />
          </Route>

          {/* Pay Runs (HR Payroll User, HR Payroll Manager, Admin) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HR_PAYROLL_USER',
                  'HR_PAYROLL_MANAGER',
                  'HR_PAYROLL_ADMIN',
                  'ADMIN'
                ]}
              />
            }
          >
            <Route path="/payruns" element={<Payruns />} />
          </Route>

          {/* Payslips (Accessible to all authenticated users; Employees see own payslips) */}
          <Route path="/payslips" element={<Payslips />} />

          {/* User Management (ADMIN ONLY) */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<RoleDefaultRedirect />} />
    </Routes>
  );
};

export default AppRoutes;
