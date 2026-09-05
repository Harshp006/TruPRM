import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';

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
import Users from '../pages/Users';
import Settings from '../pages/Settings';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        {/* Route accessible without Layout */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route element={<Layout />}>
          {/* Default Dashboard (Role Aware) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Directory & Contracts (HR roles & Admin) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HR_MANAGER',
                  'HR_PAYROLL_USER',
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
          <Route path="/working-schedules" element={<WorkingSchedules />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/time-off" element={<TimeOffPage />} />
          <Route path="/timeoff" element={<TimeOffPage />} />

          {/* Salary Structure Management (Admin & HR Payroll Manager full, HR Payroll User read-only) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={['HR_PAYROLL_ADMIN', 'ADMIN']}
              />
            }
          >
            <Route path="/salary-structures/new" element={<SalaryStructureCreate />} />
            <Route path="/salary-rules" element={<SalaryRules />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={['HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN']}
              />
            }
          >
            <Route path="/salary-structures" element={<SalaryStructures />} />
            <Route path="/salary-structures/:id" element={<SalaryStructureDetail />} />
          </Route>

          {/* Pay Runs (HR Payroll User, HR Payroll Manager, HR Manager, Admin) */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'HR_PAYROLL_USER',
                  'HR_PAYROLL_ADMIN',
                  'ADMIN',
                  'HR_MANAGER',
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
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
