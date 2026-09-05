import { useState, useEffect } from 'react';
import { fetchAttendances, createAttendance, updateAttendance, fetchEmployees, type Attendance, type Employee } from '../api/hr';
import AttendanceToggleWidget from '../components/AttendanceToggleWidget';

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);

  const [form, setForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    checkIn: '',
    checkOut: '',
    status: 'PRESENT',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [atts, emps] = await Promise.all([
        fetchAttendances({ search }),
        fetchEmployees(),
      ]);
      setAttendances(atts);
      setEmployees(emps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAttendance) {
        await updateAttendance(editingAttendance.id, form);
      } else {
        await createAttendance(form);
      }
      setShowModal(false);
      setEditingAttendance(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save attendance record');
    }
  };

  const openCreate = () => {
    setEditingAttendance(null);
    setForm({
      employeeId: employees[0]?.id || '',
      date: new Date().toISOString().slice(0, 10),
      checkIn: '',
      checkOut: '',
      status: 'PRESENT',
      notes: '',
    });
    setShowModal(true);
  };

  const openEdit = (att: Attendance) => {
    setEditingAttendance(att);
    setForm({
      employeeId: att.employeeId,
      date: att.date ? att.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      checkIn: att.checkIn ? new Date(att.checkIn).toISOString().slice(11, 16) : '',
      checkOut: att.checkOut ? new Date(att.checkOut).toISOString().slice(11, 16) : '',
      status: att.status,
      notes: att.notes || '',
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
          <p className="text-sm text-slate-500">Track check-ins, check-outs, and total worked hours.</p>
        </div>
        <div className="flex items-center gap-3">
          <AttendanceToggleWidget compact />
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
          >
            + Manual Entry
          </button>
        </div>
      </div>

      {/* Elasticsearch Input Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="text-indigo-600 font-semibold text-xs uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
          <span>🔍</span> Elasticsearch
        </div>
        <input
          type="text"
          placeholder="Search by employee name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-slate-500">Loading attendance logs...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Employee</th>
                <th className="px-6 py-3 text-left font-medium">Date</th>
                <th className="px-6 py-3 text-left font-medium">Check In</th>
                <th className="px-6 py-3 text-left font-medium">Check Out</th>
                <th className="px-6 py-3 text-left font-medium">Worked Hours</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
                <th className="px-6 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                attendances.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center"
                          style={{ backgroundColor: att.employee?.color || '#6366f1' }}
                        >
                          {att.employee?.firstName?.[0]}
                        </div>
                        <span className="font-medium text-slate-800">
                          {att.employee ? `${att.employee.firstName} ${att.employee.lastName}` : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{new Date(att.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium">Active Session</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {att.workedHours != null ? `${att.workedHours} hrs` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {att.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(att)}
                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">
              {editingAttendance ? 'Edit Attendance Record' : 'Manual Attendance Entry'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employee</label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} (#{emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="HALF_DAY">HALF_DAY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Check In Time</label>
                  <input
                    type="time"
                    value={form.checkIn}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Check Out Time</label>
                  <input
                    type="time"
                    value={form.checkOut}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
