import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchAttendances,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  type AttendanceRecord,
} from '../api/attendance';
import { fetchEmployees, type Employee } from '../api/hr';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PRESENT: { label: 'Present', badge: 'bg-green-100 text-green-800 border-green-300' },
  LATE: { label: 'Late', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  HALF_DAY: { label: 'Half Day', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  ABSENT: { label: 'Absent', badge: 'bg-red-100 text-red-700 border-red-300' },
};

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function calculateWorkedHours(checkIn?: string | null, checkOut?: string | null): { hours: number; overtime: number } {
  if (!checkIn || !checkOut) return { hours: 0, overtime: 0 };
  const inTime = new Date(checkIn).getTime();
  const outTime = new Date(checkOut).getTime();
  const diffMs = outTime - inTime;
  if (diffMs <= 0) return { hours: 0, overtime: 0 };

  const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  const overtime = Math.max(0, Math.round((totalHours - 8) * 10) / 10);
  return { hours: totalHours, overtime };
}

export default function AttendancePage() {
  const [searchParams] = useSearchParams();
  const filterEmpId = searchParams.get('employeeId') || '';

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<string>(filterEmpId);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  // Form state
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formCheckIn, setFormCheckIn] = useState('09:00');
  const [formCheckOut, setFormCheckOut] = useState('18:00');
  const [formStatus, setFormStatus] = useState('PRESENT');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [attData, empData] = await Promise.all([
        fetchAttendances({
          employeeId: selectedEmp || undefined,
          status: selectedStatus || undefined,
          date: selectedDate || undefined,
        }),
        fetchEmployees(),
      ]);
      setRecords(attData);
      setEmployees(empData);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmp, selectedStatus, selectedDate]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormEmployeeId(employees[0]?.id || '');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCheckIn('09:00');
    setFormCheckOut('18:00');
    setFormStatus('PRESENT');
    setFormNotes('');
    setError('');
    setShowModal(true);
  };

  const openEditModal = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setFormEmployeeId(rec.employeeId);
    setFormDate(new Date(rec.date).toISOString().slice(0, 10));
    setFormCheckIn(rec.checkIn ? new Date(rec.checkIn).toTimeString().slice(0, 5) : '');
    setFormCheckOut(rec.checkOut ? new Date(rec.checkOut).toTimeString().slice(0, 5) : '');
    setFormStatus(rec.status);
    setFormNotes(rec.notes || '');
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formDate) {
      setError('Employee and Date are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const inDateTime = formCheckIn ? `${formDate}T${formCheckIn}:00` : null;
      const outDateTime = formCheckOut ? `${formDate}T${formCheckOut}:00` : null;

      if (editingRecord) {
        await updateAttendance(editingRecord.id, {
          checkIn: inDateTime,
          checkOut: outDateTime,
          status: formStatus,
          notes: formNotes || null,
        });
      } else {
        await createAttendance({
          employeeId: formEmployeeId,
          date: formDate,
          checkIn: inDateTime,
          checkOut: outDateTime,
          status: formStatus,
          notes: formNotes || null,
        });
      }

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save attendance record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await deleteAttendance(id);
      await loadData();
    } catch (err) {
      alert('Failed to delete record');
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track daily employee shifts, check-ins, overtime, and attendance corrections
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          + Record Attendance
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Filter Employee</label>
          <select
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
              </option>
            ))}
          </select>
        </div>

        <div className="w-48">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ABSENT">Absent</option>
          </select>
        </div>

        <div className="w-44">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {(selectedEmp || selectedStatus || selectedDate) && (
          <button
            onClick={() => {
              setSelectedEmp('');
              setSelectedStatus('');
              setSelectedDate('');
            }}
            className="mt-5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading attendance data...
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No attendance records found matching the criteria.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Employee', 'Date', 'Check In', 'Check Out', 'Worked Hours', 'Overtime', 'Status', 'Notes / Reason', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((rec) => {
                const { hours, overtime } = calculateWorkedHours(rec.checkIn, rec.checkOut);
                const statusMeta = STATUS_CONFIG[rec.status] || STATUS_CONFIG.PRESENT;

                return (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: rec.employee?.color || '#6366f1' }}
                        >
                          {rec.employee?.firstName?.[0]}
                          {rec.employee?.lastName?.[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : 'Unknown'}
                          </div>
                          <div className="text-xs text-slate-400">
                            #{rec.employee?.employeeNumber} · {rec.employee?.department || 'General'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 font-medium">
                      {new Date(rec.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {formatTime(rec.checkIn)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {formatTime(rec.checkOut)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-800 font-semibold">
                      {hours > 0 ? `${hours} hrs` : '—'}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {overtime > 0 ? (
                        <span className="text-amber-600 font-semibold">+{overtime} hrs</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 max-w-xs truncate" title={rec.notes || ''}>
                      {rec.notes || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditModal(rec)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editingRecord ? 'Edit Attendance & Correction' : 'Record Shift Attendance'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
                <select
                  disabled={!!editingRecord}
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check In</label>
                  <input
                    type="time"
                    value={formCheckIn}
                    onChange={(e) => setFormCheckIn(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check Out</label>
                  <input
                    type="time"
                    value={formCheckOut}
                    onChange={(e) => setFormCheckOut(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Attendance Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correction Reason / Shift Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Card missed check out, manager approved adjustment..."
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
