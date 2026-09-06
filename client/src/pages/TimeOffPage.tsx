import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchTimeOffRequests,
  fetchTimeOffAllocations,
  fetchTimeOffTypes,
  fetchLeaveBalances,
  fetchCompOffCredits,
  fetchTimeOffLedger,
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
  type TimeOffLedgerRecord,
} from '../api/timeoff';
import { fetchEmployees, fetchEmployee, type Employee } from '../api/hr';

export default function TimeOffPage() {
  const { employeeId: paramEmployeeId } = useParams<{ employeeId?: string }>();
  const [searchParams] = useSearchParams();
  const queryEmployeeId = searchParams.get('employeeId') || '';

  const activeEmployeeId = paramEmployeeId || queryEmployeeId || undefined;

  const { user } = useAuth();
  const isHR = user?.role && user.role !== 'EMPLOYEE';

  // Active Tab for HR / Admin view
  const [activeTab, setActiveTab] = useState<'balances' | 'requests' | 'compoff' | 'allocations' | 'types' | 'ledger'>('balances');

  // Data states
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [myBalances, setMyBalances] = useState<LeaveBalanceItem[]>([]);
  const [matrixData, setMatrixData] = useState<Array<{ employee: any; balances: LeaveBalanceItem[] }>>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [compOffCredits, setCompOffCredits] = useState<CompOffCreditRecord[]>([]);
  const [ledgers, setLedgers] = useState<TimeOffLedgerRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showReqModal, setShowReqModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCompOffModal, setShowCompOffModal] = useState(false);

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

  // Load data based on active view & role
  const loadAll = async () => {
    setLoading(true);
    try {
      const [reqs, allocs, typs, emps, compOffs, ledgerLogs, balanceRes] = await Promise.all([
        fetchTimeOffRequests({ employeeId: activeEmployeeId, search }),
        fetchTimeOffAllocations({ employeeId: activeEmployeeId }),
        fetchTimeOffTypes(),
        isHR ? fetchEmployees() : Promise.resolve([]),
        fetchCompOffCredits({ employeeId: activeEmployeeId }),
        fetchTimeOffLedger({ employeeId: activeEmployeeId }),
        fetchLeaveBalances({ employeeId: activeEmployeeId }),
      ]);

      setRequests(reqs);
      setAllocations(allocs);
      setTypes(typs);
      setEmployees(emps);
      setCompOffCredits(compOffs);
      setLedgers(ledgerLogs);

      if (balanceRes && 'matrix' in balanceRes) {
        setMatrixData(balanceRes.matrix);
        setMyBalances([]);
      } else if (balanceRes && 'balances' in balanceRes) {
        setMyBalances(balanceRes.balances);
        setMatrixData([]);
      }
    } catch (err) {
      console.error('Error loading time off data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [search, activeEmployeeId]);

  // Form Handlers
  const handleApprove = async (id: string) => {
    try {
      const res = await approveTimeOffRequest(id);
      alert(res.message);
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
              <h1 className="text-2xl font-bold text-slate-800">Time Off & Leave Management</h1>
              <p className="text-sm text-slate-500">
                Track configurable leave balances, Comp-Off credits, requests, and policy rules.
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

      {/* Tabs Bar for HR vs Employee */}
      {isHR && !activeEmployeeId ? (
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
          {(
            [
              { id: 'balances', label: 'Employee Balances Matrix' },
              { id: 'requests', label: `Leave Requests (${requests.length})` },
              { id: 'compoff', label: `Comp-Off Credits (${compOffCredits.length})` },
              { id: 'allocations', label: `Allocations (${allocations.length})` },
              { id: 'types', label: `Leave Types (${types.length})` },
              { id: 'ledger', label: 'Audit Ledger' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3"></div>
          <p className="text-sm font-medium">Loading time off and leave balances...</p>
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
      {/* SECTION 2: HR MATRIX VIEW                                                    */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {isHR && !activeEmployeeId && activeTab === 'balances' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Employee Leave Balances Matrix</h2>
              <p className="text-xs text-slate-500">Overview of calculated leave balances across all employees.</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Employee</th>
                  {types.map((t) => (
                    <th key={t.id} className="px-4 py-3 text-center font-bold">
                      {t.name} (Left)
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.map(({ employee, balances }) => (
                  <tr key={employee.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{employee.firstName} {employee.lastName}</div>
                      <div className="text-[10px] text-slate-400">#{employee.employeeNumber} • {employee.department || 'General'}</div>
                    </td>
                    {types.map((t) => {
                      const bal = balances.find((b) => b.timeOffTypeId === t.id);
                      return (
                        <td key={t.id} className="px-4 py-3 text-center">
                          <span className="font-extrabold text-slate-800 text-sm">
                            {bal ? bal.remaining : '0'}
                          </span>
                          {bal && bal.pending > 0 && (
                            <span className="block text-[10px] text-amber-600 font-medium">({bal.pending} pending)</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/employees/${employee.id}/timeoff`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded border border-indigo-100 transition-colors"
                      >
                        View Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: REQUESTS QUEUE                                                    */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {(activeTab === 'requests' || activeEmployeeId || !isHR) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Leave Requests Queue</h2>
            <span className="text-xs text-slate-500">{requests.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold">Employee</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Type</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Period</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Requested</th>
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
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
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
                            PENDING REVIEW
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {isHR && r.status !== 'APPROVED' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRefuse(r.id)}
                              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
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
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: COMP-OFF CREDITS LIST (HR VIEW)                                   */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {isHR && !activeEmployeeId && activeTab === 'compoff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Compensatory Leave (Comp-Off) Log</h2>
              <p className="text-xs text-slate-500">Track all Comp-Off credits earned from extra work / overtime.</p>
            </div>
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
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm"
            >
              + Award Comp-Off Credit
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold">Employee</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Date Earned</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Reason</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Hours Worked</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Earned</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Used</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compOffCredits.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        {c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : '—'}
                      </div>
                      <div className="text-xs text-slate-400">#{c.employee?.employeeNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{new Date(c.dateEarned).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-slate-600">{c.reason || 'Overtime work'}</td>
                    <td className="px-6 py-4 font-semibold text-indigo-600">{c.hoursWorked ? `${c.hoursWorked} hrs` : '—'}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">+{c.daysEarned} day(s)</td>
                    <td className="px-6 py-4 text-amber-600">{c.usedDays} day(s)</td>
                    <td className="px-6 py-4 font-extrabold text-indigo-700">{c.remainingDays} day(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 4.5: LEAVE ALLOCATIONS LIST (HR VIEW)                                */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {isHR && !activeEmployeeId && activeTab === 'allocations' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Employee Leave Allocations</h2>
              <p className="text-xs text-slate-500">View and set annual leave allocations for employees.</p>
            </div>
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
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold">Employee</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Leave Type</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Year</th>
                  <th className="px-6 py-3.5 text-center font-semibold">Allocated</th>
                  <th className="px-6 py-3.5 text-center font-semibold">Used</th>
                  <th className="px-6 py-3.5 text-center font-semibold">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        {a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : '—'}
                      </div>
                      <div className="text-xs text-slate-400">#{a.employee?.employeeNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-indigo-600">{a.timeOffType?.name}</td>
                    <td className="px-6 py-4 text-slate-600">{a.year}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-800">{a.daysAllocated}</td>
                    <td className="px-6 py-4 text-center font-semibold text-amber-600">{a.daysUsed}</td>
                    <td className="px-6 py-4 text-center font-extrabold text-emerald-600">{a.remaining}</td>
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
      {isHR && !activeEmployeeId && activeTab === 'types' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-800">Configurable Time Off Types</h2>
              <p className="text-xs text-slate-500">Define leave policy rules, Sandwich rules, and Comp-Off credit behavior.</p>
            </div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {types.map((t) => (
              <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{t.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">Code: {t.code}</span>
                  </div>
                  <button
                    onClick={() => openTypeModalForEdit(t)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100"
                  >
                    Edit
                  </button>
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
                      {t.requiresAllocation ? `Yes (${t.allocationAmount || 0} days)` : 'No'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sandwich Leave Rule:</span>
                    <strong className={t.isSandwichLeave ? 'text-purple-600' : 'text-slate-500'}>
                      {t.isSandwichLeave ? 'Enabled 🥪' : 'Disabled'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Earned Through Work:</span>
                    <strong className={t.isEarnedThroughWork ? 'text-emerald-600' : 'text-slate-500'}>
                      {t.isEarnedThroughWork ? 'Yes (Comp-Off)' : 'No'}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* SECTION 6: AUDIT LEDGER                                                      */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {isHR && !activeEmployeeId && activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Time Off Audit Ledger</h2>
            <p className="text-xs text-slate-500">Traceable historical audit log explaining balance changes.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">Date & Time</th>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Leave Type</th>
                  <th className="px-4 py-3 text-left">Action Type</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Balance After</th>
                  <th className="px-4 py-3 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgers.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">{l.timeOffType?.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{l.type}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className={l.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {l.amount >= 0 ? `+${l.amount}` : l.amount}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-800">{l.balanceAfter != null ? l.balanceAfter : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: SUBMIT TIME OFF REQUEST                                              */}
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
      {/* MODAL 2: AWARD COMP-OFF CREDIT                                                */}
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
      {/* MODAL 3: ADD / EDIT TIME OFF TYPE                                             */}
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
      {/* MODAL 4: SET LEAVE ALLOCATION                                                 */}
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
