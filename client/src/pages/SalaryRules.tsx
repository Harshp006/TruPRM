import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSalaryRules, type SalaryRule } from '../api/payroll';

export default function SalaryRulesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSalaryRules();
      setRules(data);
    } catch (err) {
      console.error('Failed to load salary rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = rules.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.salaryStructure?.name && r.salaryStructure.name.toLowerCase().includes(search.toLowerCase()));
    const matchCategory = !filterCategory || r.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salary Rules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Global salary calculation components, percentage computations, and statutory deductions
          </p>
        </div>
        {canEdit && (
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition">
            + New Rule
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4 flex-1 max-w-xl">
          <input
            type="text"
            placeholder="Search rules by name, code, or structure..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-48 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="BASIC">Basic</option>
            <option value="ALLOWANCE">Allowance</option>
            <option value="DEDUCTION">Deduction</option>
            <option value="GROSS">Gross</option>
            <option value="NET">Net</option>
          </select>
        </div>
        <span className="text-xs text-slate-400">
          {!canEdit ? 'Read-only view for HR Payroll User' : 'Edit Mode'}
        </span>
      </div>

      {/* Rules Table */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading salary rules...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No salary rules found matching search criteria.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Seq', 'Rule Name', 'Code', 'Category', 'Structure', 'Calculation Type', 'Rate / Amount', 'Payslip Visible'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-4 font-mono text-xs text-slate-400 font-bold">{r.sequence}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{r.name}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-indigo-600">{r.code}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                        r.category === 'BASIC'
                          ? 'bg-blue-100 text-blue-800'
                          : r.category === 'ALLOWANCE'
                          ? 'bg-green-100 text-green-800'
                          : r.category === 'DEDUCTION'
                          ? 'bg-red-100 text-red-800'
                          : r.category === 'GROSS'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {r.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600 font-medium">
                    {r.salaryStructure?.name || 'Standard'}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-600">
                    {r.amountPercentage ? (
                      <span>Percentage of {r.baseCode || 'Wage'}</span>
                    ) : r.amountFixed ? (
                      <span>Fixed Amount</span>
                    ) : (
                      <span>Calculated Summary</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-800">
                    {r.amountPercentage
                      ? `${Number(r.amountPercentage) * 100}%`
                      : r.amountFixed
                      ? `$${Number(r.amountFixed).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    {r.appears_on_payslip ? (
                      <span className="text-green-600 font-medium text-xs">● Yes</span>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">○ Hidden</span>
                    )}
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
