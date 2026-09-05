import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchTimeOffTypes,
  fetchTimeOffAllocations,
  fetchTimeOffRequests,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  type TimeOffType,
  type TimeOffAllocation,
  type TimeOffRequest,
} from '../api/timeoff';
import { fetchEmployees, type Employee } from '../api/hr';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT: { label: 'Pending Review', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  CONFIRMED: { label: 'Confirmed', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  VALIDATED: { label: 'Approved', badge: 'bg-green-100 text-green-800 border-green-300' },
  REFUSED: { label: 'Refused', badge: 'bg-red-100 text-red-700 border-red-300' },
};

export default function TimeOffPage() {
  const { user } = useAuth();
  const canApprove = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [searchParams] = useSearchParams();
  const filterEmployeeId = searchParams.get('employeeId') || '';

  const [activeTab, setActiveTab] = useState<'requests' | 'types' | 'allocations'>('requests');
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formTypeId, setFormTypeId] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [formDays, setFormDays] = useState(1);
  const [formReason, setFormReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqData, typeData, allocData, empData] = await Promise.all([
        fetchTimeOffRequests({ employeeId: filterEmployeeId || undefined }),
        fetchTimeOffTypes(),
        fetchTimeOffAllocations({ employeeId: filterEmployeeId || undefined }),
        fetchEmployees(),
      ]);
      setRequests(reqData);
      setTypes(typeData);
      setAllocations(allocData);
      setEmployees(empData);
      if (empData.length > 0 && !formEmployeeId) setFormEmployeeId(empData[0].id);
      if (typeData.length > 0 && !formTypeId) setFormTypeId(typeData[0].id);
    } catch (err) {
      console.error('Failed to load time off data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterEmployeeId]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formTypeId || !formStartDate || !formEndDate) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createTimeOffRequest({
        employeeId: formEmployeeId,
        timeOffTypeId: formTypeId,
        startDate: formStartDate,
        endDate: formEndDate,
        daysRequested: Number(formDays),
        reason: formReason || undefined,
      });
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveTimeOffRequest(id);
      await loadData();
    } catch (err) {
      alert('Failed to approve request');
    }
  };

  const handleRefuse = async (id: string) => {
    const reason = prompt('Please enter the refusal reason:');
    if (reason === null) return;
    try {
      await refuseTimeOffRequest(id, reason);
      await loadData();
    } catch (err) {
      alert('Failed to refuse request');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Time Off Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track leave allocations, policies, and employee time off requests
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          + Request Time Off
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'requests'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Leave Requests ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'types'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Leave Types ({types.length})
          </button>
          <button
            onClick={() => setActiveTab('allocations')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'allocations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Allocations ({allocations.length})
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading time off records...
        </div>
      ) : activeTab === 'requests' ? (
        /* Requests Table */
        requests.length === 0 ? (
          <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
            No time off requests found.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const statusMeta = STATUS_CONFIG[req.status] || STATUS_CONFIG.DRAFT;
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-slate-800">
                          {req.employee ? `${req.employee.firstName} ${req.employee.lastName}` : '—'}
                        </div>
                        <div className="text-xs text-slate-400">
                          #{req.employee?.employeeNumber} · {req.employee?.department || 'General'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {req.timeOffType?.name || 'General PTO'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {new Date(req.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {new Date(req.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-800">
                        {req.daysRequested} {req.daysRequested === 1 ? 'day' : 'days'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusMeta.badge}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate" title={req.reason || ''}>
                        {req.reason || <span className="text-slate-300">—</span>}
                        {req.refusalReason && (
                          <div className="text-red-500 font-medium mt-0.5">Refused: {req.refusalReason}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm">
                        {canApprove && req.status === 'DRAFT' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(req.id)}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRefuse(req.id)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition"
                            >
                              Refuse
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {req.status === 'VALIDATED' ? 'Approved' : req.status === 'REFUSED' ? 'Closed' : 'Under Review'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : activeTab === 'types' ? (
        /* Types Grid (Read-Only) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {types.map((t) => (
            <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{t.name}</h3>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded">
                  {t.code}
                </span>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div>Paid: <span className="font-semibold">{t.isPaid ? 'Yes' : 'No'}</span></div>
                <div>Annual Max: <span className="font-semibold">{t.maxDaysPerYear || 'Unlimited'} days</span></div>
                <div>Requires Approval: <span className="font-semibold">{t.requiresApproval ? 'Yes' : 'No'}</span></div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                Read-only policy configuration
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Allocations Table (Read-Only) */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Employee', 'Leave Type', 'Year', 'Allocated Days', 'Days Used', 'Balance'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations.map((a) => {
                const balance = a.daysAllocated - a.daysUsed;
                return (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                      {a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {a.timeOffType?.name || 'Standard'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 font-mono">{a.year}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">{a.daysAllocated} days</td>
                    <td className="px-5 py-4 text-sm text-amber-600 font-semibold">{a.daysUsed} days</td>
                    <td className="px-5 py-4 text-sm font-bold text-green-600">{balance} days</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Request Time Off</h2>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Off Type *</label>
                <select
                  value={formTypeId}
                  onChange={(e) => setFormTypeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Days Requested *</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={formDays}
                  onChange={(e) => setFormDays(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Notes</label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Reason for leave request..."
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
