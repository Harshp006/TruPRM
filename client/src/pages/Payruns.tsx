import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SearchFilterBar, EmptyState } from '../components/SearchFilterBar';

interface Payrun {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  state: 'DRAFT' | 'DONE' | 'CANCELLED';
  notes?: string;
  createdAt: string;
  totalGross?: number;
  totalNet?: number;
  _count?: {
    payslips?: number;
  };
  payslips?: Array<{
    id: string;
    employeeId: string;
    basicWage: number;
    grossWage?: number;
    netWage?: number;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNumber: string;
      department?: string;
    };
    salaryStructure?: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

interface ValidationWarning {
  employeeId: string;
  employeeName: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

const Payruns: React.FC = () => {
  const { user, token } = useAuth();
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('PERIOD_DESC');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPayrun, setSelectedPayrun] = useState<Payrun | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Validation State
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    warnings: ValidationWarning[];
  } | null>(null);

  // Computing State
  const [computing, setComputing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Role permissions
  const isHRUser = user?.role === 'HR_PAYROLL_USER' || user?.role === 'ADMIN';
  const isHRManagerViewOnly = user?.role === 'HR_PAYROLL_ADMIN' || user?.role === 'HR_MANAGER';

  const fetchPayruns = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/payruns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayruns(data);
      }
    } catch (err) {
      console.error('Error fetching payruns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPayruns();
    }
  }, [token]);

  const fetchPayrunDetail = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/payruns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPayrun(data);
      }
    } catch (err) {
      console.error('Error fetching payrun detail:', err);
    }
  };

  const handleOpenDetail = (pr: Payrun) => {
    setSelectedPayrun(pr);
    setValidationResult(null);
    setActionSuccess('');
    setIsDetailOpen(true);
    fetchPayrunDetail(pr.id);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName || !formPeriodStart || !formPeriodEnd) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      setFormSubmitting(true);
      const res = await fetch('http://localhost:5000/api/payruns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          periodStart: formPeriodStart,
          periodEnd: formPeriodEnd,
          notes: formNotes,
        }),
      });

      if (res.ok) {
        const newPr = await res.json();
        setIsCreateOpen(false);
        setFormName('');
        setFormPeriodStart('');
        setFormPeriodEnd('');
        setFormNotes('');
        fetchPayruns();
        handleOpenDetail(newPr);
      } else {
        const errData = await res.json();
        setFormError(errData.message || 'Failed to create pay run.');
      }
    } catch (err) {
      setFormError('Network error while creating pay run.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedPayrun || !isHRUser) return;
    try {
      setValidating(true);
      setActionSuccess('');
      const res = await fetch(`http://localhost:5000/api/payruns/${selectedPayrun.id}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
      }
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleCompute = async () => {
    if (!selectedPayrun || !isHRUser) return;
    try {
      setComputing(true);
      setActionSuccess('');
      const res = await fetch(`http://localhost:5000/api/payruns/${selectedPayrun.id}/compute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedPayrun(updated);
        setActionSuccess('Payroll successfully computed for all employees!');
        fetchPayruns();
      }
    } catch (err) {
      console.error('Compute error:', err);
    } finally {
      setComputing(false);
    }
  };

  const handleStateChange = async (newState: 'DRAFT' | 'DONE' | 'CANCELLED') => {
    if (!selectedPayrun || !isHRUser) return;
    try {
      const res = await fetch(`http://localhost:5000/api/payruns/${selectedPayrun.id}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state: newState }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedPayrun(updated);
        setActionSuccess(`Pay Run state updated to ${newState}`);
        fetchPayruns();
      }
    } catch (err) {
      console.error('State change error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isHRUser) return;
    if (!window.confirm('Are you sure you want to delete this Pay Run?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/payruns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchPayruns();
        if (selectedPayrun?.id === id) {
          setIsDetailOpen(false);
        }
      }
    } catch (err) {
      console.error('Delete payrun error:', err);
    }
  };

  // Search & Filter computation
  const filteredPayruns = useMemo(() => {
    const now = new Date();
    let result = payruns.filter((pr) => {
      // 1. Search Query: Pay Run Name, ID, or employee names inside payslips
      const q = search.toLowerCase().trim();
      const matchesName = pr.name.toLowerCase().includes(q) || pr.id.toLowerCase().includes(q);
      const matchesEmployeeInPayrun = pr.payslips?.some(p =>
        `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase().includes(q) ||
        p.employee.employeeNumber.toLowerCase().includes(q)
      );
      const matchesSearch = !q || matchesName || matchesEmployeeInPayrun;

      // 2. State Filter
      const matchesState = stateFilter === 'ALL' || pr.state === stateFilter;

      // 3. Period Filter
      let matchesPeriod = true;
      if (periodFilter === 'CURRENT_MONTH') {
        const d = new Date(pr.periodStart);
        matchesPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (periodFilter === 'PREVIOUS_MONTH') {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const d = new Date(pr.periodStart);
        matchesPeriod = d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear();
      }

      return matchesSearch && matchesState && matchesPeriod;
    });

    // Sort Options
    result.sort((a, b) => {
      if (sortOption === 'PERIOD_DESC') {
        return new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime();
      } else if (sortOption === 'NAME_ASC') {
        return a.name.localeCompare(b.name);
      } else if (sortOption === 'TOTAL_DESC') {
        return (b.totalNet || 0) - (a.totalNet || 0);
      }
      return 0;
    });

    return result;
  }, [payruns, search, stateFilter, periodFilter, sortOption]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; value: string; onClear: () => void }> = [];
    if (stateFilter !== 'ALL') chips.push({ label: 'Status', value: stateFilter, onClear: () => setStateFilter('ALL') });
    if (periodFilter !== 'ALL') chips.push({ label: 'Period', value: periodFilter.replace('_', ' '), onClear: () => setPeriodFilter('ALL') });
    return chips;
  }, [stateFilter, periodFilter]);

  const handleClearAllFilters = () => {
    setSearch('');
    setStateFilter('ALL');
    setPeriodFilter('ALL');
    setSortOption('PERIOD_DESC');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pay Runs</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isHRUser
              ? 'Create, validate, compute, and approve monthly employee payroll runs.'
              : 'Read-only view of processed pay runs and finalized employee payslips.'}
          </p>
        </div>

        {/* Read-Only Badge for HR Payroll Manager */}
        {isHRManagerViewOnly && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold shadow-2xs">
            <span>🔒</span> HR Manager Read-Only Access
          </div>
        )}

        {isHRUser && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition"
          >
            <span>+ Create Pay Run</span>
          </button>
        )}
      </div>

      {/* Unified Search & Filter Control Bar */}
      <SearchFilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search pay runs by name, period, or employee #..."
        filters={[
          {
            key: 'state',
            label: 'Status',
            value: stateFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Done (Approved)', value: 'DONE' },
              { label: 'Cancelled', value: 'CANCELLED' },
            ],
            onChange: setStateFilter,
          },
          {
            key: 'period',
            label: 'Payroll Period',
            value: periodFilter,
            options: [
              { label: 'All Periods', value: 'ALL' },
              { label: 'Current Month', value: 'CURRENT_MONTH' },
              { label: 'Previous Month', value: 'PREVIOUS_MONTH' },
            ],
            onChange: setPeriodFilter,
          },
        ]}
        sortOption={sortOption}
        onSortChange={setSortOption}
        sortOptions={[
          { label: 'Sort: Period (Newest)', value: 'PERIOD_DESC' },
          { label: 'Sort: Name (A-Z)', value: 'NAME_ASC' },
          { label: 'Sort: Total Net Pay', value: 'TOTAL_DESC' },
        ]}
        activeFilterChips={activeFilterChips}
        onClearAll={handleClearAllFilters}
        resultsCount={filteredPayruns.length}
        totalCount={payruns.length}
        unitName="pay runs"
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm font-medium">Loading pay runs...</p>
          </div>
        ) : filteredPayruns.length === 0 ? (
          <EmptyState
            title="No Pay Runs Found"
            description="No pay runs match your search query or selected status filter."
            hasActiveFilters={search.trim() !== '' || activeFilterChips.length > 0}
            onClearFilters={handleClearAllFilters}
          />
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Pay Run Name</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-center">Employees</th>
                <th className="py-3.5 px-4">Total Net Pay</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPayruns.map((pr) => (
                <tr key={pr.id} className="hover:bg-indigo-50/40 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {pr.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(pr.periodStart).toLocaleDateString()} -{' '}
                    {new Date(pr.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {pr.payslips?.length ?? pr._count?.payslips ?? 0}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-900">
                    ₹{pr.totalNet ? pr.totalNet.toLocaleString() : '0'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        pr.state === 'DONE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : pr.state === 'DRAFT'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {pr.state}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenDetail(pr)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition"
                    >
                      <span>{isHRUser ? 'Manage & Compute' : 'View Pay Run Details'}</span>
                    </button>
                    {isHRUser && pr.state === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(pr.id)}
                        className="inline-flex items-center p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition"
                        title="Delete Pay Run"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal (Exposed ONLY to HR Payroll User / Admin) */}
      {isCreateOpen && isHRUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800">Create Pay Run</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-100">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pay Run Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. March 2026 Monthly Payroll"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Period Start *
                  </label>
                  <input
                    type="date"
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Period End *
                  </label>
                  <input
                    type="date"
                    value={formPeriodEnd}
                    onChange={(e) => setFormPeriodEnd(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Any additional notes or comments..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs"
                >
                  {formSubmitting ? 'Creating...' : 'Create & Select Employees'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Run Detail Modal (Read-Only for HR Payroll Manager) */}
      {isDetailOpen && selectedPayrun && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="font-bold text-xl text-slate-800">
                    {selectedPayrun.name}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedPayrun.state === 'DONE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedPayrun.state}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Period: {new Date(selectedPayrun.periodStart).toLocaleDateString()} -{' '}
                  {new Date(selectedPayrun.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {actionSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200 flex items-center space-x-2">
                  <span>✓ {actionSuccess}</span>
                </div>
              )}

              {/* Workflow Controls exposed ONLY to HR Payroll User & Admin */}
              {isHRUser ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleValidate}
                      disabled={validating}
                      className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition"
                    >
                      <span>{validating ? 'Checking...' : 'Run Pre-Computation Check'}</span>
                    </button>
                    {selectedPayrun.state === 'DRAFT' && (
                      <button
                        onClick={handleCompute}
                        disabled={computing}
                        className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition"
                      >
                        <span>{computing ? 'Computing Payroll...' : 'Compute Payroll'}</span>
                      </button>
                    )}
                  </div>
                  <div>
                    {selectedPayrun.state === 'DRAFT' ? (
                      <button
                        onClick={() => handleStateChange('DONE')}
                        className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition"
                      >
                        <span>Approve & Lock Pay Run</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStateChange('DRAFT')}
                        className="flex items-center space-x-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3.5 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        <span>Re-open as Draft</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between">
                  <span>🔒 Read-Only Record: Pay run creation and processing is managed by HR Payroll User.</span>
                </div>
              )}

              {/* Validation Warning Results */}
              {validationResult && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    Pre-computation Audit Findings ({validationResult.warnings.length})
                  </h4>
                  {validationResult.warnings.length === 0 ? (
                    <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm border border-emerald-200 flex items-center space-x-2">
                      <span>✓ All employee structures & contracts are valid. Ready for computation!</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {validationResult.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                            w.severity === 'ERROR'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          <div>
                            <span className="font-semibold">{w.employeeName}: </span>
                            <span>{w.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Employees & Calculated Payslips Table */}
              <div>
                <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">
                  Employee Payslips ({selectedPayrun.payslips?.length || 0})
                </h4>
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Employee</th>
                        <th className="py-2.5 px-4">Structure</th>
                        <th className="py-2.5 px-4">Basic Wage</th>
                        <th className="py-2.5 px-4">Gross Wage</th>
                        <th className="py-2.5 px-4">Net Wage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedPayrun.payslips?.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {p.employee.firstName} {p.employee.lastName}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              #{p.employee.employeeNumber}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {p.salaryStructure ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold">
                                {p.salaryStructure.name}
                              </span>
                            ) : (
                              <span className="text-rose-500 text-xs italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            ₹{Number(p.basicWage || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            ₹{Number(p.grossWage || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-indigo-600">
                            ₹{Number(p.netWage || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payruns;
