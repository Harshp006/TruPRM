import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/Users';
import EmployeesPage from './pages/Employees';
import SchedulesPage from './pages/WorkingSchedules';
import ContractsPage from './pages/Contracts';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* All protected routes share the Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* HR and above */}
              <Route
                element={<ProtectedRoute allowedRoles={['HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN']} />}
              >
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/contracts" element={<ContractsPage />} />
              </Route>

              {/* HR Managers and above */}
              <Route
                element={<ProtectedRoute allowedRoles={['HR_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN']} />}
              >
                <Route path="/working-schedules" element={<SchedulesPage />} />
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
