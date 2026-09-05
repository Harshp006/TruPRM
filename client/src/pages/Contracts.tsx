import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchContracts, createContract, updateContract, fetchEmployees, fetchSchedules,
  type Contract, type Employee, type WorkingSchedule,
} from '../api/hr';

const CONTRACT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN'];
const CONTRACT_STATUSES = ['ACTIVE', 'EXPIRED', 'TERMINATED'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

const statusColor: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-300',
  EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
  TERMINATED: 'bg-red-100 text-red-700 border-red-300',
};

function ContractForm({
  initial,
  employees,
  schedules,
  readOnly = false,
  onSave,
  onCancel,
}: {
  initial: Contract | null;
  employees: Employee[];
  schedules: WorkingSchedule[];
  readOnly?: boolean;
  onSave: (data: Partial<Contract>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Contract>>(initial ?? {
    contractType: 'FULL_TIME',
    status: 'ACTIVE',
    wageCurrency: 'USD',
    wageAmount: '',
    startDate: new Date().toISOString().slice(0, 10),
  } as any);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Contract, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
          <select
            disabled={readOnly}
            required
            value={form.employeeId || ''}
            onChange={e => set('employeeId', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            <option value="">— Select Employee —</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} (#{emp.employeeNumber})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contract Type</label>
          <select
            disabled={readOnly}
            value={form.contractType || 'FULL_TIME'}
            onChange={e => set('contractType', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select
            disabled={readOnly}
            value={form.status || 'ACTIVE'}
            onChange={e => set('status', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
          <input
            disabled={readOnly}
            required
            type="date"
            value={form.startDate?.slice(0, 10) || ''}
            onChange={e => set('startDate', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
          <input
            disabled={readOnly}
            type="date"
            value={form.endDate?.slice(0, 10) || ''}
            onChange={e => set('endDate', e.target.value || null)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
          <select
            disabled={readOnly}
            value={form.wageCurrency || 'USD'}
            onChange={e => set('wageCurrency', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Wage Amount *</label>
          <input
            disabled={readOnly}
            required
            type="number"
            step="0.01"
            min="0"
            value={form.wageAmount ?? ''}
            onChange={e => set('wageAmount', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Working Schedule</label>
          <select
            disabled={readOnly}
            value={form.workingScheduleId || ''}
            onChange={e => set('workingScheduleId', e.target.value || null)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100">
            <option value="">— None (Default 40h) —</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.hoursPerWeek}h/wk)</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            disabled={readOnly}
            rows={2}
            value={form.notes || ''}
            onChange={e => set('notes', e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100" />
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3 pt-2">
        {!readOnly && (
          <button type="submit" disabled={saving}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Contract'}
          </button>
        )}
        <button type="button" onClick={onCancel}
          className={`${readOnly ? 'w-full' : 'flex-1'} px-4 py-2 border border-slate-300 rounded hover:bg-slate-50`}>
          {readOnly ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

export default function ContractsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';
  const [searchParams] = useSearchParams();
  const filterEmployeeId = searchParams.get('employeeId');

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);

  const load = async () => {
    setLoading(true);
    const [c, e, s] = await Promise.all([fetchContracts(), fetchEmployees(), fetchSchedules()]);
    setContracts(c);
    setEmployees(e);
    setSchedules(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Partial<Contract>) => {
    if (editContract) {
      await updateContract(editContract.id, data);
    } else {
      await createContract(data);
    }
    await load();
    setShowForm(false);
    setEditContract(null);
  };

  const [search, setSearch] = useState('');

  let filteredContracts = filterEmployeeId
    ? contracts.filter(c => c.employeeId === filterEmployeeId)
    : contracts;

  if (search) {
    const q = search.toLowerCase();
    filteredContracts = filteredContracts.filter(c =>
      (c.employee && `${c.employee.firstName} ${c.employee.lastName}`.toLowerCase().includes(q)) ||
      c.contractType.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q) ||
      (c.workingSchedule && c.workingSchedule.name.toLowerCase().includes(q))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contracts</h1>
          {filterEmployeeId && (
            <p className="text-sm text-slate-500 mt-1">
              Filtered by employee ·{' '}
              <a href="/contracts" className="text-indigo-600 hover:underline">Clear filter</a>
            </p>
          )}
        </div>
        {canEdit && (
          <button onClick={() => { setEditContract(null); setShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            + New Contract
          </button>
        )}
      </div>

      {/* Elasticsearch Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="text-indigo-600 font-semibold text-xs uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
          <span>🔍</span> Elasticsearch
        </div>
        <input
          type="text"
          placeholder="Search contracts by employee name, type, status, or schedule..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-2xl mx-4">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              {canEdit ? (editContract ? 'Edit Contract' : 'New Contract') : 'Contract Details'}
            </h2>
            <ContractForm
              initial={editContract}
              employees={employees}
              schedules={schedules}
              readOnly={!canEdit}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditContract(null); }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading contracts...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Employee', 'Type', 'Status', 'Start Date', 'End Date', 'Wage', 'Schedule', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">No contracts found.</td>
                </tr>
              ) : (
                filteredContracts.map(c => (
                  <tr key={c.id}
                    className={`hover:bg-slate-50 ${c.status === 'ACTIVE' ? 'bg-green-50/50' : ''}`}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : '—'}
                      {c.employee && <div className="text-xs text-slate-400">#{c.employee.employeeNumber}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{c.contractType.replace('_', ' ')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColor[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(c.startDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {c.endDate ? new Date(c.endDate).toLocaleDateString() : 'Ongoing'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                      {c.wageCurrency} {Number(c.wageAmount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {c.workingSchedule?.name || 'Standard 40h'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => { setEditContract(c); setShowForm(true); }}
                        className="text-indigo-600 hover:text-indigo-800 font-medium">
                        {canEdit ? 'Edit' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
