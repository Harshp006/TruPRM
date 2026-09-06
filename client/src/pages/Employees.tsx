import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchEmployees, fetchEmployee, createEmployee, updateEmployee, fetchSchedules, fetchSalaryStructures,
  type Employee, type WorkingSchedule, type SalaryStructure
} from '../api/hr';
import { fetchUsers, type User } from '../api/users';
import { SearchFilterBar, EmptyState } from '../components/SearchFilterBar';
import Pagination from '../components/Pagination';

function KanbanCard({ emp, onClick }: { emp: Employee; onClick: () => void }) {
  const color = emp.color || '#6366f1';
  const activeContract = emp.contracts?.find(c => c.status === 'ACTIVE');
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-2xs border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-all"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="font-bold text-slate-800 text-sm">{emp.firstName} {emp.lastName}</div>
      <div className="text-xs text-slate-500 mt-1">{emp.jobTitle}</div>
      {emp.department && (
        <div className="text-[11px] text-slate-400 font-medium mt-0.5">{emp.department}</div>
      )}
      {activeContract && (
        <div className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1">
          <span>●</span> Active Contract ({activeContract.contractType})
        </div>
      )}
      <div className="text-[11px] text-slate-400 mt-1 font-mono">#{emp.employeeNumber}</div>
    </div>
  );
}

function SmartButton({ label, count, onClick }: { label: string; count: number; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs cursor-pointer transition"
    >
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
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
    employeeNumber: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    firstName: '',
    lastName: '',
    jobTitle: '',
    department: '',
    hireDate: new Date().toISOString().slice(0, 10),
    color: '#6366f1',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Employee, val: any) => setForm(f => ({ ...f, [key]: val }));

  const availableUsers = useMemo(() => {
    const linkedUserIds = new Set(
      employees.map(e => e.userId).filter(Boolean)
    );
    return users.filter(u => !linkedUserIds.has(u.id) || u.id === (initial?.userId ?? form.userId));
  }, [users, employees, initial?.userId, form.userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.jobTitle?.trim()) {
      setError('First Name, Last Name, and Job Title are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save employee record');
    } finally {
      setSaving(false);
    }
  };

  const managersOptions = employees.filter(e => e.id !== (initial as any)?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
          <input required value={form.firstName || ''} onChange={e => set('firstName', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
          <input required value={form.lastName || ''} onChange={e => set('lastName', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Employee # *</label>
          <input required value={form.employeeNumber || ''} onChange={e => set('employeeNumber', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
          <input required value={form.jobTitle || ''} onChange={e => set('jobTitle', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
          <input value={form.department || ''} onChange={e => set('department', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hire Date *</label>
          <input required type="date" value={form.hireDate?.slice(0, 10) || ''} onChange={e => set('hireDate', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
          <input type="date" value={form.dateOfBirth?.slice(0, 10) || ''} onChange={e => set('dateOfBirth', e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Manager</label>
          <select value={form.managerId || ''} onChange={e => set('managerId', e.target.value || null)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="">— None —</option>
            {managersOptions.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Linked User Account</label>
          <select value={form.userId || ''} onChange={e => set('userId', e.target.value || null)}
            className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="">— Auto-create Employee user account —</option>
            {availableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Color Tag</label>
          <input type="color" value={form.color || '#6366f1'} onChange={e => set('color', e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-300 cursor-pointer" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold text-sm disabled:opacity-50 transition">
          {saving ? 'Saving...' : 'Save Employee'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 font-bold text-sm transition">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const canManageEmployees = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [_schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [structureFilter, setStructureFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('NAME_ASC');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, deptFilter, typeFilter, statusFilter, structureFilter, sortOption]);

  const load = async () => {
    setLoading(true);
    try {
      const [empsRes, usrsRes, schedsRes, structsRes] = await Promise.allSettled([
        fetchEmployees(),
        fetchUsers(),
        fetchSchedules(),
        fetchSalaryStructures(),
      ]);

      if (empsRes.status === 'fulfilled') {
        setEmployees(empsRes.value);
      } else {
        console.error('Error fetching employees:', empsRes.reason);
      }

      if (usrsRes.status === 'fulfilled') {
        setUsers(usrsRes.value);
      } else {
        setUsers([]);
      }

      if (schedsRes.status === 'fulfilled') {
        setSchedules(schedsRes.value);
      }

      if (structsRes.status === 'fulfilled') {
        setStructures(structsRes.value);
      }
    } catch (err) {
      console.error('Error loading employee directory:', err);
    } finally {
      setLoading(false);
    }
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

  const openDetail = async (emp: Employee) => {
    setDetailEmployee(emp);
    try {
      const fullEmp = await fetchEmployee(emp.id);
      setDetailEmployee(fullEmp);
    } catch (err) {
      console.error('Error fetching employee detail:', err);
    }
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

  // Dynamic filter options derived from DB
  const departmentOptions = useMemo(() => {
    const list = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort() as string[];
    return [{ label: 'All Departments', value: 'ALL' }, ...list.map(d => ({ label: d, value: d }))];
  }, [employees]);

  const structureOptions = useMemo(() => {
    return [
      { label: 'All Salary Structures', value: 'ALL' },
      ...structures.map(s => ({ label: s.name, value: s.id })),
    ];
  }, [structures]);

  // Combined Search & Filter Computation
  const filteredEmployees = useMemo(() => {
    let result = employees.filter((e) => {
      // 1. Search Query (Name, Employee ID, Email, Job Title, Dept)
      const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
      const empNum = (e.employeeNumber || '').toLowerCase();
      const email = (e.user?.email || '').toLowerCase();
      const jobTitle = (e.jobTitle || '').toLowerCase();
      const dept = (e.department || '').toLowerCase();
      const q = search.toLowerCase().trim();

      const matchesSearch = !q || fullName.includes(q) || empNum.includes(q) || email.includes(q) || jobTitle.includes(q) || dept.includes(q);

      // 2. Department Filter
      const matchesDept = deptFilter === 'ALL' || e.department === deptFilter;

      // 3. Employee Type Filter
      const activeContract = e.contracts?.find(c => c.status === 'ACTIVE');
      const matchesType = typeFilter === 'ALL' || (activeContract && activeContract.contractType === typeFilter);

      // 4. Status Filter
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' && activeContract) || (statusFilter === 'INACTIVE' && !activeContract);

      // 5. Salary Structure Filter
      const matchesStructure = structureFilter === 'ALL' || (activeContract && activeContract.salaryStructureId === structureFilter);

      return matchesSearch && matchesDept && matchesType && matchesStatus && matchesStructure;
    });

    // Sort Options
    result.sort((a, b) => {
      if (sortOption === 'NAME_ASC') {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortOption === 'NAME_DESC') {
        return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
      } else if (sortOption === 'HIRE_NEWEST') {
        return new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime();
      } else if (sortOption === 'EMP_NUM') {
        return a.employeeNumber.localeCompare(b.employeeNumber);
      }
      return 0;
    });

    return result;
  }, [employees, search, deptFilter, typeFilter, statusFilter, structureFilter, sortOption]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; value: string; onClear: () => void }> = [];
    if (deptFilter !== 'ALL') chips.push({ label: 'Dept', value: deptFilter, onClear: () => setDeptFilter('ALL') });
    if (typeFilter !== 'ALL') chips.push({ label: 'Type', value: typeFilter.replace('_', ' '), onClear: () => setTypeFilter('ALL') });
    if (statusFilter !== 'ALL') chips.push({ label: 'Status', value: statusFilter, onClear: () => setStatusFilter('ALL') });
    if (structureFilter !== 'ALL') {
      const structName = structures.find(s => s.id === structureFilter)?.name || structureFilter;
      chips.push({ label: 'Structure', value: structName, onClear: () => setStructureFilter('ALL') });
    }
    return chips;
  }, [deptFilter, typeFilter, statusFilter, structureFilter, structures]);

  const handleClearAllFilters = () => {
    setSearch('');
    setDeptFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setStructureFilter('ALL');
    setSortOption('NAME_ASC');
  };

  // Group employees by department for kanban
  const departments = [...new Set(filteredEmployees.map(e => e.department || 'Unassigned'))];

  const closeDetail = () => setDetailEmployee(null);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Employees</h1>
          <p className="text-slate-500 text-sm mt-1">Browse employee directory, active contracts, and department assignments.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-white shadow-2xs">
            <button onClick={() => setView('list')}
              className={`px-4 py-2 text-xs font-bold ${view === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              List View
            </button>
            <button onClick={() => setView('kanban')}
              className={`px-4 py-2 text-xs font-bold ${view === 'kanban' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              Kanban View
            </button>
          </div>
          {canManageEmployees && (
            <button onClick={openCreate}
              className="px-5 py-2.5 bg-brand-600 text-white text-xs font-bold rounded-xl hover:bg-brand-700 shadow-xs transition whitespace-nowrap">
              + New Employee
            </button>
          )}
        </div>
      </div>

      {/* Unified Search & Filter Control Bar */}
      <SearchFilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employees by name, employee #, email, title, or department..."
        filters={[
          {
            key: 'department',
            label: 'Department',
            value: deptFilter,
            options: departmentOptions,
            onChange: setDeptFilter,
          },
          {
            key: 'type',
            label: 'Employee Type',
            value: typeFilter,
            options: [
              { label: 'All Types', value: 'ALL' },
              { label: 'Full-Time', value: 'FULL_TIME' },
              { label: 'Part-Time', value: 'PART_TIME' },
              { label: 'Contract', value: 'CONTRACT' },
              { label: 'Intern', value: 'INTERN' },
            ],
            onChange: setTypeFilter,
          },
          {
            key: 'status',
            label: 'Contract Status',
            value: statusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active Contract', value: 'ACTIVE' },
              { label: 'No Active Contract', value: 'INACTIVE' },
            ],
            onChange: setStatusFilter,
          },
          {
            key: 'structure',
            label: 'Salary Structure',
            value: structureFilter,
            options: structureOptions,
            onChange: setStructureFilter,
          },
        ]}
        sortOption={sortOption}
        onSortChange={setSortOption}
        sortOptions={[
          { label: 'Sort: Name (A-Z)', value: 'NAME_ASC' },
          { label: 'Sort: Name (Z-A)', value: 'NAME_DESC' },
          { label: 'Sort: Hire Date (Newest)', value: 'HIRE_NEWEST' },
          { label: 'Sort: Employee #', value: 'EMP_NUM' },
        ]}
        activeFilterChips={activeFilterChips}
        onClearAll={handleClearAllFilters}
        resultsCount={filteredEmployees.length}
        totalCount={employees.length}
        unitName="employees"
      />

      {/* Employee Detail Side Panel Modal */}
      {detailEmployee && (() => {
        const activeContract = detailEmployee.contracts?.find((c: any) => c.status === 'ACTIVE') || detailEmployee.contracts?.[0];
        const latestPayslip = detailEmployee.payslips?.[0];

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-start justify-end z-50">
            <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col">
              {/* Panel Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-black shadow-2xs"
                    style={{ backgroundColor: detailEmployee.color || '#6366f1' }}
                  >
                    {detailEmployee.firstName?.[0]}{detailEmployee.lastName?.[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-snug">
                      {detailEmployee.firstName} {detailEmployee.lastName}
                    </h2>
                    <p className="text-slate-500 text-xs font-semibold mt-0.5">
                      {detailEmployee.jobTitle} · <span className="font-mono">#{detailEmployee.employeeNumber}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeDetail}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-xl text-2xl font-bold leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Panel Body */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Read-Only Banner for non-admin HR roles */}
                {!canManageEmployees && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-between">
                    <span>🔒 Read-Only Record: HR Payroll User View</span>
                  </div>
                )}

                {/* Quick Navigation Cards */}
                <div className="grid grid-cols-4 gap-2.5">
                  <SmartButton
                    label="Contracts"
                    count={detailEmployee._count?.contracts ?? detailEmployee.contracts?.length ?? 0}
                    onClick={() => navigate(`/contracts?employeeId=${detailEmployee.id}`)}
                  />
                  <SmartButton
                    label="Attendance"
                    count={detailEmployee.attendanceSummary?.total ?? detailEmployee._count?.attendances ?? 0}
                    onClick={() => navigate(`/employees/${detailEmployee.id}/attendance`)}
                  />
                  <SmartButton
                    label="Time Off"
                    count={detailEmployee.timeOffSummary?.total ?? detailEmployee._count?.timeOffRequests ?? 0}
                    onClick={() => navigate(`/employees/${detailEmployee.id}/timeoff`)}
                  />
                  <SmartButton
                    label="Payslips"
                    count={detailEmployee._count?.payslips ?? detailEmployee.payslips?.length ?? 0}
                    onClick={() => navigate(`/payslips?employeeId=${detailEmployee.id}`)}
                  />
                </div>

                {/* 1. EMPLOYEE INFORMATION */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <span>👤</span> EMPLOYEE INFORMATION
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-4.5 rounded-2xl border border-slate-200/80">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Full Name</span>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{detailEmployee.firstName} {detailEmployee.lastName}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Employee ID</span>
                      <p className="font-bold text-slate-800 text-sm font-mono mt-0.5">#{detailEmployee.employeeNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Work Email</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{detailEmployee.user?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Phone Number</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">N/A</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Date of Birth</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">
                        {detailEmployee.dateOfBirth ? new Date(detailEmployee.dateOfBirth).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Gender</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">N/A</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Employee Status</span>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${activeContract ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {activeContract ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Hire Date</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{new Date(detailEmployee.hireDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Department</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{detailEmployee.department || 'Unassigned'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Job Title</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{detailEmployee.jobTitle}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Manager</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">
                        {detailEmployee.manager ? `${detailEmployee.manager.firstName} ${detailEmployee.manager.lastName}` : 'None'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. EMPLOYMENT & CONTRACT */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <span>📄</span> EMPLOYMENT & CONTRACT
                  </h3>
                  {activeContract ? (
                    <div className="bg-slate-50/80 p-4.5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <div>
                          <span className="font-extrabold text-slate-900 text-sm">{activeContract.contractType}</span>
                          <span className="text-slate-500 block text-[11px]">Type: {activeContract.contractType}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${activeContract.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                          {activeContract.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px] uppercase">Start Date</span>
                          <p className="font-bold text-slate-800">{new Date(activeContract.startDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px] uppercase">End Date</span>
                          <p className="font-bold text-slate-800">{activeContract.endDate ? new Date(activeContract.endDate).toLocaleDateString() : 'Ongoing'}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px] uppercase">Basic Salary / Wage</span>
                          <p className="font-extrabold text-indigo-700 text-sm">₹{Number(activeContract.wageAmount || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px] uppercase">Pay Frequency</span>
                          <p className="font-bold text-slate-800">Monthly</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px] uppercase">Salary Structure</span>
                          <p className="font-bold text-slate-800">{activeContract.salaryStructure?.name || 'Default Structure'}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block text-[11px] uppercase">Working Schedule</span>
                          <p className="font-bold text-slate-800">
                            {activeContract.workingSchedule ? `${activeContract.workingSchedule.name} (${activeContract.workingSchedule.hoursPerWeek}h/wk)` : 'Standard (40h/wk)'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 text-center italic">
                      No active contract assigned.
                    </div>
                  )}
                </div>

                {/* 3. ATTENDANCE */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <span>⏱️</span> ATTENDANCE
                  </h3>
                  <div className="grid grid-cols-4 gap-2.5 text-center text-xs">
                    <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-500 block">Total</span>
                      <span className="font-extrabold text-indigo-900 text-base">{detailEmployee.attendanceSummary?.total ?? 0}</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-600 block">Present</span>
                      <span className="font-extrabold text-emerald-900 text-base">{detailEmployee.attendanceSummary?.presentDays ?? 0}</span>
                    </div>
                    <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-rose-500 block">Absent</span>
                      <span className="font-extrabold text-rose-900 text-base">{detailEmployee.attendanceSummary?.absentDays ?? 0}</span>
                    </div>
                    <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-amber-600 block">Worked</span>
                      <span className="font-extrabold text-amber-900 text-sm">{detailEmployee.attendanceSummary?.totalWorkedHours ?? 0}h</span>
                    </div>
                  </div>

                  {/* Recent Attendances */}
                  {detailEmployee.attendances && detailEmployee.attendances.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                          <tr>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Check In</th>
                            <th className="py-2 px-3">Check Out</th>
                            <th className="py-2 px-3">Hours</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {detailEmployee.attendances.slice(0, 5).map((att: any) => (
                            <tr key={att.id}>
                              <td className="py-2 px-3">{new Date(att.date).toLocaleDateString()}</td>
                              <td className="py-2 px-3 text-slate-600">{att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                              <td className="py-2 px-3 text-slate-600">{att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                              <td className="py-2 px-3 font-semibold">{att.workedHours ? `${att.workedHours}h` : '—'}</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${att.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {att.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 text-center italic">
                      No attendance records found.
                    </div>
                  )}
                </div>

                {/* 4. TIME OFF */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <span>🏝️</span> TIME OFF
                  </h3>
                  <div className="grid grid-cols-4 gap-2.5 text-center text-xs">
                    <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-indigo-500 block">Total</span>
                      <span className="font-extrabold text-indigo-900 text-base">{detailEmployee.timeOffSummary?.total ?? 0}</span>
                    </div>
                    <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-amber-600 block">Pending</span>
                      <span className="font-extrabold text-amber-900 text-base">{detailEmployee.timeOffSummary?.pending ?? 0}</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-600 block">Approved</span>
                      <span className="font-extrabold text-emerald-900 text-base">{detailEmployee.timeOffSummary?.approved ?? 0}</span>
                    </div>
                    <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-xl">
                      <span className="text-[10px] font-extrabold uppercase text-rose-500 block">Rejected</span>
                      <span className="font-extrabold text-rose-900 text-base">{detailEmployee.timeOffSummary?.refused ?? 0}</span>
                    </div>
                  </div>

                  {/* Recent Time Off Requests */}
                  {detailEmployee.timeOffRequests && detailEmployee.timeOffRequests.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                          <tr>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Period</th>
                            <th className="py-2 px-3">Days</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {detailEmployee.timeOffRequests.slice(0, 5).map((tor: any) => (
                            <tr key={tor.id}>
                              <td className="py-2 px-3 font-semibold">{tor.timeOffType?.name || 'Leave'}</td>
                              <td className="py-2 px-3 text-slate-600">{new Date(tor.startDate).toLocaleDateString()} - {new Date(tor.endDate).toLocaleDateString()}</td>
                              <td className="py-2 px-3 font-bold">{tor.daysRequested}d</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  tor.status === 'APPROVED' || tor.status === 'VALIDATED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : tor.status === 'REFUSED'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {tor.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400 text-center italic">
                      No time-off requests found.
                    </div>
                  )}
                </div>

                {/* 5. PAYROLL INFORMATION */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <span>💳</span> PAYROLL INFORMATION
                  </h3>
                  <div className="bg-slate-50/80 p-4.5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">Basic Salary</span>
                        <p className="font-extrabold text-slate-900 text-sm">
                          ₹{Number(activeContract?.wageAmount || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">Salary Structure</span>
                        <p className="font-bold text-slate-800">
                          {activeContract?.salaryStructure?.name || 'Default Structure'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">Latest Gross Salary</span>
                        <p className="font-extrabold text-slate-900">
                          {latestPayslip?.grossWage != null ? `₹${Number(latestPayslip.grossWage).toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">Latest Net Take-Home</span>
                        <p className="font-extrabold text-indigo-600">
                          {latestPayslip?.netWage != null ? `₹${Number(latestPayslip.netWage).toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">Latest Status</span>
                        <p className="font-bold text-slate-800">
                          {latestPayslip ? (latestPayslip.status === 'LOCKED' ? 'Approved & Locked' : latestPayslip.status) : 'No Payslip Record'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold block text-[11px] uppercase">Latest Pay Run Period</span>
                        <p className="font-bold text-slate-800">
                          {latestPayslip ? `${new Date(latestPayslip.periodStart).toLocaleDateString()} - ${new Date(latestPayslip.periodEnd).toLocaleDateString()}` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Payslips List */}
                  {detailEmployee.payslips && detailEmployee.payslips.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                          <tr>
                            <th className="py-2 px-3">Pay Run / Period</th>
                            <th className="py-2 px-3">Basic</th>
                            <th className="py-2 px-3">Gross</th>
                            <th className="py-2 px-3">Net</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {detailEmployee.payslips.map((ps: any) => (
                            <tr key={ps.id}>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {ps.payrun?.name || 'Pay Run'}
                              </td>
                              <td className="py-2 px-3">₹{Number(ps.basicWage || 0).toLocaleString()}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">₹{Number(ps.grossWage || 0).toLocaleString()}</td>
                              <td className="py-2 px-3 font-extrabold text-indigo-600">₹{Number(ps.netWage || 0).toLocaleString()}</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  ps.status === 'LOCKED' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-indigo-700'
                                }`}>
                                  {ps.status === 'LOCKED' ? 'Approved & Locked' : ps.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                {canManageEmployees ? (
                  <button
                    onClick={() => { closeDetail(); openEdit(detailEmployee); }}
                    className="mt-6 w-full px-4 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 shadow-xs transition"
                  >
                    Edit Employee Profile
                  </button>
                ) : (
                  <div className="mt-4 text-xs text-center text-slate-400 font-medium">
                    Read-only employee view for HR Payroll User
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Employee Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl p-7 shadow-2xl w-full max-w-2xl mx-4 space-y-4">
            <h2 className="text-xl font-black text-slate-900">
              {selectedEmployee ? 'Edit Employee Record' : 'New Employee Record'}
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

      {/* Main Employee Table / Kanban Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 space-y-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-600 border-t-transparent"></div>
          <p className="text-sm font-medium">Loading employee directory...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          title="No Employees Found"
          description="No employee records match your search or filter criteria. Try clearing active filters."
          hasActiveFilters={search.trim() !== '' || activeFilterChips.length > 0}
          onClearFilters={handleClearAllFilters}
        />
      ) : view === 'list' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Employee Name</th>
                <th className="py-3.5 px-4">Job Title</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Manager</th>
                <th className="py-3.5 px-4">Hire Date</th>
                <th className="py-3.5 px-4 text-center">Contracts</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 font-medium">
              {filteredEmployees.slice((page - 1) * pageSize, page * pageSize).map(emp => (
                <tr key={emp.id} className="hover:bg-brand-50/40 transition cursor-pointer" onClick={() => openDetail(emp)}>
                  <td className="py-3.5 px-4 text-xs font-mono font-bold text-slate-500">#{emp.employeeNumber}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold shadow-2xs"
                        style={{ backgroundColor: emp.color || '#6366f1' }}>
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</div>
                        {emp.user?.email && <div className="text-xs text-slate-400">{emp.user.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-semibold">{emp.jobTitle}</td>
                  <td className="py-3.5 px-4 text-slate-700 font-semibold">{emp.department || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{new Date(emp.hireDate).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {emp._count?.contracts ?? 0}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {canManageEmployees ? (
                      <button onClick={e => { e.stopPropagation(); openEdit(emp); }}
                        className="px-3 py-1 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg text-xs font-bold transition">Edit</button>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); openDetail(emp); }}
                        className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition">View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={filteredEmployees.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : (
        /* Kanban View */
        <div className="flex gap-6 overflow-x-auto pb-4">
          {departments.map(dept => {
            const deptEmployees = filteredEmployees.filter(e => (e.department || 'Unassigned') === dept);
            return (
              <div key={dept} className="flex-shrink-0 w-72 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="font-extrabold text-slate-800 text-sm flex justify-between items-center px-1">
                  <span>{dept}</span>
                  <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{deptEmployees.length}</span>
                </div>
                <div className="space-y-3">
                  {deptEmployees.map(emp => (
                    <KanbanCard key={emp.id} emp={emp} onClick={() => openDetail(emp)} />
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
