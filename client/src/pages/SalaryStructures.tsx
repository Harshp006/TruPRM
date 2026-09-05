import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchSalaryStructures,
  fetchSalaryStructure,
  type SalaryStructure,
} from '../api/payroll';

export default function SalaryStructuresPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchSalaryStructures();
      setStructures(data);
    } catch (err) {
      console.error('Failed to load salary structures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDetail = async (s: SalaryStructure) => {
    try {
      const full = await fetchSalaryStructure(s.id);
      setSelectedStructure(full);
    } catch (err) {
      setSelectedStructure(s);
    }
  };

  const filtered = structures.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salary Structures</h1>
          <p className="text-sm text-slate-500 mt-1">
            Standard compensation models and associated computation rule sets
          </p>
        </div>
        {canEdit && (
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition">
            + New Structure
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <input
          type="text"
          placeholder="Search salary structures by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <div className="text-xs text-slate-400">
          {!canEdit ? 'View-Only Mode for HR Payroll User' : 'Admin & Manager Mode'}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading salary structures...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No salary structures found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-slate-800 text-lg">{s.name}</h3>
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-mono font-bold rounded">
                    {s.code}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                  {s.description || 'Standard salary structure definition'}
                </p>
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1.5 mb-4">
                  <div className="flex justify-between">
                    <span>Rules Configured:</span>
                    <strong className="text-slate-800">{s.rules?.length ?? s._count?.rules ?? 0} rules</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Assigned Contracts:</span>
                    <strong className="text-slate-800">{s._count?.contracts ?? 0} contracts</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openDetail(s)}
                className="w-full py-2 bg-slate-100 hover:bg-indigo-50 text-indigo-700 font-medium text-sm rounded-lg transition"
              >
                Inspect Salary Rules & Detail →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedStructure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800">{selectedStructure.name}</h2>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 font-mono text-xs font-bold rounded">
                    {selectedStructure.code}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedStructure.description || 'Full salary breakdown rules sequence'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStructure(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Associated Salary Rules</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Seq</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Rule Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Calculation Type</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Rate/Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {selectedStructure.rules && selectedStructure.rules.length > 0 ? (
                      selectedStructure.rules.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.sequence}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-bold">{r.code}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                              {r.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {r.amountPercentage ? (
                              <span>Percentage ({Number(r.amountPercentage) * 100}% of {r.baseCode || 'Wage'})</span>
                            ) : r.amountFixed ? (
                              <span>Fixed Amount</span>
                            ) : (
                              <span>Formula/Base</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {r.amountPercentage
                              ? `${Number(r.amountPercentage) * 100}%`
                              : r.amountFixed
                              ? `$${Number(r.amountFixed).toLocaleString()}`
                              : '100%'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                          No salary rules configured.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedStructure(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
