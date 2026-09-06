import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import {
  fetchTimeOffRequests,
  fetchTimeOffAllocations,
  fetchTimeOffTypes,
  fetchLeaveBalances,
  fetchTimeOffRequestDetail,
  fetchTimeOffAllocationDetail,
  createTimeOffRequest,
  approveTimeOffRequest,
  refuseTimeOffRequest,
  cancelTimeOffRequest,
  createTimeOffAllocation,
  createTimeOffType,
  updateTimeOffType,
  creditCompOff,
  type TimeOffRequest,
  type TimeOffAllocation,
  type TimeOffType,
  type LeaveBalanceItem,
} from '../api/timeoff';
import { fetchEmployees, fetchEmployee, type Employee } from '../api/hr';

interface TimeOffPageProps {
  initialTab?: 'requests' | 'allocations';
}

export default function TimeOffPage({ initialTab }: TimeOffPageProps) {
  const {
    employeeId: paramEmployeeId,
    requestId: paramRequestId,
    allocationId: paramAllocationId,
  } = useParams<{
    employeeId?: string;
    requestId?: string;
    allocationId?: string;
  }>();

  const [searchParams] = useSearchParams();
  const queryEmployeeId = searchParams.get('employeeId') || '';
  const activeEmployeeId = paramEmployeeId || queryEmployeeId || undefined;

  const { user } = useAuth();
  const isHR = user?.role && user.role !== 'EMPLOYEE';

  // Active Tab state (only Requests and Allocations for HR)
  const defaultTab = initialTab || (paramAllocationId ? 'allocations' : 'requests');
  const [activeTab, setActiveTab] = useState<'requests' | 'allocations'>(defaultTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (paramRequestId) {
      setActiveTab('requests');
    } else if (paramAllocationId) {
      setActiveTab('allocations');
    }
  }, [initialTab, paramRequestId, paramAllocationId]);

  // Data states
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [myBalances, setMyBalances] = useState<LeaveBalanceItem[]>([]);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination state
  const [reqPage, setReqPage] = useState(1);
  const [reqPageSize, setReqPageSize] = useState(10);
  const [allocPage, setAllocPage] = useState(1);
  const [allocPageSize, setAllocPageSize] = useState(10);

  useEffect(() => {
    setReqPage(1);
    setAllocPage(1);
  }, [search, activeEmployeeId]);

  // Modals for creation
  const [showReqModal, setShowReqModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCompOffModal, setShowCompOffModal] = useState(false);

  // Detail Modals for specific items
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<TimeOffAllocation | null>(null);
  const [selectedType, setSelectedType] = useState<TimeOffType | null>(null);

  const [selectedReqBalances, setSelectedReqBalances] = useState<LeaveBalanceItem[]>([]);
  const [loadingReqBalances, setLoadingReqBalances] = useState(false);

  useEffect(() => {
    if (selectedRequest?.employeeId) {
      setLoadingReqBalances(true);
      fetchLeaveBalances({ employeeId: selectedRequest.employeeId })
        .then((res) => {
          if (res && 'balances' in res) {
            setSelectedReqBalances(res.balances);
          } else {
            setSelectedReqBalances([]);
          }
        })
        .catch((err) => {
          console.error('Error fetching request employee balances:', err);
          setSelectedReqBalances([]);
        })
        .finally(() => setLoadingReqBalances(false));
    } else {
      setSelectedReqBalances([]);
    }
  }, [selectedRequest?.id, selectedRequest?.employeeId]);

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

  // Auto-calculate days requested from start and end dates
  useEffect(() => {
    if (reqForm.startDate && reqForm.endDate) {
      const start = new Date(reqForm.startDate);
      const end = new Date(reqForm.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setReqForm((prev) => ({ ...prev, daysRequested: diffDays }));
      }
    }
  }, [reqForm.startDate, reqForm.endDate]);

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
      const [reqs, allocs, typs, emps, balanceRes] = await Promise.all([
        fetchTimeOffRequests({ employeeId: activeEmployeeId, search }),
        fetchTimeOffAllocations({ employeeId: activeEmployeeId }),
        fetchTimeOffTypes(),
        isHR ? fetchEmployees() : Promise.resolve([]),
        fetchLeaveBalances({ employeeId: activeEmployeeId }),
      ]);

      setRequests(reqs);
      setAllocations(allocs);
      setTypes(typs);
      setEmployees(emps);

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
    } catch (err) {
      console.error('Error loading time off data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [search, activeEmployeeId, paramRequestId, paramAllocationId]);

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

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      const res = await cancelTimeOffRequest(id);
      alert(res.message);
      setSelectedRequest(null);
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel leave request');
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

      {/* Sub-Navigation Tabs Bar (Requests & Allocations for HR) */}
      {isHR && (
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto bg-white px-4 py-2.5 rounded-xl border">
          {[
            { id: 'requests' as const, label: `Time Off Requests (${requests.length})`, icon: '📋' },
            { id: 'allocations' as const, label: `Allocations (${allocations.length})`, icon: '📊' },
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
      )}

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
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {/* SECTION 1: MY TIME OFF BALANCE (EMPLOYEE PORTAL VIEW)                          */}
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {(myBalances.length > 0 || activeEmployeeId || !isHR) && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800 tracking-wide uppercase">MY TIME OFF BALANCE</h2>
                  <p className="text-xs text-slate-500">Live available leave balances and allocations</p>
                </div>
                <button
                  onClick={openNewRequestModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>New Request</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase">
                    <tr>
                      <th className="px-6 py-3.5 text-left font-semibold">Type</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Allocated</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Used</th>
                      <th className="px-6 py-3.5 text-center font-semibold">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {myBalances.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                          No leave balance records found.
                        </td>
                      </tr>
                    ) : (
                      myBalances.map((b) => (
                        <tr key={b.timeOffTypeId} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{b.name}</td>
                          <td className="px-6 py-4 text-center font-semibold text-slate-700">{b.allocated} days</td>
                          <td className="px-6 py-4 text-center font-semibold text-amber-600">{b.taken} days</td>
                          <td className="px-6 py-4 text-center font-extrabold text-emerald-600">{b.remaining} days</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}



          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {/* SECTION 3: REQUESTS QUEUE / MY REQUESTS LIST                                  */}
          {/* ───────────────────────────────────────────────────────────────────────────── */}
          {(activeTab === 'requests' || activeEmployeeId || !isHR) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {isHR && !activeEmployeeId ? 'Time Off Requests' : 'My Requests'}
                  </h2>
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
                      {isHR && !activeEmployeeId && <th className="px-6 py-3.5 text-left font-semibold">Employee</th>}
                      <th className="px-6 py-3.5 text-left font-semibold">Type</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Start</th>
                      <th className="px-6 py-3.5 text-left font-semibold">End</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Duration</th>
                      <th className="px-6 py-3.5 text-left font-semibold">Status</th>
                      <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={isHR && !activeEmployeeId ? 7 : 6} className="px-6 py-8 text-center text-slate-400">
                          No leave requests found.
                        </td>
                      </tr>
                    ) : (
                      requests.slice((reqPage - 1) * reqPageSize, reqPage * reqPageSize).map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setSelectedRequest(r)}
                        >
                          {isHR && !activeEmployeeId && (
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">
                                {r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}
                              </div>
                              <div className="text-xs text-slate-400">#{r.employee?.employeeNumber || 'N/A'}</div>
                            </td>
                          )}
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {r.timeOffType?.name}
                          </td>
                          <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                            {new Date(r.startDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                            {new Date(r.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                            {r.daysRequested} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {r.status === 'APPROVED' || r.status === 'VALIDATED' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Approved
                              </span>
                            ) : r.status === 'REFUSED' ? (
                              <div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  Refused
                                </span>
                                {r.refusalReason && (
                                  <p className="text-xs text-rose-600 italic mt-1 font-normal">"{r.refusalReason}"</p>
                                )}
                              </div>
                            ) : r.status === 'CANCELLED' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                Cancelled
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Pending
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
                            {r.status !== 'APPROVED' && r.status !== 'CANCELLED' && r.status !== 'REFUSED' && (
                              <button
                                onClick={() => handleCancel(r.id)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-bold transition-colors border border-slate-300 shadow-2xs mr-1"
                              >
                                Cancel Request
                              </button>
                            )}
                            {isHR && r.status !== 'APPROVED' && r.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs mr-1"
                              >
                                Approve
                              </button>
                            )}
                            {isHR && r.status !== 'REFUSED' && r.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleRefuse(r.id)}
                                className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs"
                              >
                                Refuse
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={reqPage}
                pageSize={reqPageSize}
                total={requests.length}
                onPageChange={setReqPage}
                onPageSizeChange={setReqPageSize}
              />
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
                    {allocations.slice((allocPage - 1) * allocPageSize, allocPage * allocPageSize).map((a) => (
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

              <Pagination
                page={allocPage}
                pageSize={allocPageSize}
                total={allocations.length}
                onPageChange={setAllocPage}
                onPageSizeChange={setAllocPageSize}
              />
            </div>
          )}
        </>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* DETAIL MODAL 1: TIME OFF REQUEST DETAIL (`Time Off Request / <Employee>`)     */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-6 border border-slate-100 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">
                  Time Off Request Detail
                </span>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedRequest.employee
                    ? `${selectedRequest.employee.firstName} ${selectedRequest.employee.lastName}`
                    : 'Employee Request'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* SECTION A: REQUEST INFORMATION */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span> REQUEST INFORMATION
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Employee:</span>
                  <strong className="text-slate-800">
                    {selectedRequest.employee
                      ? `${selectedRequest.employee.firstName} ${selectedRequest.employee.lastName} (#${selectedRequest.employee.employeeNumber})`
                      : '—'}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Time Off Type:</span>
                  <strong className="text-indigo-600 font-bold text-sm">
                    {selectedRequest.timeOffType?.name || 'Leave'}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Start Date:</span>
                  <strong className="text-slate-800">
                    {new Date(selectedRequest.startDate).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">End Date:</span>
                  <strong className="text-slate-800">
                    {new Date(selectedRequest.endDate).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Duration:</span>
                  <strong className="text-indigo-700 font-extrabold text-sm">
                    {selectedRequest.daysRequested} {selectedRequest.timeOffType?.unit || 'DAYS'}
                  </strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Status:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                      selectedRequest.status === 'APPROVED' || selectedRequest.status === 'VALIDATED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : selectedRequest.status === 'REFUSED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {selectedRequest.status === 'CONFIRMED' || selectedRequest.status === 'DRAFT'
                      ? 'Pending'
                      : selectedRequest.status}
                  </span>
                </div>
                {selectedRequest.reason && (
                  <div className="pt-1">
                    <span className="text-slate-500 font-medium block mb-1">Reason / Remarks:</span>
                    <p className="italic bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700">
                      "{selectedRequest.reason}"
                    </p>
                  </div>
                )}
                {selectedRequest.refusalReason && (
                  <div className="pt-1">
                    <span className="text-rose-600 font-bold block mb-1">Refusal Reason:</span>
                    <p className="italic bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-rose-800 font-medium">
                      "{selectedRequest.refusalReason}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION B: EMPLOYEE LEAVE BALANCE OVERVIEW */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📊</span> EMPLOYEE LEAVE BALANCE
                </h3>
                <span className="text-[11px] text-slate-400">
                  Live leave totals for {selectedRequest.employee?.firstName || 'Employee'}
                </span>
              </div>

              {loadingReqBalances ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border">
                  Loading employee leave balances...
                </div>
              ) : selectedReqBalances.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border">
                  No leave balance records available.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Allocated</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Taken</th>
                        <th className="px-4 py-2.5 text-center font-semibold">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedReqBalances.map((b) => {
                        const isSelectedType =
                          b.timeOffTypeId === selectedRequest.timeOffTypeId ||
                          b.code === selectedRequest.timeOffType?.code;

                        return (
                          <tr
                            key={b.timeOffTypeId}
                            className={
                              isSelectedType
                                ? 'bg-indigo-50/90 font-bold border-l-4 border-indigo-600'
                                : 'hover:bg-slate-50 transition-colors'
                            }
                          >
                            <td className="px-4 py-2.5 font-bold text-slate-800 flex items-center gap-1.5">
                              <span>{b.name}</span>
                              {isSelectedType && (
                                <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-indigo-600 text-white rounded">
                                  Requested
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center font-medium text-slate-700">
                              {b.requiresAllocation ? `${b.allocated} days` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center font-semibold text-amber-600">
                              {b.taken} days
                            </td>
                            <td className="px-4 py-2.5 text-center font-extrabold text-emerald-600">
                              {b.remaining} days
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CURRENT REQUEST CONTEXT & PREVIEW */}
              {(() => {
                const reqTypeBalance = selectedReqBalances.find(
                  (b) =>
                    b.timeOffTypeId === selectedRequest.timeOffTypeId ||
                    b.code === selectedRequest.timeOffType?.code
                );

                if (!reqTypeBalance) return null;

                const currentRemaining = reqTypeBalance.remaining;
                const requestedDays = selectedRequest.daysRequested;
                const remainingAfterApproval = Math.max(0, currentRemaining - requestedDays);

                if (selectedRequest.status === 'APPROVED' || selectedRequest.status === 'VALIDATED') {
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center justify-between">
                      <div>
                        <strong>Status: Approved</strong> — {requestedDays} days deducted from {reqTypeBalance.name}.
                      </div>
                      <div className="font-extrabold text-emerald-700">
                        Remaining: {currentRemaining} days
                      </div>
                    </div>
                  );
                }

                if (selectedRequest.status === 'REFUSED') {
                  return (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center justify-between">
                      <div>
                        <strong>Status: Refused</strong> — No balance deducted.
                      </div>
                      <div className="font-extrabold text-slate-700">
                        Current Remaining: {currentRemaining} days
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3.5 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        <span>💡</span> Approval Preview Context ({reqTypeBalance.name})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center bg-white p-2.5 rounded-lg border border-indigo-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Remaining</span>
                        <strong className="text-slate-800 text-sm">{currentRemaining} days</strong>
                      </div>
                      <div>
                        <span className="text-indigo-400 block text-[10px] uppercase font-bold">Requested</span>
                        <strong className="text-indigo-600 text-sm">-{requestedDays} days</strong>
                      </div>
                      <div>
                        <span className="text-emerald-500 block text-[10px] uppercase font-bold">Remaining If Approved</span>
                        <strong className="text-emerald-600 text-sm">{remainingAfterApproval} days</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-indigo-700 italic">
                      * Preview only. Balance is not deducted until HR approves this request.
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                {selectedRequest.status !== 'APPROVED' && selectedRequest.status !== 'CANCELLED' && selectedRequest.status !== 'REFUSED' && (
                  <button
                    onClick={() => handleCancel(selectedRequest.id)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors border border-slate-300 shadow-2xs"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
              {isHR && selectedRequest.status !== 'APPROVED' && selectedRequest.status !== 'VALIDATED' && selectedRequest.status !== 'CANCELLED' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(selectedRequest.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRefuse(selectedRequest.id)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
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

              {/* Dynamic Balance Preview Calculation */}
              {(() => {
                const selectedBal = myBalances.find((b) => b.timeOffTypeId === reqForm.timeOffTypeId);
                if (!selectedBal) return null;
                const available = selectedBal.remaining;
                const requested = reqForm.daysRequested || 0;
                const remainingAfter = available - requested;

                return (
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium">Available:</span>
                      <span className="font-bold text-slate-900">{available} days</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="font-medium">Requested:</span>
                      <span className="font-bold text-indigo-700">{requested} days</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-indigo-200 font-bold">
                      <span className="text-slate-800">Remaining after approval:</span>
                      <span className={remainingAfter < 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                        {remainingAfter} days
                      </span>
                    </div>
                  </div>
                );
              })()}

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
