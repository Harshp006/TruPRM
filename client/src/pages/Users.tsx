import { useState, useEffect } from 'react';
import { fetchUsers, createUser, updateUser, resetPassword, type User } from '../api/users';
import { fetchEmployees, type Employee } from '../api/hr';

const ROLES = ['EMPLOYEE', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'] as const;

const roleBadgeColor: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  HR_MANAGER: 'bg-purple-100 text-purple-800',
  HR_PAYROLL_ADMIN: 'bg-orange-100 text-orange-800',
  HR_PAYROLL_USER: 'bg-blue-100 text-blue-800',
  EMPLOYEE: 'bg-green-100 text-green-800',
};

interface TempInfo {
  userId: string;
  email: string;
  tempPassword: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [tempInfo, setTempInfo] = useState<TempInfo | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ email: '', role: 'EMPLOYEE', employeeId: '' });

  const load = async () => {
    setLoading(true);
    const [u, e] = await Promise.all([fetchUsers(), fetchEmployees()]);
    setUsers(u);
    setEmployees(e);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: '', role: 'EMPLOYEE', employeeId: '' });
    setError('');
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ email: u.email, role: u.role, employeeId: u.employee?.id || '' });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editUser) {
        await updateUser(editUser.id, {
          role: form.role,
          employeeId: form.employeeId || null,
        });
        await load();
        setShowForm(false);
      } else {
        const res = await createUser({
          email: form.email,
          role: form.role,
          employeeId: form.employeeId || undefined,
        });
        setTempInfo({ userId: res.user.id, email: form.email, tempPassword: res.tempPassword });
        setShowForm(false);
        await load();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    }
  };

  const handleResetPassword = async (u: User) => {
    if (!confirm(`Reset password for ${u.email}?`)) return;
    try {
      const res = await resetPassword(u.id);
      setTempInfo({ userId: u.id, email: u.email, tempPassword: res.tempPassword });
    } catch (err: any) {
      alert(err.response?.data?.message || 'An error occurred');
    }
  };

  // Employees not yet linked to a user (exclude current edit user's employee)
  const unlinkedEmployees = employees.filter(emp => {
    if (!emp.userId) return true;
    // Allow showing the employee already linked to editUser
    if (editUser?.employee?.id === emp.id) return true;
    return false;
  });

  const [search, setSearch] = useState('');

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase()) ||
    (u.employee && `${u.employee.firstName} ${u.employee.lastName}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Users</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          + New User
        </button>
      </div>

      {/* Elasticsearch Search Input */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="text-indigo-600 font-semibold text-xs uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
          <span>🔍</span> Elasticsearch
        </div>
        <input
          type="text"
          placeholder="Search users by email, role, or employee name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Temp Password Modal */}
      {tempInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-2 text-slate-800">Temporary Password</h2>
            <p className="text-slate-600 mb-4">Share these credentials with <strong>{tempInfo.email}</strong>. They will be prompted to change their password on first login.</p>
            <div className="bg-slate-100 rounded p-3 font-mono text-sm text-slate-800 mb-4 select-all">
              {tempInfo.tempPassword}
            </div>
            <button
              onClick={() => setTempInfo(null)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              {editUser ? 'Edit User' : 'Create User'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link to Employee (optional)</label>
                <select
                  value={form.employeeId}
                  onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— None —</option>
                  {unlinkedEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  {editUser ? 'Save' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Email', 'Role', 'Employee', 'Must Change Pwd', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-800">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadgeColor[u.role] || 'bg-slate-100 text-slate-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {u.mustChangePassword ? (
                      <span className="text-amber-600 font-medium">⚠ Yes</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleResetPassword(u)}
                      className="text-amber-600 hover:text-amber-800 font-medium"
                    >
                      Reset Pwd
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
