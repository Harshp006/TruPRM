import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchSalaryRules, type SalaryRule } from '../api/payroll';
import { SearchFilterBar, EmptyState } from '../components/SearchFilterBar';

export default function SalaryRulesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortOption, setSortOption] = useState('SEQ_ASC');

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

  const filtered = useMemo(() => {
    let result = rules.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        (r.salaryStructure?.name && r.salaryStructure.name.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = filterCategory === 'ALL' || !filterCategory || r.category === filterCategory;
      return matchSearch && matchCategory;
    });

    result.sort((a, b) => {
      if (sortOption === 'SEQ_ASC') return (a.sequence || 0) - (b.sequence || 0);
      if (sortOption === 'SEQ_DESC') return (b.sequence || 0) - (a.sequence || 0);
      if (sortOption === 'NAME_ASC') return a.name.localeCompare(b.name);
      if (sortOption === 'NAME_DESC') return b.name.localeCompare(a.name);
      return 0;
    });

    return result;
  }, [rules, search, filterCategory, sortOption]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; value: string; onClear: () => void }> = [];
    if (filterCategory !== 'ALL' && filterCategory !== '') {
      chips.push({
        label: `Category: ${filterCategory}`,
        value: filterCategory,
        onClear: () => setFilterCategory('ALL'),
      });
    }
    return chips;
  }, [filterCategory]);

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

      {!canEdit && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-between">
          <span>🔒 Read-Only Access: Salary rules configuration is strictly managed by HR Payroll Manager.</span>
        </div>
      )}

      {/* Filter Bar */}
      <SearchFilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search rules by name, code, or structure..."
        filters={[
          {
            key: 'category',
            label: 'Category',
            value: filterCategory,
            options: [
              { label: 'All Categories', value: 'ALL' },
              { label: 'Basic', value: 'BASIC' },
              { label: 'Allowance', value: 'ALLOWANCE' },
              { label: 'Deduction', value: 'DEDUCTION' },
              { label: 'Gross', value: 'GROSS' },
              { label: 'Net', value: 'NET' },
            ],
            onChange: setFilterCategory,
          },
        ]}
        sortOption={sortOption}
        onSortChange={setSortOption}
        sortOptions={[
          { label: 'Sequence (Low to High)', value: 'SEQ_ASC' },
          { label: 'Sequence (High to Low)', value: 'SEQ_DESC' },
          { label: 'Name (A - Z)', value: 'NAME_ASC' },
          { label: 'Name (Z - A)', value: 'NAME_DESC' },
        ]}
        activeFilterChips={activeFilterChips}
        onClearAll={() => {
          setSearch('');
          setFilterCategory('ALL');
        }}
        resultsCount={filtered.length}
        totalCount={rules.length}
        unitName="rules"
      />

      {/* Rules Table */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading salary rules...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No salary rules found"
          description={
            search || filterCategory !== 'ALL'
              ? 'No rules match your selected filters. Try clearing or adjusting search terms.'
              : 'No salary rules are available.'
          }
          hasActiveFilters={Boolean(search || filterCategory !== 'ALL')}
          onClearFilters={() => {
            setSearch('');
            setFilterCategory('ALL');
          }}
        />
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
                      ? `₹${Number(r.amountFixed).toLocaleString('en-IN')}`
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
