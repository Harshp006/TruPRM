import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface TodayAttendance {
  present: number;
  late: number;
  absent: number;
  total: number;
}

interface PendingRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  typeName: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: string;
  reason?: string;
}

interface DepartmentCount {
  department: string;
  count: number;
}

interface ScheduleSummary {
  id: string;
  name: string;
  hoursPerWeek: number;
  flexibleHours: boolean;
  assignedContracts: number;
}

interface ActiveContract {
  id: string;
  employeeName: string;
  contractType: string;
  startDate: string;
  endDate?: string;
}

interface HRManagerData {
  headcount: number;
  activeContractsCount: number;
  attendanceHealthPct: number;
  pendingTimeoffCount: number;
  todayAttendance: TodayAttendance;
  departmentHeadcount: DepartmentCount[];
  pendingRequests: PendingRequest[];
  schedulesSummary: ScheduleSummary[];
  activeContracts: ActiveContract[];
}

const HRManagerDashboard: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HRManagerData | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/dashboard/hr-manager', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load HR Manager metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMetrics();
    }
  }, [token]);

  const handleApproveRequest = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      setActionMessage(null);
      const res = await fetch(`http://localhost:5000/api/time-off/requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Time off request approved successfully!' });
        await fetchMetrics();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setActionMessage({ type: 'error', text: errJson.message || 'Failed to approve time off request' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Server error approving request' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRefuseRequest = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      setActionMessage(null);
      const res = await fetch(`http://localhost:5000/api/time-off/requests/${requestId}/refuse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Refused by HR Manager' }),
      });

      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Time off request refused.' });
        await fetchMetrics();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setActionMessage({ type: 'error', text: errJson.message || 'Failed to refuse time off request' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Server error refusing request' });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-primary border-t-transparent"></div>
      </div>
    );
  }

  const headcount = data?.headcount || 0;
  const activeContractsCount = data?.activeContractsCount || 0;
  const attendanceHealthPct = data?.attendanceHealthPct || 0;
  const pendingTimeoffCount = data?.pendingTimeoffCount || 0;
  const pendingRequests = data?.pendingRequests || [];
  const departmentHeadcount = data?.departmentHeadcount || [];
  const schedulesSummary = data?.schedulesSummary || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-brand-primary/10 text-brand-primary rounded-full">
              HR Operations Management
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">HR Manager Operations Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Overview of employee records, active contracts, working schedules, and pending leave approvals.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('/employees')}
            className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>+ Employee</span>
          </button>
          <button
            onClick={() => navigate('/contracts')}
            className="px-3.5 py-2 bg-brand-primary text-white rounded-xl text-xs font-semibold hover:bg-brand-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>+ Contract</span>
          </button>
          <button
            onClick={() => navigate('/working-schedules')}
            className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <span>Schedules</span>
          </button>
          <button
            onClick={fetchMetrics}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs font-bold underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Headcount</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{headcount}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-blue-600">Employee Directory</span>
          </div>
        </div>

        {/* Active Contracts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Contracts</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{activeContractsCount}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-indigo-600">Active vs Total: {activeContractsCount}/{headcount}</span>
          </div>
        </div>

        {/* Attendance Health % */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Rate</p>
              <h3 className="text-3xl font-extrabold text-slate-900 mt-2">{attendanceHealthPct}%</h3>
            </div>
            <div className={`p-3 rounded-xl ${attendanceHealthPct >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <span>Today's Present: {data?.todayAttendance?.present || 0}</span>
          </div>
        </div>

        {/* Pending Leave Applications */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Leaves</p>
              <h3 className="text-3xl font-extrabold text-amber-600 mt-2">{pendingTimeoffCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-amber-700">Requires HR Approval</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Approvals & Department Headcount */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Time Off Approvals (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">Pending Leave Approvals</h2>
              <p className="text-xs text-slate-500 mt-0.5">Time off requests submitted by employees requiring approval.</p>
            </div>
            <button
              onClick={() => navigate('/time-off/requests')}
              className="text-xs font-semibold text-brand-primary hover:underline"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-x-auto">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">No pending time off requests</p>
                <p className="text-xs text-slate-400 mt-1">All leave applications have been processed.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Days</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{req.employeeName}</div>
                        <div className="text-[11px] text-slate-400">{req.department} • #{req.employeeNumber}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px]">
                          {req.typeName}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {new Date(req.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                        {new Date(req.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{req.daysRequested}d</td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleApproveRequest(req.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            disabled={processingId === req.id}
                            onClick={() => handleRefuseRequest(req.id)}
                            className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg font-semibold hover:bg-rose-200 disabled:opacity-50 transition-colors"
                          >
                            Refuse
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Department Headcount Breakdown (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            {/* Header with Title & Summary Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Headcount by Department</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Workforce distribution across departments</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold text-[11px] rounded-lg">
                  {departmentHeadcount.length} Depts
                </span>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold text-[11px] rounded-lg">
                  {headcount} Staff
                </span>
              </div>
            </div>

            {/* Largest Dept Highlight Badge */}
            {(() => {
              const largestDept = departmentHeadcount.length > 0
                ? [...departmentHeadcount].sort((a, b) => b.count - a.count)[0]
                : null;
              if (!largestDept || largestDept.count === 0) return null;
              const largestPct = headcount > 0 ? Math.round((largestDept.count / headcount) * 100) : 0;
              return (
                <div className="mb-3 p-2.5 bg-brand-primary/5 border border-brand-primary/15 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600 text-[11px]">
                    Largest Dept: <strong className="text-slate-900 font-bold">{largestDept.department}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-brand-primary text-white font-bold text-[10px] rounded-md">
                    {largestDept.count} ({largestPct}%)
                  </span>
                </div>
              );
            })()}

            {/* 2-Column Compact Department Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {departmentHeadcount.map((dept) => {
                const percentage = headcount > 0 ? Math.round((dept.count / headcount) * 100) : 0;
                return (
                  <div key={dept.department} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/60 transition-colors">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-slate-800 truncate pr-1" title={dept.department}>
                        {dept.department}
                      </span>
                      <span className="font-bold text-slate-900 whitespace-nowrap text-[11px]">
                        {dept.count} <span className="text-slate-500 font-normal">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => navigate('/employees')}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition-colors border border-slate-200"
            >
              Open Full Directory
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Grid: Working Schedules & Active Contracts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Working Schedules Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Working Schedules Overview</h2>
              <p className="text-xs text-slate-500">Configured shift & work hour profiles.</p>
            </div>
            <button
              onClick={() => navigate('/working-schedules')}
              className="text-xs font-semibold text-brand-primary hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="space-y-3">
            {schedulesSummary.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No working schedules created yet.</p>
            ) : (
              schedulesSummary.map((sched) => (
                <div key={sched.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">{sched.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {sched.hoursPerWeek} hrs/week • {sched.flexibleHours ? 'Flexible' : 'Fixed Hours'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs">
                      {sched.assignedContracts} contracts
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Contracts Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Active Contracts</h2>
              <p className="text-xs text-slate-500">Latest active employment contracts.</p>
            </div>
            <button
              onClick={() => navigate('/contracts')}
              className="text-xs font-semibold text-brand-primary hover:underline"
            >
              All Contracts
            </button>
          </div>

          <div className="space-y-2.5">
            {data?.activeContracts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active contracts found.</p>
            ) : (
              data?.activeContracts.slice(0, 5).map((c) => (
                <div key={c.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{c.employeeName}</span>
                    <span className="ml-2 text-[11px] text-slate-400">({c.contractType})</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Since {new Date(c.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRManagerDashboard;
