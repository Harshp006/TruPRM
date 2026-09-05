import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, type Role } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/Users';
import EmployeesPage from './pages/Employees';
import SchedulesPage from './pages/WorkingSchedules';
import ContractsPage from './pages/Contracts';
import AttendancePage from './pages/Attendance';
import TimeOffPage from './pages/TimeOff';
import SalaryStructuresPage from './pages/SalaryStructures';
import SalaryRulesPage from './pages/SalaryRules';
import PayrunsPage from './pages/Payruns';
import PayslipsPage from './pages/Payslips';

export default function App() {
  const hrAndPayrollRoles: Role[] = ['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'];

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* All protected routes share the Layout except change-password */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
            
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/timeoff" element={<TimeOffPage />} />
              <Route path="/time-off" element={<TimeOffPage />} />

              {/* Core HR & Payroll routes */}
              <Route element={<ProtectedRoute allowedRoles={hrAndPayrollRoles} />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/contracts" element={<ContractsPage />} />
                <Route path="/working-schedules" element={<SchedulesPage />} />
                
                {/* Payruns routes */}
                <Route path="/payruns" element={<PayrunsPage />} />
                <Route path="/payroll/payruns" element={<PayrunsPage />} />
                
                {/* Payslips routes */}
                <Route path="/payslips" element={<PayslipsPage />} />
                <Route path="/payroll/payslips" element={<PayslipsPage />} />

                {/* Salary Structures & Rules */}
                <Route path="/salary-structures" element={<SalaryStructuresPage />} />
                <Route path="/payroll/salary-structures" element={<SalaryStructuresPage />} />
                <Route path="/salary-rules" element={<SalaryRulesPage />} />
                <Route path="/payroll/salary-rules" element={<SalaryRulesPage />} />
              </Route>

              {/* Admin only */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
