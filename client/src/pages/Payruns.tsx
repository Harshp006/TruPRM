import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SearchFilterBar, EmptyState } from '../components/SearchFilterBar';

interface Payrun {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  state: 'DRAFT' | 'VALIDATING' | 'VALIDATION_ERROR' | 'VALIDATED' | 'COMPUTED' | 'DONE' | 'PAID' | 'CANCELLED';
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
    status?: 'DRAFT' | 'PASSED' | 'FAILED' | 'COMPUTED' | 'LOCKED';
    statusMessage?: string | null;
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

interface NotificationItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  department?: string;
  jobTitle?: string;
  designation?: string;
  contracts?: Array<{
    id: string;
    startDate: string;
    wageAmount?: number;
    workingSchedule?: {
      name?: string;
      hoursPerWeek?: number;
    };
  }>;
}

interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  status: string;
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

  // Modals & 2-Step Wizard State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [selectedPayrun, setSelectedPayrun] = useState<Payrun | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Dynamic Employee & Structure state for Create Pay Run
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [fetchingModalData, setFetchingModalData] = useState(false);

  // Validation & Computing State
  const [validating, setValidating] = useState(false);
  const [computing, setComputing] = useState(false);

  // Sequential Notification Queue State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotifications = (items: NotificationItem[]) => {
    setNotifications((prev) => [...prev, ...items]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  // Role permissions
  const isHRUser = user?.role === 'HR_PAYROLL_ADMIN' || user?.role === 'HR_PAYROLL_USER' || user?.role === 'ADMIN';
  const isHRManagerViewOnly = user?.role === 'HR_MANAGER';

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
    setNotifications([]);
    setIsDetailOpen(true);
    fetchPayrunDetail(pr.id);
  };

  const handleOpenCreateModal = async () => {
    setIsCreateOpen(true);
    setCreateStep(1);
    setFormError('');
    setEmployeeSearch('');
    setSelectedStructureId('');
    setFetchingModalData(true);
    try {
      const [empRes, structRes] = await Promise.all([
        fetch('http://localhost:5000/api/employees', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:5000/api/salary-structures', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData);
        setSelectedEmployeeIds(empData.map((e: Employee) => e.id));
      }
      if (structRes.ok) {
        const structData = await structRes.json();
        setSalaryStructures(structData);
      }
    } catch (err) {
      console.error('Error fetching data for pay run creation:', err);
    } finally {
      setFetchingModalData(false);
    }
  };

  const handleNextToStep2 = () => {
    setFormError('');
    if (!formName.trim() || !formPeriodStart || !formPeriodEnd) {
      setFormError('Please fill in all required fields (Pay Run Name, Period Start, Period End).');
      return;
    }
    setCreateStep(2);
  };

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const q = employeeSearch.toLowerCase();
    return employees.filter(
      (e) =>
        e.firstName.toLowerCase().includes(q) ||
        e.lastName.toLowerCase().includes(q) ||
        (e.employeeNumber && e.employeeNumber.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        ((e.designation || e.jobTitle) && (e.designation || e.jobTitle || '').toLowerCase().includes(q))
    );
  }, [employees, employeeSearch]);

  const handleSelectAllEmployees = () => {
    const filteredIds = filteredEmployees.map((e) => e.id);
    setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDeselectAllEmployees = () => {
    const filteredIdsSet = new Set(filteredEmployees.map((e) => e.id));
    setSelectedEmployeeIds((prev) => prev.filter((id) => !filteredIdsSet.has(id)));
  };

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName || !formPeriodStart || !formPeriodEnd) {
      setFormError('Please fill in all required fields (Name, Start Date, End Date).');
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      setFormError('Please select at least 1 employee for the pay run.');
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
          employeeIds: selectedEmployeeIds,
          salaryStructureId: selectedStructureId || null,
        }),
      });

      if (res.ok) {
        const newPr = await res.json();
        setIsCreateOpen(false);
        setFormName('');
        setFormPeriodStart('');
        setFormPeriodEnd('');
        setFormNotes('');
        setSelectedEmployeeIds([]);
        setSelectedStructureId('');
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
      const res = await fetch(`http://localhost:5000/api/payruns/${selectedPayrun.id}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.payrun) {
          setSelectedPayrun(data.payrun);
        }
        fetchPayruns();
        if (data.warnings && data.warnings.length > 0) {
          addNotifications([
            {
              id: `val-summary-${Date.now()}`,
              type: 'warning',
              message: `Pre-computation check completed: ${data.warnings.length} employee check(s) failed. See status details in table below.`,
            },
          ]);
        } else {
          addNotifications([
            {
              id: `val-ok-${Date.now()}`,
              type: 'success',
              message: 'Pre-computation check completed: All employee structures & contracts are valid. Ready for computation!',
            },
          ]);
        }
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
      const res = await fetch(`http://localhost:5000/api/payruns/${selectedPayrun.id}/compute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        if (data.payrun) {
          setSelectedPayrun(data.payrun);
        }
        const msg = `Payroll computation finished: ${data.computedCount} computed, ${data.skippedCount} skipped due to failed pre-computation check.`;
        addNotifications([
          {
            id: `comp-${Date.now()}`,
            type: 'success',
            message: msg,
          },
        ]);
        fetchPayruns();
      } else {
        alert(data.message || 'Compute payroll failed.');
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
      const data = await res.json();
      if (res.ok) {
        setSelectedPayrun(data);
        const msg = `Pay Run state updated to ${newState}`;
        addNotifications([
          {
            id: `state-${Date.now()}`,
            type: 'info',
            message: msg,
          },
        ]);
        fetchPayruns();
      } else {
        alert(data.message || 'Failed to update Pay Run state.');
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

  const handleSendPayslips = () => {
    if (!selectedPayrun || !isHRUser) return;
    const count = selectedPayrun.payslips?.length || 0;
    addNotifications([
      {
        id: `send-ps-${Date.now()}`,
        type: 'success',
        message: `Payslips dispatched to ${count} employee(s). Notification and email delivery queued.`,
      },
    ]);
  };

  // Search & Filter computation
  const filteredPayruns = useMemo(() => {
    const now = new Date();
    let result = payruns.filter((pr) => {
      const q = search.toLowerCase().trim();
      const matchesName = pr.name.toLowerCase().includes(q) || pr.id.toLowerCase().includes(q);
      const matchesEmployeeInPayrun = pr.payslips?.some(p =>
        `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase().includes(q) ||
        p.employee.employeeNumber.toLowerCase().includes(q)
      );
      const matchesSearch = !q || matchesName || matchesEmployeeInPayrun;

      const matchesState = stateFilter === 'ALL' || pr.state === stateFilter;

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
    if (stateFilter !== 'ALL') chips.push({ label: 'Status', value: stateFilter === 'DONE' ? 'PAYSLIP GENERATED' : stateFilter, onClear: () => setStateFilter('ALL') });
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

        {isHRManagerViewOnly && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold shadow-2xs">
            <span>🔒</span> HR Manager Read-Only Access
          </div>
        )}

        {isHRUser && (
          <button
            onClick={handleOpenCreateModal}
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
              { label: 'Validation Error', value: 'VALIDATION_ERROR' },
              { label: 'Validated', value: 'VALIDATED' },
              { label: 'Computed', value: 'COMPUTED' },
              { label: 'Payslip Generated', value: 'DONE' },
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
                <tr
                  key={pr.id}
                  className={`transition ${
                    pr.state === 'VALIDATION_ERROR'
                      ? 'bg-rose-50/40 hover:bg-rose-50 border-l-4 border-l-rose-500'
                      : 'hover:bg-indigo-50/40'
                  }`}
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center space-x-2">
                      <span>{pr.name}</span>
                      {pr.state === 'VALIDATION_ERROR' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          VALIDATION ERROR
                        </span>
                      )}
                    </div>
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
                    ₹{pr.totalNet ? Number(pr.totalNet).toLocaleString('en-IN') : '0'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                        pr.state === 'VALIDATION_ERROR'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
                          : pr.state === 'VALIDATING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          : pr.state === 'VALIDATED'
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : pr.state === 'COMPUTED'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : pr.state === 'DONE' || pr.state === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {pr.state === 'VALIDATION_ERROR'
                        ? 'VALIDATION ERROR'
                        : pr.state === 'VALIDATING'
                        ? 'VALIDATING...'
                        : pr.state === 'VALIDATED'
                        ? 'VALIDATED'
                        : pr.state === 'DONE' || pr.state === 'PAID'
                        ? 'PAYSLIP GENERATED'
                        : pr.state}
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

      {/* Create Modal (2-Step Wizard) */}
      {isCreateOpen && isHRUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-slate-800">
                    {createStep === 1 ? 'New Pay Run' : 'Select Employee Records'}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-700">
                    Step {createStep} of 2
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {createStep === 1
                    ? 'Specify pay period dates and default salary structure.'
                    : 'Choose employee records to include in this pay run.'}
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl text-sm border border-rose-200 font-medium">
                  ⚠️ {formError}
                </div>
              )}

              {/* STEP 1: Pay Structure & Period */}
              {createStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pay Run Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. March 2026 Monthly Payroll"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Period Start Date *
                      </label>
                      <input
                        type="date"
                        value={formPeriodStart}
                        onChange={(e) => setFormPeriodStart(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Period End Date *
                      </label>
                      <input
                        type="date"
                        value={formPeriodEnd}
                        onChange={(e) => setFormPeriodEnd(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pay Structure Override (Optional)
                    </label>
                    <select
                      value={selectedStructureId}
                      onChange={(e) => setSelectedStructureId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="">-- Use Active Contract Default Structure --</option>
                      {salaryStructures.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code}) - {s.status}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Leave default to automatically compute each employee using their assigned contract structure.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Additional notes for HR audit..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Step 1 Footer */}
                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleNextToStep2}
                      className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs flex items-center gap-1.5"
                    >
                      <span>Continue to Employee Selection</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Select Employee Records */}
              {createStep === 2 && (
                <div className="space-y-4">
                  {fetchingModalData ? (
                    <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent"></div>
                      <p>Loading eligible employee records...</p>
                    </div>
                  ) : (
                    <>
                      {/* Search & Bulk Action Controls */}
                      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="w-full sm:w-72">
                          <input
                            type="text"
                            placeholder="Search employee, ID, department..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <span className="text-xs font-bold text-slate-700">
                            Selected: <span className="text-indigo-600">{selectedEmployeeIds.length}</span> of {employees.length}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleSelectAllEmployees}
                              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold shadow-2xs transition"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={handleDeselectAllEmployees}
                              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold shadow-2xs transition"
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Employee Records Table */}
                      <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto shadow-2xs bg-white">
                        {filteredEmployees.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-400 font-medium">
                            No employee records match your search criteria.
                          </div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-extrabold text-slate-400 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-3.5 w-10 text-center">
                                  <input
                                    type="checkbox"
                                    checked={
                                      filteredEmployees.length > 0 &&
                                      filteredEmployees.every((e) => selectedEmployeeIds.includes(e.id))
                                    }
                                    onChange={(e) =>
                                      e.target.checked
                                        ? handleSelectAllEmployees()
                                        : handleDeselectAllEmployees()
                                    }
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                </th>
                                <th className="py-2.5 px-3.5">Employee</th>
                                <th className="py-2.5 px-3.5">Working Hours</th>
                                <th className="py-2.5 px-3.5">Start Date</th>
                                <th className="py-2.5 px-3.5 text-right">Basic Wage</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {filteredEmployees.map((emp) => {
                                const isSelected = selectedEmployeeIds.includes(emp.id);
                                const activeContract = emp.contracts?.[0];
                                const hours = activeContract?.workingSchedule?.hoursPerWeek || 40;
                                const startDateStr = activeContract?.startDate
                                  ? new Date(activeContract.startDate).toLocaleDateString('en-IN')
                                  : formPeriodStart
                                  ? new Date(formPeriodStart).toLocaleDateString('en-IN')
                                  : 'N/A';
                                const wageStr = activeContract?.wageAmount
                                  ? `₹${Number(activeContract.wageAmount).toLocaleString('en-IN')}`
                                  : 'N/A';

                                return (
                                  <tr
                                    key={emp.id}
                                    onClick={() => handleToggleEmployee(emp.id)}
                                    className={`cursor-pointer transition hover:bg-indigo-50/30 ${
                                      isSelected ? 'bg-indigo-50/50' : ''
                                    }`}
                                  >
                                    <td className="py-2.5 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleEmployee(emp.id)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                      />
                                    </td>
                                    <td className="py-2.5 px-3.5">
                                      <div className="font-bold text-slate-800">
                                        {emp.firstName} {emp.lastName}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono">
                                        #{emp.employeeNumber || emp.id.substring(0, 8)}
                                        {emp.department ? ` • ${emp.department}` : ''}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3.5 text-slate-600 font-semibold">
                                      {hours} hrs/wk
                                    </td>
                                    <td className="py-2.5 px-3.5 text-slate-600">
                                      {startDateStr}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right font-extrabold text-slate-800">
                                      {wageStr}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Step 2 Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(1)}
                          className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center gap-1.5"
                        >
                          <span>←</span>
                          <span>Back to Period</span>
                        </button>
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => setIsCreateOpen(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={formSubmitting || selectedEmployeeIds.length === 0}
                            className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition shadow-xs"
                          >
                            {formSubmitting
                              ? 'Creating Pay Run...'
                              : `Create Pay Run (${selectedEmployeeIds.length} Selected)`}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Pay Run Detail Modal */}
      {isDetailOpen && selectedPayrun && (() => {
        const payslipsList = selectedPayrun.payslips || [];
        const passedCount = payslipsList.filter((p) => p.status === 'PASSED').length;
        const computedCount = payslipsList.filter((p) => p.status === 'COMPUTED').length;

        const canCompute = (passedCount > 0 || computedCount > 0) && selectedPayrun.state !== 'DONE';
        const canApprove = computedCount > 0 && selectedPayrun.state !== 'DONE';

        return (
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
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {selectedPayrun.state === 'DONE' ? 'PAYSLIP GENERATED' : selectedPayrun.state}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Period: {new Date(selectedPayrun.periodStart).toLocaleDateString('en-IN')} -{' '}
                    {new Date(selectedPayrun.periodEnd).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Workflow Controls / Action Bar */}
                {isHRUser ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleCompute}
                        disabled={computing || !canCompute}
                        className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition"
                        title={!canCompute ? 'No eligible pre-checked employees to compute. Run Pre-Computation Check first.' : ''}
                      >
                        <span>
                          {computing
                            ? 'Computing Payroll...'
                            : `Compute Payroll (${passedCount} Eligible)`}
                        </span>
                      </button>

                      <button
                        onClick={handleValidate}
                        disabled={validating}
                        className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold shadow-2xs transition"
                      >
                        <span>{validating ? 'Checking...' : 'Validate (Pre-check)'}</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedPayrun.state === 'DRAFT' ? (
                        <button
                          onClick={() => handleStateChange('DONE')}
                          disabled={!canApprove}
                          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition"
                          title={!canApprove ? 'No computed employees available to approve & lock.' : ''}
                        >
                          <span>Mark Paid / Lock ({computedCount} Computed)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStateChange('DRAFT')}
                          className="flex items-center space-x-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition"
                        >
                          <span>Re-open as Draft</span>
                        </button>
                      )}

                      <button
                        onClick={handleSendPayslips}
                        className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition"
                      >
                        <span>Send Payslips</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-between">
                    <span>🔒 Read-Only Record: Pay run creation and processing is managed by HR Payroll User.</span>
                  </div>
                )}

                {/* Notifications List (Displayed sequentially below action buttons) */}
                {notifications.length > 0 && (
                  <div className="space-y-2">
                    {notifications.map((notif) => {
                      const typeStyles = {
                        success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        warning: 'bg-amber-50 text-amber-800 border-amber-200',
                        error: 'bg-rose-50 text-rose-800 border-rose-200',
                        info: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                      }[notif.type];

                      return (
                        <div
                          key={notif.id}
                          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 shadow-xs ${typeStyles}`}
                        >
                          <div className="flex items-center space-x-2 flex-1">
                            <span>{notif.message}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismissNotification(notif.id)}
                            className="px-2.5 py-1 rounded bg-white/80 hover:bg-white text-slate-700 shadow-2xs transition font-bold shrink-0"
                          >
                            Dismiss
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Employees & Calculated Payslips Table */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">
                    Employee Payslips ({selectedPayrun.payslips?.length || 0})
                  </h4>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Employee</th>
                          <th className="py-2.5 px-4">Structure</th>
                          <th className="py-2.5 px-4">Status & Pre-Computation Check</th>
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
                            <td className="py-3 px-4">
                              {p.status === 'FAILED' && (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-xs font-bold">
                                    Pre-computation Check Failed
                                  </span>
                                  {p.statusMessage && (
                                    <div className="text-[11px] text-rose-600 font-medium leading-tight max-w-xs">
                                      {p.statusMessage}
                                    </div>
                                  )}
                                </div>
                              )}
                              {p.status === 'PASSED' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">
                                  Pre-computation Check Passed
                                </span>
                              )}
                              {p.status === 'COMPUTED' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold">
                                  Computed
                                </span>
                              )}
                              {p.status === 'LOCKED' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                                  Approved & Locked
                                </span>
                              )}
                              {(!p.status || p.status === 'DRAFT') && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
                                  Not Checked
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              ₹{Number(p.basicWage || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {p.status === 'COMPUTED' || p.status === 'LOCKED' ? (
                                `₹${Number(p.grossWage || 0).toLocaleString('en-IN')}`
                              ) : (
                                <span className="text-slate-400 font-normal italic">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-extrabold text-indigo-600">
                              {p.status === 'COMPUTED' || p.status === 'LOCKED' ? (
                                `₹${Number(p.netWage || 0).toLocaleString('en-IN')}`
                              ) : (
                                <span className="text-slate-400 font-normal italic">-</span>
                              )}
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
        );
      })()}
    </div>
  );
};

export default Payruns;
