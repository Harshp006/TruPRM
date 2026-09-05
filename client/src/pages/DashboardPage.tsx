import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchDashboardStats, type DashboardStats } from '../api/payroll';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard stats', err);
      setError(err?.response?.data?.error || 'Failed to load dashboard statistics from server.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">PAID</span>;
      case 'VALIDATED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">VALIDATED</span>;
      case 'COMPUTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">COMPUTED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">DRAFT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {user?.role}
            </span>
            <span className="text-xs text-slate-400">● Live Database Connected</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.email}
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            {user?.role === 'HR_PAYROLL_USER'
              ? 'Payroll Operations & Compliance Portal — Payrun processing, attendance tracking, and payslip generation.'
              : 'Enterprise HR & Payroll Management Portal — Full administrative authority over payroll workflows.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payroll/payruns')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow transition"
          >
            Manage Payruns
          </button>
          <button
            onClick={() => navigate('/attendance')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
          >
            Attendance
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-3"></div>
          <p className="text-slate-500 text-sm font-medium">Fetching real-time payroll & HR metrics from database...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm">Failed to retrieve dashboard metrics</h3>
            <p className="text-xs text-rose-600 mt-1">{error}</p>
          </div>
          <button
            onClick={loadStats}
            className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-medium rounded-md transition"
          >
            Retry
          </button>
        </div>
      )}

      {stats && !loading && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Net Paid</span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  ${(stats.totalNetPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <span className="text-xs text-emerald-600 font-medium mt-3">From validated/paid payruns</span>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Employees</span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.totalEmployees || 0}
                </div>
              </div>
              <span className="text-xs text-indigo-600 font-medium mt-3">Registered staff records</span>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Contracts</span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.activeContractsCount || 0}
                </div>
              </div>
              <span className="text-xs text-blue-600 font-medium mt-3">Eligible for payroll</span>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attendance Rate</span>
                <div className="text-2xl font-bold text-slate-900 mt-2">
                  {stats.attendanceRate || 0}%
                </div>
              </div>
              <span className="text-xs text-slate-500 font-medium mt-3">Present / Active ratio</span>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Time Off</span>
                <div className="text-2xl font-bold text-amber-600 mt-2">
                  {stats.pendingTimeOffCount || 0}
                </div>
              </div>
              <span className="text-xs text-amber-700 font-medium mt-3">Awaiting manager approval</span>
            </div>
          </div>

          {/* Department Breakdown & Quick Links */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department Breakdown */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-slate-900">Headcount by Department</h2>
                <button
                  onClick={() => navigate('/employees')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  View All Employees →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(stats.departmentBreakdown || {}).map(([dept, count]) => (
                  <div key={dept} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="text-xs font-medium text-slate-500 truncate">{dept}</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">{count}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {Math.round(((count as number) / (stats.totalEmployees || 1)) * 100)}% of workforce
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Modules */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <h2 className="text-base font-bold text-slate-900 mb-4">Payroll Operations</h2>
              <div className="space-y-2.5">
                <div
                  onClick={() => navigate('/payroll/payruns')}
                  className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Payrun Processing</div>
                    <div className="text-xs text-slate-500">Create, compute, and validate payslips</div>
                  </div>
                  <span className="text-slate-400">→</span>
                </div>

                <div
                  onClick={() => navigate('/payroll/salary-structures')}
                  className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Salary Structures & Rules</div>
                    <div className="text-xs text-slate-500">Inspect calculation rules and formulas</div>
                  </div>
                  <span className="text-slate-400">→</span>
                </div>

                <div
                  onClick={() => navigate('/attendance')}
                  className="p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Attendance Log</div>
                    <div className="text-xs text-slate-500">Record check-ins & review worked hours</div>
                  </div>
                  <span className="text-slate-400">→</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Payruns Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Payruns</h2>
                <p className="text-xs text-slate-500 mt-0.5">Historical and active pay cycle records loaded from database</p>
              </div>
              <button
                onClick={() => navigate('/payroll/payruns')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                View All Payruns →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Payrun Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Employees</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Net</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {(stats.recentPayruns || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                        No payrun records found in the database.
                      </td>
                    </tr>
                  ) : (
                    (stats.recentPayruns || []).map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                          {pr.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                          {new Date(pr.periodStart).toLocaleDateString()} &ndash; {new Date(pr.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {pr.employeeCount} Staff
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">
                          ${(pr.totalNet || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(pr.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                          <button
                            onClick={() => navigate('/payroll/payruns')}
                            className="text-indigo-600 hover:text-indigo-900 font-semibold"
                          >
                            Open Details →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
