import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SearchFilterBar, EmptyState } from '../components/SearchFilterBar';

// ─── Types ────────────────────────────────────────────────────────────────────
type PayrunState = 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' | 'CANCELLED';
type PayslipState = 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';

interface EligibleEmployee {
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string; department?: string };
  contractId: string;
  contractType: string;
  wageAmount: number;
  wageCurrency: string;
  salaryStructure?: { id: string; name: string; code: string };
}

interface PayslipLine { id: string; name: string; code: string; category: string; quantity: number; rate: number; amount: number; }

interface Payslip {
  id: string;
  employeeId: string;
  state: PayslipState;
  basicWage: number;
  grossWage?: number;
  netWage?: number;
  totalDeductions?: number;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string; department?: string };
  salaryStructure?: { id: string; name: string; code: string };
  lines?: PayslipLine[];
}

interface Payrun {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  state: PayrunState;
  notes?: string;
  createdAt: string;
  totalGross?: number;
  totalNet?: number;
  _count?: { payslips?: number };
  payslips?: Payslip[];
}

interface ValidationWarning {
  employeeId: string;
  employeeName: string;
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATE_COLORS: Record<PayrunState, string> = {
  DRAFT: 'bg-amber-100 text-amber-800 border-amber-300',
  COMPUTED: 'bg-blue-100 text-blue-800 border-blue-300',
  VALIDATED: 'bg-purple-100 text-purple-800 border-purple-300',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-300',
};

const STATE_LABEL: Record<PayrunState, string> = {
  DRAFT: '⬜ Draft',
  COMPUTED: '🔵 Computed',
  VALIDATED: '🟣 Validated',
  PAID: '✅ Paid',
  CANCELLED: '🚫 Cancelled',
};

function fmt(n: number | undefined | null) {
  return `₹${Number(n || 0).toLocaleString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
const Payruns: React.FC = () => {
  const { user, token } = useAuth();
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('PERIOD_DESC');

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2>(0); // 0=closed,1=step1,2=step2
  const [wName, setWName] = useState('');
  const [wPeriodStart, setWPeriodStart] = useState('');
  const [wPeriodEnd, setWPeriodEnd] = useState('');
  const [wNotes, setWNotes] = useState('');
  const [wError, setWError] = useState('');
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Detail state ──────────────────────────────────────────────────────────
  const [selectedPayrun, setSelectedPayrun] = useState<Payrun | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [expandedPayslipId, setExpandedPayslipId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; transitioned: boolean; warnings: ValidationWarning[] } | null>(null);

  // ── Role permissions ──────────────────────────────────────────────────────
  const canCreate = user?.role === 'HR_PAYROLL_USER' || user?.role === 'HR_PAYROLL_ADMIN' || user?.role === 'ADMIN';
  const canCompute = canCreate; // same roles can compute
  const canMarkPaid = user?.role === 'HR_PAYROLL_ADMIN' || user?.role === 'ADMIN';

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchPayruns = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/payruns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPayruns(await res.json());
    } catch (err) {
      console.error('Error fetching payruns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) fetchPayruns(); }, [token]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/payruns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSelectedPayrun(await res.json());
    } catch (err) { console.error('Error fetching payrun detail:', err); }
  };

  // ── Wizard helpers ────────────────────────────────────────────────────────
  const openWizard = () => {
    setWName(''); setWPeriodStart(''); setWPeriodEnd(''); setWNotes('');
    setWError(''); setEligibleEmployees([]); setSelectedEmpIds(new Set());
    setWizardStep(1);
  };

  const handleWizardStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setWError('');
    if (!wName || !wPeriodStart || !wPeriodEnd) {
      setWError('All fields are required.');
      return;
    }
    if (new Date(wPeriodEnd) < new Date(wPeriodStart)) {
      setWError('Period end must be after period start.');
      return;
    }
    setEligibleLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/payruns/eligible-employees?periodStart=${wPeriodStart}&periodEnd=${wPeriodEnd}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch eligible employees');
      const data: EligibleEmployee[] = await res.json();
      setEligibleEmployees(data);
      setSelectedEmpIds(new Set(data.map(e => e.employeeId))); // pre-select all
      setWizardStep(2);
    } catch (err) {
      setWError('Could not load eligible employees. Check the server.');
    } finally {
      setEligibleLoading(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreatePayrun = async () => {
    if (selectedEmpIds.size === 0) {
      setWError('Select at least one employee.');
      return;
    }
    setCreating(true);
    setWError('');
    try {
      const res = await fetch('http://localhost:5000/api/payruns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: wName,
          periodStart: wPeriodStart,
          periodEnd: wPeriodEnd,
          notes: wNotes || undefined,
          employeeIds: Array.from(selectedEmpIds),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setWError(err.message || 'Failed to create pay run');
        return;
      }
      const newPr = await res.json();
      setWizardStep(0);
      fetchPayruns();
      openDetail(newPr);
    } catch (err) {
      setWError('Network error.');
    } finally {
      setCreating(false);
    }
  };

  // ── Detail helpers ────────────────────────────────────────────────────────
  const openDetail = (pr: Payrun) => {
    setSelectedPayrun(pr);
    setValidationResult(null);
    setActionError('');
    setActionSuccess('');
    setExpandedPayslipId(null);
    setIsDetailOpen(true);
    fetchDetail(pr.id);
  };

  const doAction = async (path: string, label: string) => {
    if (!selectedPayrun) return;
    setActionLoading(label);
    setActionError('');
    setActionSuccess('');
    setValidationResult(null);
    try {
      const res = await fetch(`http://localhost:5000/api/payruns/${selectedPayrun.id}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || `${label} failed`);
        return;
      }
      if (path === 'send-payslips') {
        alert(data.message || 'Payslips sent successfully');
        setActionLoading(null);
        return;
      }
      // validate returns { payrun, valid, warnings }; others return the payrun directly
      const updatedPr = data.payrun ?? data;
      setSelectedPayrun(updatedPr);
      if (data.warnings !== undefined) {
        setValidationResult({ valid: data.valid, transitioned: data.transitioned, warnings: data.warnings });
        setActionSuccess(data.valid ? `✅ Validated — payrun is now VALIDATED` : 'Validation found errors (see below).');
      } else {
        setActionSuccess(`${label} successful`);
      }
      fetchPayruns();
    } catch (err) {
      setActionError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this draft pay run?')) return;
    try {
      await fetch(`http://localhost:5000/api/payruns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPayruns();
      if (selectedPayrun?.id === id) setIsDetailOpen(false);
    } catch (err) { console.error(err); }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredPayruns = useMemo(() => {
    const now = new Date();
    let result = payruns.filter((pr) => {
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || pr.name.toLowerCase().includes(q) ||
        pr.payslips?.some(p => `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase().includes(q)) ||
        false;
      const matchesState = stateFilter === 'ALL' || pr.state === stateFilter;
      let matchesPeriod = true;
      if (periodFilter === 'CURRENT_MONTH') {
        const d = new Date(pr.periodStart);
        matchesPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (periodFilter === 'PREVIOUS_MONTH') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const d = new Date(pr.periodStart);
        matchesPeriod = d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
      }
      return matchesSearch && matchesState && matchesPeriod;
    });
    result.sort((a, b) => {
      if (sortOption === 'PERIOD_DESC') return new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime();
      if (sortOption === 'NAME_ASC') return a.name.localeCompare(b.name);
      if (sortOption === 'TOTAL_DESC') return (b.totalNet || 0) - (a.totalNet || 0);
      return 0;
    });
    return result;
  }, [payruns, search, stateFilter, periodFilter, sortOption]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; value: string; onClear: () => void }> = [];
    if (stateFilter !== 'ALL') chips.push({ label: 'Status', value: stateFilter, onClear: () => setStateFilter('ALL') });
    if (periodFilter !== 'ALL') chips.push({ label: 'Period', value: periodFilter, onClear: () => setPeriodFilter('ALL') });
    return chips;
  }, [stateFilter, periodFilter]);

  const pr = selectedPayrun;
  const isLocked = pr?.state === 'PAID' || pr?.state === 'CANCELLED';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-700 tracking-tight">Pay Runs</h1>
          <p className="text-slate-500 text-sm mt-1">
            {canCreate
              ? 'Create, compute, validate and pay employee payroll runs.'
              : 'Read-only view of payroll runs and finalized payslips.'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openWizard}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-xl shadow-sm transition"
          >
            + New Pay Run
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <SearchFilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search pay runs by name or employee…"
        filters={[
          {
            key: 'state', label: 'Status', value: stateFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Computed', value: 'COMPUTED' },
              { label: 'Validated', value: 'VALIDATED' },
              { label: 'Paid', value: 'PAID' },
              { label: 'Cancelled', value: 'CANCELLED' },
            ],
            onChange: setStateFilter,
          },
          {
            key: 'period', label: 'Period', value: periodFilter,
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
        onClearAll={() => { setSearch(''); setStateFilter('ALL'); setPeriodFilter('ALL'); setSortOption('PERIOD_DESC'); }}
        resultsCount={filteredPayruns.length}
        totalCount={payruns.length}
        unitName="pay runs"
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-600 border-t-transparent" />
            <p className="text-sm font-medium">Loading pay runs…</p>
          </div>
        ) : filteredPayruns.length === 0 ? (
          <EmptyState
            title="No Pay Runs Found"
            description="No pay runs match your current filters."
            hasActiveFilters={search !== '' || activeFilterChips.length > 0}
            onClearFilters={() => { setSearch(''); setStateFilter('ALL'); setPeriodFilter('ALL'); }}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Pay Run</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-center">Employees</th>
                <th className="py-3.5 px-4">Gross / Net</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPayruns.map((pr) => (
                <tr key={pr.id} className="hover:bg-brand-50/30 transition cursor-pointer" onClick={() => openDetail(pr)}>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{pr.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(pr.periodStart).toLocaleDateString()} – {new Date(pr.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">
                      {pr._count?.payslips ?? pr.payslips?.length ?? 0}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-xs text-slate-500">Gross: {fmt(pr.totalGross)}</div>
                    <div className="font-bold text-slate-900">Net: {fmt(pr.totalNet)}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATE_COLORS[pr.state]}`}>
                      {STATE_LABEL[pr.state]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openDetail(pr)}
                      className="px-3 py-1 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg text-xs font-bold transition"
                    >
                      Open
                    </button>
                    {canCreate && pr.state === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(pr.id)}
                        className="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition"
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

      {/* ── Wizard Modal ─────────────────────────────────────────────────── */}
      {wizardStep > 0 && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            {/* Wizard header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-800">New Pay Run</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Step {wizardStep} of 2 — {wizardStep === 1 ? 'Set Period & Name' : 'Select Employees'}
                </p>
              </div>
              <button onClick={() => setWizardStep(0)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex border-b border-slate-100">
              {[1, 2].map((s) => (
                <div key={s} className={`flex-1 h-1.5 ${wizardStep >= s ? 'bg-brand-500' : 'bg-slate-100'}`} />
              ))}
            </div>

            {/* Step 1: Name + Period */}
            {wizardStep === 1 && (
              <form onSubmit={handleWizardStep1} className="p-6 space-y-4">
                {wError && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-100">{wError}</div>}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pay Run Name *</label>
                  <input
                    type="text" required placeholder="e.g. Sep 2026 Monthly Payroll"
                    value={wName} onChange={e => setWName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Period Start *</label>
                    <input type="date" required value={wPeriodStart} onChange={e => setWPeriodStart(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Period End *</label>
                    <input type="date" required value={wPeriodEnd} onChange={e => setWPeriodEnd(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                  <textarea rows={2} value={wNotes} onChange={e => setWNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                  <button type="button" onClick={() => setWizardStep(0)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
                  <button type="submit" disabled={eligibleLoading}
                    className="px-5 py-2 text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition"
                  >
                    {eligibleLoading ? 'Loading employees…' : 'Next: Select Employees →'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Select employees */}
            {wizardStep === 2 && (
              <div className="p-6 space-y-4">
                {wError && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm border border-rose-100">{wError}</div>}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    <span className="font-bold text-slate-900">{eligibleEmployees.length}</span> employees with a contract covering this period.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedEmpIds(new Set(eligibleEmployees.map(e => e.employeeId)))}
                      className="text-xs text-brand-600 hover:underline font-bold">Select All</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setSelectedEmpIds(new Set())}
                      className="text-xs text-slate-500 hover:underline font-bold">Clear</button>
                  </div>
                </div>

                {eligibleEmployees.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    No employees have a contract covering <strong>{wPeriodStart}</strong> → <strong>{wPeriodEnd}</strong>.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {eligibleEmployees.map((e) => {
                      const checked = selectedEmpIds.has(e.employeeId);
                      return (
                        <label key={e.employeeId}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${checked ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleEmployee(e.employeeId)} className="rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 text-sm">{e.employee.firstName} {e.employee.lastName}</div>
                            <div className="text-xs text-slate-500">#{e.employee.employeeNumber} · {e.employee.department || 'No Dept'} · {e.contractType}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-slate-800 text-sm">₹{e.wageAmount.toLocaleString()}</div>
                            {e.salaryStructure ? (
                              <div className="text-xs text-brand-600 font-semibold">{e.salaryStructure.name}</div>
                            ) : (
                              <div className="text-xs text-rose-500">No Structure</div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">← Back</button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">{selectedEmpIds.size} selected</span>
                    <button onClick={handleCreatePayrun} disabled={creating || selectedEmpIds.size === 0}
                      className="px-5 py-2 text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition disabled:opacity-50"
                    >
                      {creating ? 'Creating…' : 'Create Pay Run'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {isDetailOpen && pr && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-xl text-slate-800">{pr.name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATE_COLORS[pr.state]}`}>
                    {STATE_LABEL[pr.state]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(pr.periodStart).toLocaleDateString()} – {new Date(pr.periodEnd).toLocaleDateString()}
                  {' · '}{pr.payslips?.length ?? 0} payslips
                </p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold ml-4">✕</button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status messages */}
              {actionError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-sm flex items-center gap-2">
                  <span>⚠️</span> {actionError}
                </div>
              )}
              {actionSuccess && !actionError && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm flex items-center gap-2">
                  <span>✓</span> {actionSuccess}
                </div>
              )}

              {/* ── 4-Action Lifecycle Bar ──────────────────────────────── */}
              {canCreate && !isLocked && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Payroll Lifecycle</p>
                  {/* State flow diagram */}
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-400 flex-wrap">
                    {(['DRAFT', 'COMPUTED', 'VALIDATED', 'PAID'] as PayrunState[]).map((s, i) => (
                      <React.Fragment key={s}>
                        <span className={`px-2 py-0.5 rounded-full border ${pr.state === s ? STATE_COLORS[s] + ' font-extrabold' : 'border-transparent text-slate-300'}`}>
                          {s}
                        </span>
                        {i < 3 && <span className="text-slate-200">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  {/* Action buttons — gated on state */}
                  <div className="flex flex-wrap gap-2">
                    {pr.state === 'DRAFT' && canCompute && (
                      <button
                        onClick={() => doAction('compute', 'Compute')}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                      >
                        {actionLoading === 'Compute' ? 'Computing…' : '▶ Compute Payroll'}
                      </button>
                    )}
                    {pr.state === 'COMPUTED' && canCompute && (
                      <button
                        onClick={() => doAction('validate', 'Validate')}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                      >
                        {actionLoading === 'Validate' ? 'Validating…' : '✓ Validate'}
                      </button>
                    )}
                    {pr.state === 'VALIDATED' && canMarkPaid && (
                      <button
                        onClick={() => doAction('mark-paid', 'Mark Paid')}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
                      >
                        {actionLoading === 'Mark Paid' ? 'Processing…' : '💰 Mark Paid'}
                      </button>
                    )}
                    {(pr.state === 'DRAFT' || pr.state === 'COMPUTED') && canCompute && (
                      <button
                        onClick={() => doAction('cancel', 'Cancel')}
                        disabled={actionLoading !== null}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold rounded-xl transition"
                      >
                        Cancel Pay Run
                      </button>
                    )}
                    {pr.state === 'DRAFT' && canCreate && (
                      <button
                        onClick={() => handleDelete(pr.id)}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold rounded-xl transition"
                      >
                        🗑 Delete Draft
                      </button>
                    )}
                    {pr.state === 'VALIDATED' && !canMarkPaid && (
                      <div className="text-sm text-slate-500 italic">
                        Only HR Payroll Admin or Admin can mark as Paid.
                      </div>
                    )}
                  </div>
                  {/* State-specific help text */}
                  {pr.state === 'DRAFT' && <p className="text-xs text-slate-400">Click <strong>Compute</strong> to run the salary calculation engine for all employees.</p>}
                  {pr.state === 'COMPUTED' && <p className="text-xs text-slate-400">Click <strong>Validate</strong> to check for errors (duplicate payslips, missing structures). No ERRORs = transitions to VALIDATED.</p>}
                  {pr.state === 'VALIDATED' && <p className="text-xs text-slate-400">Click <strong>Mark Paid</strong> to lock the payrun. This is irreversible and requires HR_PAYROLL_ADMIN role.</p>}
                </div>
              )}

              {/* Read-only lock notice and Send Payslips */}
              {isLocked && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${pr.state === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <div>
                    🔒 This pay run is <strong>{pr.state}</strong> and is now read-only.
                  </div>
                  {pr.state === 'PAID' && canMarkPaid && (
                    <button
                      onClick={() => doAction('send-payslips', 'Send Payslips')}
                      disabled={actionLoading !== null}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                    >
                      ✉️ {actionLoading === 'Send Payslips' ? 'Sending...' : 'Send Payslips via Email'}
                    </button>
                  )}
                </div>
              )}

              {/* Validation result */}
              {validationResult && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Validation Findings ({validationResult.warnings.length})
                  </h4>
                  {validationResult.warnings.length === 0 ? (
                    <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm">
                      ✅ All checks passed. Payrun transitioned to VALIDATED.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {validationResult.warnings.map((w, i) => (
                        <div key={i} className={`p-3 rounded-xl text-xs border ${w.severity === 'ERROR' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                          <span className="font-bold">[{w.severity}] {w.employeeName}:</span> {w.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Employees', value: pr.payslips?.length ?? 0, color: 'text-slate-900' },
                  { label: 'Total Gross', value: fmt(pr.payslips?.reduce((s, p) => s + Number(p.grossWage ?? 0), 0)), color: 'text-slate-900' },
                  { label: 'Total Net', value: fmt(pr.payslips?.reduce((s, p) => s + Number(p.netWage ?? 0), 0)), color: 'text-brand-700' },
                ].map(c => (
                  <div key={c.label} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    <p className="text-xs font-bold uppercase text-slate-400">{c.label}</p>
                    <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Payslips table */}
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Payslips ({pr.payslips?.length ?? 0})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Structure</th>
                        <th className="py-3 px-4">State</th>
                        <th className="py-3 px-4 text-right">Basic</th>
                        <th className="py-3 px-4 text-right">Gross</th>
                        <th className="py-3 px-4 text-right">Deductions</th>
                        <th className="py-3 px-4 text-right">Net</th>
                        <th className="py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {pr.payslips?.map((p) => (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{p.employee.firstName} {p.employee.lastName}</div>
                              <div className="text-xs text-slate-400 font-mono">#{p.employee.employeeNumber}</div>
                            </td>
                            <td className="py-3 px-4">
                              {p.salaryStructure ? (
                                <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-xs font-bold">{p.salaryStructure.name}</span>
                              ) : (
                                <span className="text-rose-500 text-xs italic">None</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${STATE_COLORS[p.state]}`}>
                                {p.state}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-slate-700">{fmt(p.basicWage)}</td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">{fmt(p.grossWage)}</td>
                            <td className="py-3 px-4 text-right text-rose-600 font-semibold">-{fmt(p.totalDeductions)}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-brand-700">{fmt(p.netWage)}</td>
                            <td className="py-3 px-4">
                              {p.lines && p.lines.length > 0 && (
                                <button
                                  onClick={() => setExpandedPayslipId(expandedPayslipId === p.id ? null : p.id)}
                                  className="text-xs text-brand-600 hover:text-brand-800 font-bold"
                                >
                                  {expandedPayslipId === p.id ? '▲ Hide' : '▼ Lines'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* Payslip line breakdown */}
                          {expandedPayslipId === p.id && p.lines && (
                            <tr>
                              <td colSpan={8} className="bg-slate-50 px-8 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
                                      <th className="pb-1.5 text-left">Rule</th>
                                      <th className="pb-1.5 text-left">Code</th>
                                      <th className="pb-1.5 text-left">Category</th>
                                      <th className="pb-1.5 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {p.lines.map((l) => (
                                      <tr key={l.id} className={l.category === 'DEDUCTION' ? 'text-rose-700' : l.category === 'EMPLOYER_CONTRIBUTION' ? 'text-slate-400' : 'text-slate-700'}>
                                        <td className="py-1 font-semibold">{l.name}</td>
                                        <td className="py-1 font-mono text-slate-500">{l.code}</td>
                                        <td className="py-1">{l.category}</td>
                                        <td className={`py-1 text-right font-bold ${l.category === 'DEDUCTION' ? 'text-rose-700' : 'text-slate-900'}`}>
                                          {l.category === 'DEDUCTION' ? '-' : '+'}{fmt(l.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
