import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Force password change if required, unless they are already on the change-password page
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  
  // Prevent going to change-password if they don't need to
  if (!user?.mustChangePassword && location.pathname === '/change-password') {
    const target = user?.role === 'EMPLOYEE' ? '/payslips' : user?.role === 'HR_PAYROLL_USER' ? '/payroll-home' : '/dashboard';
    return <Navigate to={target} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const homeTarget = user.role === 'EMPLOYEE' ? '/payslips' : user.role === 'HR_PAYROLL_USER' ? '/payroll-home' : '/dashboard';
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
            403
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">403 — Access Forbidden</h2>
            <p className="text-sm text-slate-500 mt-1">
              Your role <span className="font-semibold text-slate-700">({user.role})</span> does not have permission to access <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">{location.pathname}</code>.
            </p>
          </div>
          <div className="pt-2">
            <a
              href={homeTarget}
              className="inline-block px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
            >
              Return to My Home Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
