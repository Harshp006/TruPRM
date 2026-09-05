import { useState, useEffect } from 'react';
import {
  fetchTimeOffRequests,
  fetchTimeOffAllocations,
  fetchTimeOffTypes,
  fetchEmployees,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  createTimeOffAllocation,
  createTimeOffType,
  type TimeOffRequest,
  type TimeOffAllocation,
  type TimeOffType,
  type Employee,
} from '../api/hr';

export default function TimeOffPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'allocations' | 'types'>('requests');
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showReqModal, setShowReqModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // Forms
  const [reqForm, setReqForm] = useState({
    employeeId: '',
    timeOffTypeId: '',
    startDate: '',
    endDate: '',
    daysRequested: 1,
    reason: '',
  });

  const [allocForm, setAllocForm] = useState({
    employeeId: '',
    timeOffTypeId: '',
    year: new Date().getFullYear(),
    daysAllocated: 20,
  });

  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    unit: 'DAYS',
    requiresAllocation: true,
    isPaid: true,
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqs, allocs, typs, emps] = await Promise.all([
        fetchTimeOffRequests({ search }),
        fetchTimeOffAllocations(),
        fetchTimeOffTypes(),
        fetchEmployees(),
      ]);
      setRequests(reqs);
      setAllocations(allocs);
      setTypes(typs);
      setEmployees(emps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [search]);

  const handleApprove = async (id: string) => {
    try {
      const res = await approveTimeOffRequest(id);
      alert(res.message);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleRefuse = async (id: string) => {
    const reason = prompt('Please enter a refusal reason (optional):');
    try {
      const res = await refuseTimeOffRequest(id, reason || undefined);
      alert(res.message);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to refuse request');
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTimeOffRequest(reqForm);
      setShowReqModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit request');
    }
  };

  const submitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTimeOffAllocation(allocForm);
      setShowAllocModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create allocation');
    }
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTimeOffType(typeForm);
      setShowTypeModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create leave type');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Time Off Management</h1>
          <p className="text-sm text-slate-500">Manage leave requests, balances, and allocation policies.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'requests' && (
            <button
              onClick={() => {
                setReqForm({
                  employeeId: employees[0]?.id || '',
                  timeOffTypeId: types[0]?.id || '',
                  startDate: new Date().toISOString().slice(0, 10),
                  endDate: new Date().toISOString().slice(0, 10),
                  daysRequested: 1,
                  reason: '',
                });
                setShowReqModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
            >
              + New Leave Request
            </button>
          )}
          {activeTab === 'allocations' && (
            <button
              onClick={() => {
                setAllocForm({
                  employeeId: employees[0]?.id || '',
                  timeOffTypeId: types[0]?.id || '',
                  year: new Date().getFullYear(),
                  daysAllocated: 20,
                });
                setShowAllocModal(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
            >
              + New Allocation
            </button>
          )}
          {activeTab === 'types' && (
            <button
              onClick={() => setShowTypeModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
            >
              + Add Leave Type
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Time Off Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'allocations'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Allocations & Balances ({allocations.length})
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'types'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Leave Types ({types.length})
        </button>
      </div>

      {/* Elasticsearch Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="text-indigo-600 font-semibold text-xs uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
          <span>🔍</span> Elasticsearch
        </div>
        <input
          type="text"
          placeholder="Search by employee or leave type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-slate-500">Loading leave data...</div>
      ) : activeTab === 'requests' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Employee</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">Period</th>
                <th className="px-6 py-3 text-left font-medium">Duration</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No time off requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {r.timeOffType?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {r.daysRequested} {r.timeOffType?.unit || 'DAYS'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === 'APPROVED' || r.status === 'VALIDATED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'REFUSED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.refusalReason && (
                        <p className="text-xs text-rose-500 mt-1 italic">"{r.refusalReason}"</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {r.status !== 'APPROVED' && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApprove(r.id)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRefuse(r.id)}
                            className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-medium hover:bg-rose-700"
                          >
                            Refuse
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'allocations' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Employee</th>
                <th className="px-6 py-3 text-left font-medium">Type</th>
                <th className="px-6 py-3 text-left font-medium">Year</th>
                <th className="px-6 py-3 text-left font-medium">Allocated</th>
                <th className="px-6 py-3 text-left font-medium">Taken</th>
                <th className="px-6 py-3 text-left font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '—'}
                  </td>
                  <td className="px-6 py-4 font-medium text-indigo-600">{a.timeOffType?.name}</td>
                  <td className="px-6 py-4 text-slate-600">{a.year}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{a.daysAllocated}</td>
                  <td className="px-6 py-4 font-semibold text-amber-600">{a.daysUsed}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">{a.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {types.map((t) => (
            <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{t.name}</h3>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded">
                  {t.code}
                </span>
              </div>
              <div className="text-xs space-y-1 text-slate-600">
                <p>Unit: <strong className="text-slate-800">{t.unit}</strong></p>
                <p>Allocation Required: <strong className={t.requiresAllocation ? 'text-indigo-600' : 'text-slate-500'}>{t.requiresAllocation ? 'Yes' : 'No'}</strong></p>
                <p>Paid Leave: <strong className={t.isPaid ? 'text-emerald-600' : 'text-slate-500'}>{t.isPaid ? 'Yes' : 'No'}</strong></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Submit Request */}
      {showReqModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Submit Time Off Request</h2>
            <form onSubmit={submitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employee</label>
                <select
                  required
                  value={reqForm.employeeId}
                  onChange={(e) => setReqForm({ ...reqForm, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Leave Type</label>
                <select
                  required
                  value={reqForm.timeOffTypeId}
                  onChange={(e) => setReqForm({ ...reqForm, timeOffTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Leave Type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.requiresAllocation ? 'Requires Allocation' : 'No Allocation Needed'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={reqForm.startDate}
                    onChange={(e) => setReqForm({ ...reqForm, startDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={reqForm.endDate}
                    onChange={(e) => setReqForm({ ...reqForm, endDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Days Requested</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={reqForm.daysRequested}
                  onChange={(e) => setReqForm({ ...reqForm, daysRequested: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
                <textarea
                  value={reqForm.reason}
                  onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Allocation */}
      {showAllocModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Set Employee Allocation</h2>
            <form onSubmit={submitAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employee</label>
                <select
                  required
                  value={allocForm.employeeId}
                  onChange={(e) => setAllocForm({ ...allocForm, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Leave Type</label>
                <select
                  required
                  value={allocForm.timeOffTypeId}
                  onChange={(e) => setAllocForm({ ...allocForm, timeOffTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Leave Type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    value={allocForm.year}
                    onChange={(e) => setAllocForm({ ...allocForm, year: parseInt(e.target.value, 10) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Days Allocated</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={allocForm.daysAllocated}
                    onChange={(e) => setAllocForm({ ...allocForm, daysAllocated: parseFloat(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllocModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Save Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Leave Type */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Add Leave Type</h2>
            <form onSubmit={submitType} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type Name</label>
                <input
                  required
                  placeholder="e.g. Paid Annual Leave"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                <input
                  required
                  placeholder="e.g. VACATION"
                  value={typeForm.code}
                  onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
                  <select
                    value={typeForm.unit}
                    onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="DAYS">DAYS</option>
                    <option value="HOURS">HOURS</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="requiresAllocation"
                    checked={typeForm.requiresAllocation}
                    onChange={(e) => setTypeForm({ ...typeForm, requiresAllocation: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="requiresAllocation" className="text-xs font-medium text-slate-700">Requires Allocation</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Save Leave Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
