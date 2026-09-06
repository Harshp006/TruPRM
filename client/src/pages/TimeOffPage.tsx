import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchTimeOffRequests,
  fetchTimeOffAllocations,
  fetchTimeOffTypes,
  fetchLeaveBalances,
  fetchCompOffCredits,
  fetchTimeOffRequestDetail,
  fetchTimeOffAllocationDetail,
  fetchTimeOffTypeDetail,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  createTimeOffAllocation,
  createTimeOffType,
  updateTimeOffType,
  creditCompOff,
  type TimeOffRequest,
  type TimeOffAllocation,
  type TimeOffType,
  type LeaveBalanceItem,
  type CompOffCreditRecord,
} from '../api/timeoff';
import { fetchEmployees, fetchEmployee, type Employee } from '../api/hr';

interface TimeOffPageProps {
  initialTab?: 'requests' | 'allocations' | 'types';
}

export default function TimeOffPage({ initialTab }: TimeOffPageProps) {
  const {
    employeeId: paramEmployeeId,
    requestId: paramRequestId,
    allocationId: paramAllocationId,
    typeId: paramTypeId,
  } = useParams<{
    employeeId?: string;
    requestId?: string;
    allocationId?: string;
    typeId?: string;
  }>();

  const [searchParams] = useSearchParams();
  const queryEmployeeId = searchParams.get('employeeId') || '';
  const activeEmployeeId = paramEmployeeId || queryEmployeeId || undefined;

  const { user } = useAuth();
  const isHR = user?.role && user.role !== 'EMPLOYEE';

  // Active Tab state (only Requests, Allocations, and Time Off Types)
  const defaultTab = initialTab || (paramRequestId ? 'requests' : paramAllocationId ? 'allocations' : paramTypeId ? 'types' : 'requests');
  const [activeTab, setActiveTab] = useState<'requests' | 'allocations' | 'types'>(defaultTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (paramRequestId) {
      setActiveTab('requests');
    } else if (paramAllocationId) {
      setActiveTab('allocations');
    } else if (paramTypeId) {
      setActiveTab('types');
    }
  }, [initialTab, paramRequestId, paramAllocationId, paramTypeId]);

  // Data states
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [myBalances, setMyBalances] = useState<LeaveBalanceItem[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [compOffCredits, setCompOffCredits] = useState<CompOffCreditRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals for creation
  const [showReqModal, setShowReqModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCompOffModal, setShowCompOffModal] = useState(false);

  // Detail Modals for specific items
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<TimeOffAllocation | null>(null);
  const [selectedType, setSelectedType] = useState<TimeOffType | null>(null);

  const [editingType, setEditingType] = useState<TimeOffType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [reqForm, setReqForm] = useState({
    employeeId: '',
    timeOffTypeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    daysRequested: 1,
    reason: '',
  });

  const [allocForm, setAllocForm] = useState({
    employeeId: '',
    timeOffTypeId: '',
    year: new Date().getFullYear(),
    daysAllocated: 10,
  });

  const [typeForm, setTypeForm] = useState({
    name: '',
    code: '',
    description: '',
    unit: 'DAYS',
    isPaid: true,
    requiresAllocation: true,
    allocationAmount: 10,
    requiresApproval: true,
    isEarnedThroughWork: false,
    isSandwichLeave: false,
    carryForwardDays: 0,
    expiryDays: '',
  });

  const [compOffForm, setCompOffForm] = useState({
    employeeId: '',
    dateEarned: new Date().toISOString().slice(0, 10),
    daysEarned: 1,
    hoursWorked: 8,
    reason: 'Weekend / Overtime extra work',
    expiryDays: 90,
  });

  // Load Target Employee Info if in single employee view
  useEffect(() => {
    if (activeEmployeeId) {
      fetchEmployee(activeEmployeeId)
        .then((emp) => setTargetEmployee(emp))
        .catch((err) => console.error('Failed to load employee:', err));
    } else {
      setTargetEmployee(null);
    }
  }, [activeEmployeeId]);

  // Load main data
  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqs, allocs, typs, emps, compOffs, balanceRes] = await Promise.all([
        fetchTimeOffRequests({ employeeId: activeEmployeeId, search }),
        fetchTimeOffAllocations({ employeeId: activeEmployeeId }),
        fetchTimeOffTypes(),
        isHR ? fetchEmployees() : Promise.resolve([]),
        fetchCompOffCredits({ employeeId: activeEmployeeId }),
        fetchLeaveBalances({ employeeId: activeEmployeeId }),
      ]);

      setRequests(reqs);
      setAllocations(allocs);
      setTypes(typs);
      setEmployees(emps);
      setCompOffCredits(compOffs);

      if (balanceRes && 'balances' in balanceRes) {
        setMyBalances(balanceRes.balances);
      } else {
        setMyBalances([]);
      }

      // Check if URL parameters request single item details
      if (paramRequestId) {
        const found = reqs.find((r) => r.id === paramRequestId);
        if (found) setSelectedRequest(found);
        else fetchTimeOffRequestDetail(paramRequestId).then(setSelectedRequest).catch(console.error);
      }

      if (paramAllocationId) {
        const found = allocs.find((a) => a.id === paramAllocationId);
        if (found) setSelectedAllocation(found);
        else fetchTimeOffAllocationDetail(paramAllocationId).then(setSelectedAllocation).catch(console.error);
      }

      if (paramTypeId) {
        const found = typs.find((t) => t.id === paramTypeId);
        if (found) setSelectedType(found);
        else fetchTimeOffTypeDetail(paramTypeId).then(setSelectedType).catch(console.error);
      }
    } catch (err) {
      console.error('Error loading time off data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [search, activeEmployeeId, paramRequestId, paramAllocationId, paramTypeId]);

  // Form Handlers
  const handleApprove = async (id: string) => {
    try {
      const res = await approveTimeOffRequest(id);
      alert(res.message);
      setSelectedRequest(null);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve leave request');
    }
  };

  const handleRefuse = async (id: string) => {
    const refusalReason = prompt('Please enter a refusal reason (optional):');
    try {
      const res = await refuseTimeOffRequest(id, refusalReason || undefined);
      alert(res.message);
      setSelectedRequest(null);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to refuse leave request');
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqForm.timeOffTypeId) {
      alert('Please select a leave type');
      return;
    }
    setSubmitting(true);
    try {
      await createTimeOffRequest({
        employeeId: activeEmployeeId || reqForm.employeeId,
        timeOffTypeId: reqForm.timeOffTypeId,
        startDate: reqForm.startDate,
        endDate: reqForm.endDate,
        daysRequested: Number(reqForm.daysRequested),
        reason: reqForm.reason,
      });
      setShowReqModal(false);
      resetReqForm();
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTimeOffAllocation({
        employeeId: allocForm.employeeId,
        timeOffTypeId: allocForm.timeOffTypeId,
        year: allocForm.year,
        daysAllocated: Number(allocForm.daysAllocated),
      });
      setShowAllocModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to set allocation');
    } finally {
      setSubmitting(false);
    }
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...typeForm,
        allocationAmount: Number(typeForm.allocationAmount) || 0,
        carryForwardDays: Number(typeForm.carryForwardDays) || 0,
        expiryDays: typeForm.expiryDays ? parseInt(typeForm.expiryDays, 10) : undefined,
      };

      if (editingType) {
        await updateTimeOffType(editingType.id, payload);
      } else {
        await createTimeOffType(payload);
      }
      setShowTypeModal(false);
      setEditingType(null);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save leave type');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCompOffCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compOffForm.employeeId) {
      alert('Please select an employee');
      return;
    }
    setSubmitting(true);
    try {
      await creditCompOff({
        employeeId: compOffForm.employeeId,
        dateEarned: compOffForm.dateEarned,
        daysEarned: Number(compOffForm.daysEarned),
        hoursWorked: Number(compOffForm.hoursWorked) || undefined,
        reason: compOffForm.reason,
        expiryDays: compOffForm.expiryDays ? Number(compOffForm.expiryDays) : undefined,
      });
      setShowCompOffModal(false);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to credit Comp-Off');
    } finally {
      setSubmitting(false);
    }
  };

  const resetReqForm = () => {
    setReqForm({
      employeeId: activeEmployeeId || (employees[0]?.id || ''),
      timeOffTypeId: types[0]?.id || '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      daysRequested: 1,
      reason: '',
    });
  };

  const openNewRequestModal = () => {
    resetReqForm();
    setShowReqModal(true);
  };

  const openTypeModalForEdit = (t: TimeOffType) => {
    setEditingType(t);
    setTypeForm({
      name: t.name,
      code: t.code,
      description: t.description || '',
      unit: t.unit || 'DAYS',
      isPaid: t.isPaid,
      requiresAllocation: t.requiresAllocation,
      allocationAmount: t.allocationAmount || 10,
      requiresApproval: t.requiresApproval,
      isEarnedThroughWork: t.isEarnedThroughWork || false,
      isSandwichLeave: t.isSandwichLeave || false,
      carryForwardDays: t.carryForwardDays || 0,
      expiryDays: t.expiryDays ? String(t.expiryDays) : '',
    });
    setShowTypeModal(true);
  };

  const selectedTypeForReq = types.find((t) => t.id === reqForm.timeOffTypeId);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {activeEmployeeId && targetEmployee ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link
                  to="/employees"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 transition-colors"
                >
                  ← Back to Employees
                </Link>
                <span className="text-xs text-slate-400">/</span>
                <span className="text-xs font-semibold text-slate-600">Time Off Scope</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <span>Time Off & Leave:</span>
                <span className="text-indigo-600">{targetEmployee.firstName} {targetEmployee.lastName}</span>
              </h1>
              <p className="text-sm text-slate-500">
                Employee #{targetEmployee.employeeNumber} • {targetEmployee.department || 'General'} • {targetEmployee.jobTitle || 'Team Member'}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {activeTab === 'requests'
                  ? 'Time Off Requests'
                  : activeTab === 'allocations'
                  ? 'Leave Allocations'
                  : activeTab === 'types'
                  ? 'Time Off Types'
                  : activeTab === 'balances'
                  ? 'Employee Leave Balances'
                  : 'Time Off Management'}
              </h1>
              <p className="text-sm text-slate-500">
                {activeTab === 'requests'
                  ? 'Review, approve, or refuse employee leave applications.'
                  : activeTab === 'allocations'
                  ? 'View and manage employee annual leave allocations.'
                  : activeTab === 'types'
                  ? 'Configure leave policies, Sandwich rules, and Comp-Off criteria.'
                  : 'Track live leave balances, allocations, and requests.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openNewRequestModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>+</span> New Leave Request
          </button>
          {isHR && (
            <button
              onClick={() => {
                setCompOffForm({
                  employeeId: employees[0]?.id || '',
                  dateEarned: new Date().toISOString().slice(0, 10),
                  daysEarned: 1,
                  hoursWorked: 8,
                  reason: 'Weekend / Overtime extra work',
                  expiryDays: 90,
                });
                setShowCompOffModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>⭐</span> Award Comp-Off
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs Bar (Requests, Allocations, Time Off Types) */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto bg-white px-4 py-2.5 rounded-xl border">
        {[
          { id: 'requests' as const, label: `Time Off Requests (${requests.length})`, icon: '📋' },
          { id: 'allocations' as const, label: `Allocations (${allocations.length})`, icon: '📊' },
          { id: 'types' as const, label: `Time Off Types (${types.length})`, icon: '⚙️' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3"></div>
          <p className="text-sm font-medium">Loading time off records...</p>
        </div>
      ) : (
        <>
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {/* SECTION 1: SINGLE EMPLOYEE / MY LEAVE BALANCES CARD                           */}
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {(myBalances.length > 0 || activeEmployeeId || !isHR) && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Time Off Balance Summary</h2>
                    <p className="text-xs text-slate-500">Live available leave balances, allocations, and pending requests.</p>
                  </div>
                  <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                    Year {new Date().getFullYear()}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                      <tr>
                        <th className="px-6 py-3.5 text-left font-semibold">Leave Type</th>
                        <th className="px-6 py-3.5 text-center font-semibold">Allocated</th>
                        <th className="px-6 py-3.5 text-center font-semibold">Taken</th>
                        <th className="px-6 py-3.5 text-center font-semibold">Pending</th>
                        <th className="px-6 py-3.5 text-center font-semibold">Left (Remaining)</th>
                        <th className="px-6 py-3.5 text-right font-semibold">Rules / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myBalances.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                            No leave balance records calculated.
                          </td>
                        </tr>
                      ) : (
                        myBalances.map((b) => (
                          <tr key={b.timeOffTypeId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{b.name}</div>
                              <div className="text-xs text-slate-400">Code: {b.code} • Unit: {b.unit}</div>
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-slate-700">{b.allocated}</td>
                            <td className="px-6 py-4 text-center font-semibold text-amber-600">{b.taken}</td>
                            <td className="px-6 py-4 text-center font-semibold text-blue-600">{b.pending}</td>
                            <td className="px-6 py-4 text-center font-extrabold text-base">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  b.remaining > 3
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : b.remaining > 0
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {b.remaining} {b.unit}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end gap-1">
                                {b.isSandwichLeave && (
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                    🥪 Sandwich Rule
                                  </span>
                                )}
                                {b.isEarnedThroughWork && (
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    ⭐️ Overtime Credit
                                  </span>
                                )}
                                {b.isPaid && (
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                    💵 Paid Leave
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Employee Comp-Off Credits Log */}
              {compOffCredits.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span>⭐ Earned Comp-Off Credits</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold">Date Earned</th>
                          <th className="px-6 py-3 text-left font-semibold">Reason / Source</th>
                          <th className="px-6 py-3 text-left font-semibold">Extra Hours</th>
                          <th className="px-6 py-3 text-left font-semibold">Earned</th>
                          <th className="px-6 py-3 text-left font-semibold">Used</th>
                          <th className="px-6 py-3 text-left font-semibold">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {compOffCredits.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-6 py-3.5 font-medium text-slate-700">{new Date(c.dateEarned).toLocaleDateString()}</td>
                            <td className="px-6 py-3.5 text-slate-600">{c.reason || 'Overtime extra work'}</td>
                            <td className="px-6 py-3.5 font-semibold text-indigo-600">{c.hoursWorked ? `${c.hoursWorked} hrs` : '—'}</td>
                            <td className="px-6 py-3.5 font-bold text-emerald-600">+{c.daysEarned} day(s)</td>
                            <td className="px-6 py-3.5 text-amber-600">{c.usedDays} day(s)</td>
                            <td className="px-6 py-3.5 font-extrabold text-indigo-700">{c.remainingDays} day(s)</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}



          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {/* SECTION 3: REQUESTS QUEUE                                                    */}
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {(activeTab === 'requests' || activeEmployeeId || !isHR) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Time Off Requests</h2>
                  <p className="text-xs text-slate-500">{requests.length} records</p>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3.5 text-left font-semibold">Employee</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Type</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Period</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Duration</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Status</th>
                      <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                          No leave requests found.
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedRequest(r)}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">
                              {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                            </div>
                            <div className="text-xs text-slate-400">#{r.employee?.employeeNumber || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {r.timeOffType?.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                            {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                            {r.daysRequested} {r.timeOffType?.unit || 'DAYS'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {r.status === 'APPROVED' || r.status === 'VALIDATED' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                APPROVED
                              </span>
                            ) : r.status === 'REFUSED' ? (
                              <div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  REFUSED
                                </span>
                                {r.refusalReason && (
                                  <p className="text-xs text-rose-600 italic mt-1 font-normal">"{r.refusalReason}"</p>
                                )}
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                TO APPROVE / PENDING
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedRequest(r)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded border border-indigo-100 mr-2"
                            >
                              View Detail
                            </button>
                            {isHR && r.status !== 'APPROVED' && (
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                              >
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {/* SECTION 4: ALLOCATIONS LIST                                                  */}
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'allocations' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Employee Leave Allocations</h2>
                  <p className="text-xs text-slate-500">View and manage employee annual leave allocations.</p>
                </div>
                {isHR && (
                  <button
                    onClick={() => {
                      setAllocForm({
                        employeeId: employees[0]?.id || '',
                        timeOffTypeId: types[0]?.id || '',
                        year: new Date().getFullYear(),
                        daysAllocated: 10,
                      });
                      setShowAllocModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm"
                  >
                    + Set Allocation
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3.5 text-left font-semibold">Employee</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Type</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Allocated</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Taken</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Remaining</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Status</th>
                      <th className="px-6 py-3.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allocations.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedAllocation(a)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">
                            {a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '—'}
                          </div>
                          <div className="text-xs text-slate-400">#{a.employee?.employeeNumber || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-indigo-600">{a.timeOffType?.name}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-800">{a.daysAllocated} days</td>
                        <td className="px-6 py-4 text-center font-semibold text-amber-600">{a.daysUsed} days</td>
                        <td className="px-6 py-4 text-center font-extrabold text-emerald-600">{a.remaining} days</td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            Approved
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedAllocation(a)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded border border-indigo-100"
                          >
                            View Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {/* SECTION 5: CONFIGURABLE LEAVE TYPES                                           */}
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'types' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Time Off Types Configuration</h2>
                  <p className="text-xs text-slate-500">Manage configurable leave policies, units, and approval rules.</p>
                </div>
                {isHR && (
                  <button
                    onClick={() => {
                      setEditingType(null);
                      setTypeForm({
                        name: '',
                        code: '',
                        description: '',
                        unit: 'DAYS',
                        isPaid: true,
                        requiresAllocation: true,
                        allocationAmount: 10,
                        requiresApproval: true,
                        isEarnedThroughWork: false,
                        isSandwichLeave: false,
                        carryForwardDays: 0,
                        expiryDays: '',
                      });
                      setShowTypeModal(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-sm"
                  >
                    + Add Leave Type
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {types.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => setSelectedType(t)}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{t.name}</h3>
                        <span className="text-xs text-slate-400 font-mono">Code: {t.code}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 italic min-h-[32px]">{t.description || 'No description provided.'}</p>

                    <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unit:</span>
                        <strong className="text-slate-800">{t.unit}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Requires Allocation:</span>
                        <strong className={t.requiresAllocation ? 'text-indigo-600' : 'text-slate-500'}>
                          {t.requiresAllocation ? 'Yes' : 'No'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Approval Required:</span>
                        <strong className={t.requiresApproval ? 'text-emerald-600' : 'text-slate-500'}>
                          {t.requiresApproval ? 'Yes' : 'No'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedType(t)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100"
                      >
                        View Configuration
                      </button>
                      {isHR && (
                        <button
                          onClick={() => openTypeModalForEdit(t)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


        </>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* DETAIL MODAL 1: TIME OFF REQUEST DETAIL (`Time Off Request / <Employee>`)     */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Time Off Request Detail</span>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedRequest.employee
                    ? `${selectedRequest.employee.firstName} ${selectedRequest.employee.lastName}`
                    : 'Employee Request'}
                </h2>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <strong className="text-slate-800">{selectedRequest.employee ? `${selectedRequest.employee.firstName} ${selectedRequest.employee.lastName}` : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time Off Type:</span>
                <strong className="text-indigo-600 font-bold">{selectedRequest.timeOffType?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Start Date:</span>
                <strong className="text-slate-800">{new Date(selectedRequest.startDate).toLocaleDateString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">End Date:</span>
                <strong className="text-slate-800">{new Date(selectedRequest.endDate).toLocaleDateString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration:</span>
                <strong className="text-indigo-700 text-sm font-extrabold">{selectedRequest.daysRequested} {selectedRequest.timeOffType?.unit || 'DAYS'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${selectedRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : selectedRequest.status === 'REFUSED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                  {selectedRequest.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Approver:</span>
                <strong className="text-slate-800">{selectedRequest.approvedById || 'Pending Review'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Allocation Used:</span>
                <strong className="text-slate-800">{selectedRequest.timeOffType?.requiresAllocation ? 'Yes' : 'No'}</strong>
              </div>
            </div>

            {selectedRequest.reason && (
              <div>
                <span className="text-xs text-slate-500 font-semibold block mb-1">Reason / Remarks</span>
                <p className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 italic">
                  "{selectedRequest.reason}"
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button onClick={() => setSelectedRequest(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Close
              </button>
              {isHR && selectedRequest.status !== 'APPROVED' && (
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(selectedRequest.id)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                    Approve
                  </button>
                  <button onClick={() => handleRefuse(selectedRequest.id)} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700">
                    Refuse
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* DETAIL MODAL 2: ALLOCATION DETAIL (`Allocation / <Employee>`)                  */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedAllocation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Allocation Detail</span>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedAllocation.employee
                    ? `${selectedAllocation.employee.firstName} ${selectedAllocation.employee.lastName}`
                    : 'Employee Allocation'}
                </h2>
              </div>
              <button onClick={() => setSelectedAllocation(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <strong className="text-slate-800">{selectedAllocation.employee ? `${selectedAllocation.employee.firstName} ${selectedAllocation.employee.lastName}` : '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time Off Type:</span>
                <strong className="text-indigo-600 font-bold">{selectedAllocation.timeOffType?.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Allocated:</span>
                <strong className="text-slate-800">{selectedAllocation.daysAllocated} days</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Taken:</span>
                <strong className="text-amber-600">{selectedAllocation.daysUsed} days</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Remaining Balance:</span>
                <strong className="text-emerald-700 text-sm font-extrabold">{selectedAllocation.remaining} days</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">Approved</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validity:</span>
                <strong className="text-slate-800">Year {selectedAllocation.year}</strong>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setSelectedAllocation(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* DETAIL MODAL 3: TIME OFF TYPE DETAIL (`Time Off Type / <Type>`)               */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Time Off Type Detail</span>
                <h2 className="text-xl font-bold text-slate-800">{selectedType.name}</h2>
              </div>
              <button onClick={() => setSelectedType(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Type Name:</span>
                <strong className="text-slate-800">{selectedType.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Code:</span>
                <strong className="text-indigo-600 font-mono font-bold">{selectedType.code}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unit:</span>
                <strong className="text-slate-800">{selectedType.unit}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requires Allocation:</span>
                <strong className="text-slate-800">{selectedType.requiresAllocation ? 'Yes' : 'No'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Status:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requires Approval:</span>
                <strong className="text-slate-800">{selectedType.requiresApproval ? 'Yes' : 'No'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payroll / Work Entry:</span>
                <strong className="text-slate-800">{selectedType.isEarnedThroughWork ? 'Earned via Overtime Work (Comp-Off)' : 'Standard Leave Entry'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sandwich Rule:</span>
                <strong className="text-purple-700">{selectedType.isSandwichLeave ? 'Enabled 🥪' : 'Disabled'}</strong>
              </div>
            </div>

            {selectedType.description && (
              <div>
                <span className="text-xs text-slate-500 font-semibold block mb-1">Configuration Notes & Description</span>
                <p className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 italic">
                  "{selectedType.description}"
                </p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={() => setSelectedType(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* FORM MODAL 1: SUBMIT TIME OFF REQUEST                                         */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showReqModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Submit Time Off Request</h2>
              <button onClick={() => setShowReqModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={submitRequest} className="space-y-4">
              {isHR && !activeEmployeeId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                  <select
                    required
                    value={reqForm.employeeId}
                    onChange={(e) => setReqForm({ ...reqForm, employeeId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type *</label>
                <select
                  required
                  value={reqForm.timeOffTypeId}
                  onChange={(e) => setReqForm({ ...reqForm, timeOffTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Leave Type...</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isSandwichLeave ? '(Sandwich Rule Active 🥪)' : ''}
                    </option>
                  ))}
                </select>
                {selectedTypeForReq?.isSandwichLeave && (
                  <p className="text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 mt-1">
                    🥪 <strong>Sandwich Rule:</strong> Weekend days falling between leave dates will be included in total leave requested.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={reqForm.startDate}
                    onChange={(e) => setReqForm({ ...reqForm, startDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={reqForm.endDate}
                    onChange={(e) => setReqForm({ ...reqForm, endDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Days Requested</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={reqForm.daysRequested}
                  onChange={(e) => setReqForm({ ...reqForm, daysRequested: parseFloat(e.target.value) || 1 })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Remarks</label>
                <textarea
                  placeholder="Reason for requesting leave..."
                  value={reqForm.reason}
                  onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* FORM MODAL 2: AWARD COMP-OFF CREDIT                                           */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showCompOffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Award Comp-Off Credit</h2>
              <button onClick={() => setShowCompOffModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={submitCompOffCredit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                <select
                  required
                  value={compOffForm.employeeId}
                  onChange={(e) => setCompOffForm({ ...compOffForm, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date Earned *</label>
                  <input
                    type="date"
                    required
                    value={compOffForm.dateEarned}
                    onChange={(e) => setCompOffForm({ ...compOffForm, dateEarned: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Days Earned *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={compOffForm.daysEarned}
                    onChange={(e) => setCompOffForm({ ...compOffForm, daysEarned: parseFloat(e.target.value) || 1 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hours Worked</label>
                <input
                  type="number"
                  step="0.5"
                  value={compOffForm.hoursWorked}
                  onChange={(e) => setCompOffForm({ ...compOffForm, hoursWorked: parseFloat(e.target.value) || 8 })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Work Details *</label>
                <textarea
                  required
                  placeholder="e.g. Worked extra hours on Saturday release deployment..."
                  value={compOffForm.reason}
                  onChange={(e) => setCompOffForm({ ...compOffForm, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCompOffModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Granting...' : 'Grant Comp-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* FORM MODAL 3: ADD / EDIT TIME OFF TYPE                                         */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">
                {editingType ? 'Edit Leave Type Policy' : 'Add New Leave Type'}
              </h2>
              <button onClick={() => setShowTypeModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={submitType} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                  <input
                    required
                    placeholder="e.g. Sick Leave"
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value, code: typeForm.code || e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
                  <input
                    required
                    placeholder="e.g. SICK"
                    value={typeForm.code}
                    onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  placeholder="Policy explanation for employees..."
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Annual Allocation</label>
                  <input
                    type="number"
                    step="0.5"
                    value={typeForm.allocationAmount}
                    onChange={(e) => setTypeForm({ ...typeForm, allocationAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={typeForm.unit}
                    onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="DAYS">DAYS</option>
                    <option value="HOURS">HOURS</option>
                  </select>
                </div>
              </div>

              {/* Policy Checkboxes */}
              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs font-medium text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeForm.isPaid}
                    onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Is Paid Leave</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeForm.requiresAllocation}
                    onChange={(e) => setTypeForm({ ...typeForm, requiresAllocation: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>Requires Annual Allocation</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeForm.isSandwichLeave}
                    onChange={(e) => setTypeForm({ ...typeForm, isSandwichLeave: e.target.checked })}
                    className="rounded text-purple-600"
                  />
                  <span>Enable Sandwich Leave Rule 🥪 (Includes intervening weekends/holidays)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeForm.isEarnedThroughWork}
                    onChange={(e) => setTypeForm({ ...typeForm, isEarnedThroughWork: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Earned Through Additional Work / Overtime (Comp-Off)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Leave Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* FORM MODAL 4: SET LEAVE ALLOCATION                                            */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showAllocModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-800">Set Employee Allocation</h2>
              <button onClick={() => setShowAllocModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={submitAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                <select
                  required
                  value={allocForm.employeeId}
                  onChange={(e) => setAllocForm({ ...allocForm, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type *</label>
                <select
                  required
                  value={allocForm.timeOffTypeId}
                  onChange={(e) => setAllocForm({ ...allocForm, timeOffTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Leave Type...</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year *</label>
                  <input
                    type="number"
                    required
                    value={allocForm.year}
                    onChange={(e) => setAllocForm({ ...allocForm, year: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Days Allocated *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={allocForm.daysAllocated}
                    onChange={(e) => setAllocForm({ ...allocForm, daysAllocated: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
