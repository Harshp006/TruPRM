import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchEmployees, createEmployee, updateEmployee, fetchSchedules,
  type Employee, type WorkingSchedule
} from '../api/hr';
import { fetchUsers, type User } from '../api/users';

import AttendanceToggleWidget from '../components/AttendanceToggleWidget';

const DEPT_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444'];

function KanbanCard({ emp, onClick }: { emp: Employee; onClick: () => void }) {
  const color = emp.color || '#6366f1';
  const activeContract = emp.contracts?.find(c => c.status === 'ACTIVE');
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="font-medium text-slate-800 text-sm">{emp.firstName} {emp.lastName}</div>
      <div className="text-xs text-slate-500 mt-1">{emp.jobTitle}</div>
      {activeContract && (
        <div className="text-xs text-green-600 mt-1 font-medium">● Active Contract</div>
      )}
      <div className="text-xs text-slate-400 mt-1">#{emp.employeeNumber}</div>
    </div>
  );
}

function SmartButton({ label, count, onClick }: { label: string; count: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm cursor-pointer"
    >
      <span className="text-sm text-slate-600">{label}</span>
      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
    </button>
  );
}

function EmployeeForm({
  initial,
  employees,
  users,
  onSave,
  onCancel,
}: {
  initial: Partial<Employee> | null;
  employees: Employee[];
  users: User[];
  onSave: (data: Partial<Employee>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>(initial ?? {
    employeeNumber: '', firstName: '', lastName: '', jobTitle: '',
    department: '', hireDate: new Date().toISOString().slice(0, 10),
    color: '#6366f1',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Employee, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const managersOptions = employees.filter(e => e.id !== (initial as any)?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Attendance Check-in/out Toggle Widget on Employee Form */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Check-in / Check-out</label>
        <AttendanceToggleWidget />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
          <input required value={form.firstName || ''} onChange={e => set('firstName', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
          <input required value={form.lastName || ''} onChange={e => set('lastName', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Employee # *</label>
          <input required value={form.employeeNumber || ''} onChange={e => set('employeeNumber', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
          <input required value={form.jobTitle || ''} onChange={e => set('jobTitle', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
          <input value={form.department || ''} onChange={e => set('department', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date *</label>
          <input required type="date" value={form.hireDate?.slice(0, 10) || ''} onChange={e => set('hireDate', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
          <input type="date" value={form.dateOfBirth?.slice(0, 10) || ''} onChange={e => set('dateOfBirth', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Manager</label>
          <select value={form.managerId || ''} onChange={e => set('managerId', e.target.value || null)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— None —</option>
            {managersOptions.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Linked User Account</label>
          <select value={form.userId || ''} onChange={e => set('userId', e.target.value || null)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— None —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
          <input type="color" value={form.color || '#6366f1'} onChange={e => set('color', e.target.value)}
            className="h-10 w-full rounded border border-slate-300 cursor-pointer" />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  const load = async () => {
    setLoading(true);
    const [emps, usrs, scheds] = await Promise.all([fetchEmployees(), fetchUsers(), fetchSchedules()]);
    setEmployees(emps);
    setUsers(usrs);
    setSchedules(scheds);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Partial<Employee>) => {
    if (selectedEmployee) {
      await updateEmployee(selectedEmployee.id, data);
    } else {
      await createEmployee(data);
    }
    await load();
    setShowForm(false);
    setSelectedEmployee(null);
  };

  const openEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDetailEmployee(null);
    setShowForm(true);
  };

  const openCreate = () => {
    setSelectedEmployee(null);
    setShowForm(true);
  };

  const [search, setSearch] = useState('');

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    e.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
    (e.department && e.department.toLowerCase().includes(search.toLowerCase())) ||
    e.employeeNumber.toLowerCase().includes(search.toLowerCase())
  );

  // Group employees by department for kanban
  const departments = [...new Set(filteredEmployees.map(e => e.department || 'Unassigned'))];

  const closeDetail = () => setDetailEmployee(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button onClick={() => setView('list')}
              className={`px-4 py-2 text-sm ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              List
            </button>
            <button onClick={() => setView('kanban')}
              className={`px-4 py-2 text-sm ${view === 'kanban' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Kanban
            </button>
          </div>
          <button onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + New Employee
          </button>
        </div>
      </div>

      {/* Elasticsearch Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="text-indigo-600 font-semibold text-xs uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
          <span>🔍</span> Elasticsearch
        </div>
        <input
          type="text"
          placeholder="Search employees by name, title, department, or employee #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Employee Detail Panel */}
      {detailEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50">
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    {detailEmployee.firstName} {detailEmployee.lastName}
                  </h2>
                  <p className="text-slate-500 text-sm">{detailEmployee.jobTitle} · #{detailEmployee.employeeNumber}</p>
                </div>
                <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
              </div>

              {/* Smart Buttons */}
              <div className="flex flex-wrap gap-2 mb-6">
                <SmartButton
                  label="Contracts"
                  count={detailEmployee._count?.contracts ?? 0}
                  onClick={() => navigate(`/contracts?employeeId=${detailEmployee.id}`)}
                />
                <SmartButton
                  label="Attendance"
                  count={detailEmployee._count?.attendances ?? 0}
                  onClick={() => navigate(`/attendance?employeeId=${detailEmployee.id}`)}
                />
                <SmartButton
                  label="Time Off"
                  count={detailEmployee._count?.timeOffRequests ?? 0}
                  onClick={() => navigate(`/timeoff?employeeId=${detailEmployee.id}`)}
                />
              </div>

              {/* Live Attendance Widget */}
              <div className="mb-6">
                <AttendanceToggleWidget />
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <span className="text-slate-500">Department</span>
                  <p className="font-medium">{detailEmployee.department || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Manager</span>
                  <p className="font-medium">
                    {detailEmployee.manager ? `${detailEmployee.manager.firstName} ${detailEmployee.manager.lastName}` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Hire Date</span>
                  <p className="font-medium">{new Date(detailEmployee.hireDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-slate-500">Date of Birth</span>
                  <p className="font-medium">{detailEmployee.dateOfBirth ? new Date(detailEmployee.dateOfBirth).toLocaleDateString() : '—'}</p>
                </div>
                {detailEmployee.user && (
                  <>
                    <div>
                      <span className="text-slate-500">Login Email</span>
                      <p className="font-medium">{detailEmployee.user.email}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Role</span>
                      <p className="font-medium">{detailEmployee.user.role}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Active Contract */}
              {detailEmployee.contracts && detailEmployee.contracts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Contracts</h3>
                  <div className="space-y-2">
                    {detailEmployee.contracts.map(c => (
                      <div key={c.id}
                        className={`p-3 rounded-lg border text-sm ${c.status === 'ACTIVE' ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.contractType}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1">
                          {c.wageCurrency} {Number(c.wageAmount).toLocaleString()} ·{' '}
                          {new Date(c.startDate).toLocaleDateString()} – {c.endDate ? new Date(c.endDate).toLocaleDateString() : 'Ongoing'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => { closeDetail(); openEdit(detailEmployee); }}
                className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Edit Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-2xl mx-4">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              {selectedEmployee ? 'Edit Employee' : 'New Employee'}
            </h2>
            <EmployeeForm
              initial={selectedEmployee}
              employees={employees}
              users={users}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setSelectedEmployee(null); }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : view === 'list' ? (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['#', 'Name', 'Job Title', 'Department', 'Manager', 'Hire Date', 'Contracts', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDetailEmployee(emp)}>
                  <td className="px-6 py-4 text-sm text-slate-500">{emp.employeeNumber}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: emp.color || '#6366f1' }}>
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800 text-sm">{emp.firstName} {emp.lastName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.jobTitle}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.department || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(emp.hireDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {emp._count?.contracts ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button onClick={e => { e.stopPropagation(); openEdit(emp); }}
                      className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Kanban View
        <div className="flex gap-4 overflow-x-auto pb-4">
          {departments.map(dept => {
            const deptEmployees = employees.filter(e => (e.department || 'Unassigned') === dept);
            return (
              <div key={dept} className="flex-shrink-0 w-64">
                <div className="font-semibold text-slate-700 mb-3 px-1">{dept}
                  <span className="ml-2 text-xs font-normal text-slate-400">({deptEmployees.length})</span>
                </div>
                <div className="space-y-2">
                  {deptEmployees.map(emp => (
                    <KanbanCard key={emp.id} emp={emp} onClick={() => setDetailEmployee(emp)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
