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
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">PAID</span>;
      case 'VALIDATED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">VALIDATED</span>;
      case 'COMPUTED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-600 border border-brand-100">COMPUTED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">DRAFT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header / Banner */}
      <div className="bg-white text-slate-800 rounded-2xl p-6 shadow-sm border border-brand-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-brand-50 to-transparent rounded-full -mr-20 -mt-20 opacity-70 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-100 text-brand-700 border border-brand-200 uppercase">
              {user?.role.replace('_', ' ')}
            </span>
            <span className="text-xs text-slate-500 font-medium">● Live Database Connected</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-700">
            Welcome back, {user?.email}
          </h1>
          <p className="text-slate-500 text-sm mt-1 max-w-xl">
            Enterprise HR & Payroll Portal — Real-time metrics for payroll operations, attendance tracking, and employee compensation.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => navigate('/payroll/payruns')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-sm transition"
          >
            Manage Payruns
          </button>
          <button
            onClick={() => navigate('/attendance')}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition"
          >
            Attendance
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent mb-3"></div>
          <p className="text-slate-500 text-sm font-medium">Fetching real-time payroll & HR metrics from database...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-red-800 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm">Failed to retrieve dashboard metrics</h3>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={loadStats}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium rounded-lg transition"
          >
            Retry
          </button>
        </div>
      )}

      {stats && !loading && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Net Paid</span>
                <div className="text-2xl font-bold text-slate-800 mt-2">
                  ${(stats.totalNetPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <span className="text-xs text-emerald-600 font-medium mt-3">From validated/paid payruns</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Employees</span>
                <div className="text-2xl font-bold text-slate-800 mt-2">
                  {stats.totalEmployees || 0}
                </div>
              </div>
              <span className="text-xs text-brand-600 font-medium mt-3">Registered staff records</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Contracts</span>
                <div className="text-2xl font-bold text-slate-800 mt-2">
                  {stats.activeContractsCount || 0}
                </div>
              </div>
              <span className="text-xs text-blue-600 font-medium mt-3">Eligible for payroll</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Attendance Rate</span>
                <div className="text-2xl font-bold text-slate-800 mt-2">
                  {stats.attendanceRate || 0}%
                </div>
              </div>
              <span className="text-xs text-slate-500 font-medium mt-3">Present / Active ratio</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Time Off</span>
                <div className="text-2xl font-bold text-amber-600 mt-2">
                  {stats.pendingTimeOffCount || 0}
                </div>
              </div>
              <span className="text-xs text-amber-600 font-medium mt-3">Awaiting manager approval</span>
            </div>
          </div>

          {/* Department Breakdown & Quick Links */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department Breakdown */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800">Headcount by Department</h2>
                <button
                  onClick={() => navigate('/employees')}
                  className="text-sm text-brand-600 hover:text-brand-700 font-semibold"
                >
                  View All Employees →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.entries(stats.departmentBreakdown || {}).map(([dept, count]) => (
                  <div key={dept} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 uppercase truncate">{dept}</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{count}</div>
                    <div className="text-[11px] font-medium text-slate-400 mt-1">
                      {Math.round(((count as number) / (stats.totalEmployees || 1)) * 100)}% of workforce
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Modules */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Payroll Operations</h2>
              <div className="space-y-3">
                <div
                  onClick={() => navigate('/payroll/payruns')}
                  className="p-4 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors">Payrun Processing</div>
                    <div className="text-xs text-slate-500 mt-0.5">Create, compute, and validate payslips</div>
                  </div>
                  <span className="text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>

                <div
                  onClick={() => navigate('/payroll/salary-structures')}
                  className="p-4 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors">Salary Structures & Rules</div>
                    <div className="text-xs text-slate-500 mt-0.5">Inspect calculation rules and formulas</div>
                  </div>
                  <span className="text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>

                <div
                  onClick={() => navigate('/attendance')}
                  className="p-4 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-xl cursor-pointer transition flex items-center justify-between group"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-brand-700 transition-colors">Attendance Log</div>
                    <div className="text-xs text-slate-500 mt-0.5">Record check-ins & review worked hours</div>
                  </div>
                  <span className="text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Payruns Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Recent Payruns</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Historical and active pay cycle records loaded from database</p>
              </div>
              <button
                onClick={() => navigate('/payroll/payruns')}
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                View All Payruns →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Payrun Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employees</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Net</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {(stats.recentPayruns || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm font-medium">
                        No payrun records found in the database.
                      </td>
                    </tr>
                  ) : (
                    (stats.recentPayruns || []).map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                          {pr.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs font-medium">
                          {new Date(pr.periodStart).toLocaleDateString()} &ndash; {new Date(pr.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {pr.employeeCount} Staff
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                          ${(pr.totalNet || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(pr.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                          <button
                            onClick={() => navigate('/payroll/payruns')}
                            className="text-brand-600 hover:text-brand-700"
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
