import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchAttendances,
  fetchAttendanceDetail,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  type AttendanceRecord,
} from '../api/attendance';
import { fetchEmployees, fetchEmployee, type Employee } from '../api/hr';
import AttendanceToggleWidget from '../components/AttendanceToggleWidget';
import Pagination from '../components/Pagination';

export default function AttendancePage() {
  const { attendanceId, employeeId } = useParams<{ attendanceId?: string; employeeId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHR = user?.role && user.role !== 'EMPLOYEE';

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, period, statusFilter, filterEmployeeId, employeeId]);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual / Edit Form state
  const [form, setForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    checkIn: '',
    checkOut: '',
    status: 'PRESENT',
    overtimeHours: 0,
    notes: '',
  });

  // Load target employee info if in employee-scoped view
  useEffect(() => {
    if (employeeId) {
      fetchEmployee(employeeId)
        .then((emp) => setTargetEmployee(emp))
        .catch((err) => console.error('Failed to load target employee:', err));
    } else {
      setTargetEmployee(null);
    }
  }, [employeeId]);

  // Load employees list for HR filter & manual entry modal
  useEffect(() => {
    if (isHR) {
      fetchEmployees()
        .then((emps) => setEmployees(emps))
        .catch((err) => console.error('Failed to fetch employees list:', err));
    }
  }, [isHR]);

  // Fetch Attendance Records based on filters & route parameters
  const loadData = async () => {
    setLoading(true);
    try {
      const activeEmployeeFilter = employeeId || filterEmployeeId || undefined;
      const activeStatus = statusFilter !== 'ALL' ? statusFilter : undefined;

      const records = await fetchAttendances({
        search,
        period,
        status: activeStatus,
        employeeId: activeEmployeeFilter,
      });
      setAttendances(records);

      // If route has attendanceId, open detail view for it
      if (attendanceId) {
        const directRecord = records.find((r) => r.id === attendanceId);
        if (directRecord) {
          setSelectedRecord(directRecord);
          setShowDetailModal(true);
        } else {
          try {
            const fetched = await fetchAttendanceDetail(attendanceId);
            if (fetched) {
              setSelectedRecord(fetched);
              setShowDetailModal(true);
            }
          } catch (e) {
            console.error('Attendance record not found for route:', attendanceId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDataSilently = async () => {
    try {
      const activeEmployeeFilter = employeeId || filterEmployeeId || undefined;
      const activeStatus = statusFilter !== 'ALL' ? statusFilter : undefined;
      const records = await fetchAttendances({
        search,
        period,
        status: activeStatus,
        employeeId: activeEmployeeFilter,
      });
      setAttendances(records);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, period, statusFilter, filterEmployeeId, employeeId, attendanceId]);

  // Compute metrics
  const totalRecords = attendances.length;
  const presentCount = attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const activeSessionsCount = attendances.filter((a) => a.checkIn && !a.checkOut).length;
  const totalWorkedHours = attendances
    .reduce((sum, a) => sum + (a.workedHours || 0), 0)
    .toFixed(1);

  // Manual Entry Form submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) {
      alert('Please select an employee');
      return;
    }
    setSubmitting(true);
    try {
      const checkInIso = form.checkIn ? `${form.date}T${form.checkIn}:00.000Z` : null;
      const checkOutIso = form.checkOut ? `${form.date}T${form.checkOut}:00.000Z` : null;

      await createAttendance({
        employeeId: form.employeeId,
        date: form.date,
        checkIn: checkInIso,
        checkOut: checkOutIso,
        status: form.status,
        overtimeHours: Number(form.overtimeHours) || 0,
        notes: form.notes,
      });

      setShowManualModal(false);
      resetForm();
      loadDataSilently();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Detail Update submit
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      const dateStr = selectedRecord.date.slice(0, 10);
      const checkInIso = form.checkIn ? `${dateStr}T${form.checkIn}:00.000Z` : null;
      const checkOutIso = form.checkOut ? `${dateStr}T${form.checkOut}:00.000Z` : null;

      const updated = await updateAttendance(selectedRecord.id, {
        checkIn: checkInIso,
        checkOut: checkOutIso,
        status: form.status,
        overtimeHours: Number(form.overtimeHours) || 0,
        notes: form.notes,
      });

      setSelectedRecord(updated);
      setIsEditing(false);
      loadDataSilently();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await deleteAttendance(id);
      closeDetailModal();
      loadDataSilently();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const openManualModal = () => {
    resetForm();
    if (employeeId) {
      setForm((prev) => ({ ...prev, employeeId }));
    } else if (employees.length > 0) {
      setForm((prev) => ({ ...prev, employeeId: employees[0].id }));
    }
    setShowManualModal(true);
  };

  const openDetailModal = (rec: AttendanceRecord) => {
    setSelectedRecord(rec);
    setIsEditing(false);
    setForm({
      employeeId: rec.employeeId,
      date: rec.date ? rec.date.slice(0, 10) : '',
      checkIn: rec.checkIn ? new Date(rec.checkIn).toISOString().slice(11, 16) : '',
      checkOut: rec.checkOut ? new Date(rec.checkOut).toISOString().slice(11, 16) : '',
      status: rec.status,
      overtimeHours: rec.overtimeHours || 0,
      notes: rec.notes || '',
    });
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRecord(null);
    setIsEditing(false);
    if (attendanceId) {
      navigate('/attendance');
    }
  };

  const resetForm = () => {
    setForm({
      employeeId: '',
      date: new Date().toISOString().slice(0, 10),
      checkIn: '',
      checkOut: '',
      status: 'PRESENT',
      overtimeHours: 0,
      notes: '',
    });
  };

  const clearFilters = () => {
    setSearch('');
    setPeriod('ALL');
    setStatusFilter('ALL');
    setFilterEmployeeId('');
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '—';
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {employeeId && targetEmployee ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Link
                  to="/employees"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 transition-colors"
                >
                  ← Back to Employees
                </Link>
                <span className="text-xs font-medium text-slate-400">/</span>
                <span className="text-xs font-semibold text-slate-600">Employee Scope</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <span>Attendance Log:</span>
                <span className="text-indigo-600">{targetEmployee.firstName} {targetEmployee.lastName}</span>
              </h1>
              <p className="text-sm text-slate-500">
                Employee #{targetEmployee.employeeNumber} • {targetEmployee.department || 'General'} • {targetEmployee.jobTitle || 'Team Member'}
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Attendance Management</h1>
              <p className="text-sm text-slate-500">
                Monitor live check-ins, check-outs, work duration, and attendance history.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <AttendanceToggleWidget compact />
          {isHR && (
            <button
              onClick={openManualModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>+</span> Manual Entry
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Records</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalRecords}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            📋
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Present Days</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            ✅
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Sessions</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{activeSessionsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            ⏱️
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Worked Hours</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{totalWorkedHours} <span className="text-xs font-normal text-slate-500">hrs</span></p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            ⌛
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by employee name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Period Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start lg:self-auto overflow-x-auto">
            {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  period === p
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'ALL' ? 'All Time' : p === 'TODAY' ? 'Today' : p === 'THIS_WEEK' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="ABSENT">ABSENT</option>
              <option value="HALF_DAY">HALF_DAY</option>
            </select>

            {isHR && !employeeId && (
              <select
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px]"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                  </option>
                ))}
              </select>
            )}

            {(search || period !== 'ALL' || statusFilter !== 'ALL' || filterEmployeeId) && (
              <button
                onClick={clearFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1.5 rounded hover:bg-rose-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-3"></div>
          <p className="text-sm font-medium">Loading attendance records...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold">Employee</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Date</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Check In</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Check Out</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Worked Hours</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Overtime</th>
                  <th className="px-6 py-3.5 text-left font-semibold">Status</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <div className="text-3xl mb-2">📅</div>
                      <p className="text-slate-600 font-medium">No attendance records found</p>
                      <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search terms.</p>
                    </td>
                  </tr>
                ) : (
                  attendances.slice((page - 1) * pageSize, page * pageSize).map((att) => {
                    const empName = att.employee
                      ? `${att.employee.firstName} ${att.employee.lastName}`
                      : 'Unknown Employee';
                    const empInitials = att.employee?.firstName?.[0] || 'E';
                    const isActiveSession = att.checkIn && !att.checkOut;

                    return (
                      <tr
                        key={att.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => openDetailModal(att)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs"
                              style={{ backgroundColor: att.employee?.color || '#6366f1' }}
                            >
                              {empInitials}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">{empName}</div>
                              <div className="text-xs text-slate-400">
                                #{att.employee?.employeeNumber || 'N/A'} • {att.employee?.department || 'General'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 whitespace-nowrap font-medium">
                          {formatDate(att.date)}
                        </td>
                        <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                          {formatTime(att.checkIn)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {att.checkOut ? (
                            <span className="text-slate-600">{formatTime(att.checkOut)}</span>
                          ) : isActiveSession ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Active Session
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                          {att.workedHours != null ? `${att.workedHours} hrs` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {att.overtimeHours && att.overtimeHours > 0 ? (
                            <span className="text-indigo-600 font-semibold text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              +{att.overtimeHours} hrs
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {att.status === 'PRESENT' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              PRESENT
                            </span>
                          )}
                          {att.status === 'LATE' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              LATE
                            </span>
                          )}
                          {att.status === 'ABSENT' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              ABSENT
                            </span>
                          )}
                          {att.status === 'HALF_DAY' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              HALF DAY
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openDetailModal(att)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                          >
                            {isHR ? 'View / Edit' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={attendances.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Manual Attendance Entry</h2>
                <p className="text-xs text-slate-500">Record check-in/out for an employee.</p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee *</label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="LATE">LATE</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="HALF_DAY">HALF_DAY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Check In Time</label>
                  <input
                    type="time"
                    value={form.checkIn}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Check Out Time</label>
                  <input
                    type="time"
                    value={form.checkOut}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Overtime Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.overtimeHours}
                  onChange={(e) => setForm({ ...form, overtimeHours: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Remarks</label>
                <textarea
                  placeholder="Optional notes or reason for entry..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Detail View & HR Edit Modal */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Attendance Detail View</span>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedRecord.employee
                    ? `${selectedRecord.employee.firstName} ${selectedRecord.employee.lastName}`
                    : 'Employee Record'}
                </h2>
              </div>
              <button
                onClick={closeDetailModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Employee Info Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full text-white font-bold text-base flex items-center justify-center shadow-xs"
                style={{ backgroundColor: selectedRecord.employee?.color || '#6366f1' }}
              >
                {selectedRecord.employee?.firstName?.[0] || 'E'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">
                  {selectedRecord.employee?.firstName} {selectedRecord.employee?.lastName}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  #{selectedRecord.employee?.employeeNumber || 'N/A'} • {selectedRecord.employee?.jobTitle || 'Team Member'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Dept: <span className="font-semibold text-slate-700">{selectedRecord.employee?.department || 'General'}</span>
                  {selectedRecord.employee?.manager && (
                    <> • Manager: <span className="font-semibold text-slate-700">{selectedRecord.employee.manager.firstName} {selectedRecord.employee.manager.lastName}</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Attendance Status & Stats Summary */}
            <div className="grid grid-cols-2 gap-3 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 text-xs">
              <div>
                <span className="text-slate-500 block">Record Date</span>
                <span className="font-bold text-slate-800 text-sm">{formatDate(selectedRecord.date)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Current Status</span>
                <span className="font-bold text-indigo-700 text-sm">{selectedRecord.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Worked Duration</span>
                <span className="font-bold text-slate-800 text-sm">
                  {selectedRecord.workedHours != null ? `${selectedRecord.workedHours} hrs` : 'Active Session'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Overtime Hours</span>
                <span className="font-bold text-slate-800 text-sm">
                  {selectedRecord.overtimeHours ? `+${selectedRecord.overtimeHours} hrs` : '0 hrs'}
                </span>
              </div>
            </div>

            {/* View or Edit Toggle */}
            {!isEditing ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4 border border-slate-100 p-3 rounded-lg bg-slate-50/50">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Check In Timestamp</span>
                    <span className="font-semibold text-slate-800">{formatTime(selectedRecord.checkIn)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Check Out Timestamp</span>
                    <span className="font-semibold text-slate-800">{formatTime(selectedRecord.checkOut)}</span>
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block mb-1">Notes & Remarks</span>
                    <p className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 italic">
                      "{selectedRecord.notes}"
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  {isHR && (
                    <button
                      onClick={() => handleDeleteRecord(selectedRecord.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      🗑️ Delete Record
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={closeDetailModal}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                    {isHR && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      >
                        Edit Record
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* HR Edit Form */
              <form onSubmit={handleUpdateSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PRESENT">PRESENT</option>
                      <option value="LATE">LATE</option>
                      <option value="ABSENT">ABSENT</option>
                      <option value="HALF_DAY">HALF_DAY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Overtime Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={form.overtimeHours}
                      onChange={(e) => setForm({ ...form, overtimeHours: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Check In Time</label>
                    <input
                      type="time"
                      value={form.checkIn}
                      onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Check Out Time</label>
                    <input
                      type="time"
                      value={form.checkOut}
                      onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Remarks</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
