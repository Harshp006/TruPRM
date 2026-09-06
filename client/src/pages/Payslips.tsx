import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SearchFilterBar, EmptyState, type FilterOption } from '../components/SearchFilterBar';

interface PayslipLine {
  id: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Payslip {
  id: string;
  payrunId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  basicWage: number;
  grossWage?: number;
  netWage?: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    jobTitle?: string;
    department?: string;
  };
  salaryStructure?: {
    id: string;
    name: string;
    code: string;
  };
  payrun?: {
    id: string;
    name: string;
    state: string;
  };
  lines?: PayslipLine[];
  breakdown?: {
    earnings: PayslipLine[];
    deductions: PayslipLine[];
    employerContributions: PayslipLine[];
    totalEmployerContribution: number;
  };
}

const Payslips: React.FC = () => {
  const { user, token } = useAuth();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [payrunsList, setPayrunsList] = useState<Array<{ id: string; name: string }>>([]);

  // Search & Multi-Filter States
  const [search, setSearch] = useState('');
  const [payrunFilter, setPayrunFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [structureFilter, setStructureFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('PERIOD_NEWEST');



  const fetchPayslips = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:5000/api/payslips';
      if (payrunFilter !== 'ALL' && payrunFilter) {
        url += `?payrunId=${payrunFilter}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayslips(data);
      }
    } catch (err) {
      console.error('Error fetching payslips:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayrunsList = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/payruns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayrunsList(data.map((pr: any) => ({ id: pr.id, name: pr.name })));
      }
    } catch (err) {
      // Ignore if non-HR
    }
  };

  useEffect(() => {
    if (token) {
      fetchPayslips();
      if (user?.role !== 'EMPLOYEE') {
        fetchPayrunsList();
      }
    }
  }, [token, payrunFilter]);


  // Dynamic Department Options from Payslips
  const departmentOptions = useMemo(() => {
    const list = Array.from(
      new Set(payslips.map((p) => p.employee.department).filter(Boolean))
    ).sort() as string[];
    return [
      { label: 'All Departments', value: 'ALL' },
      ...list.map((d) => ({ label: d, value: d })),
    ];
  }, [payslips]);

  // Dynamic Structure Options from Payslips
  const structureOptions = useMemo(() => {
    const map = new Map<string, string>();
    payslips.forEach((p) => {
      if (p.salaryStructure) {
        map.set(p.salaryStructure.id, p.salaryStructure.name);
      }
    });
    const opts = Array.from(map.entries()).map(([id, name]) => ({
      label: name,
      value: id,
    }));
    return [{ label: 'All Structures', value: 'ALL' }, ...opts];
  }, [payslips]);

  // Dynamic Pay Run Options
  const payrunOptions = useMemo(() => {
    return [
      { label: 'All Pay Runs', value: 'ALL' },
      ...payrunsList.map((pr) => ({ label: pr.name, value: pr.id })),
    ];
  }, [payrunsList]);

  // Filters & Sorting logic
  const filteredPayslips = useMemo(() => {
    return payslips
      .filter((p) => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const empName = `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase();
          const empNum = p.employee.employeeNumber.toLowerCase();
          const payslipId = p.id.toLowerCase();
          const payrunName = p.payrun?.name.toLowerCase() || '';

          const matches =
            empName.includes(q) ||
            empNum.includes(q) ||
            payslipId.includes(q) ||
            payrunName.includes(q);
          if (!matches) return false;
        }

        // Payrun Filter
        if (payrunFilter !== 'ALL' && p.payrunId !== payrunFilter && p.payrun?.id !== payrunFilter) {
          return false;
        }

        // Department Filter
        if (deptFilter !== 'ALL' && p.employee.department !== deptFilter) {
          return false;
        }

        // Structure Filter
        if (structureFilter !== 'ALL' && p.salaryStructure?.id !== structureFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === 'NET_WAGE_DESC') {
          return Number(b.netWage || 0) - Number(a.netWage || 0);
        }
        if (sortOption === 'NET_WAGE_ASC') {
          return Number(a.netWage || 0) - Number(b.netWage || 0);
        }
        if (sortOption === 'GROSS_WAGE_DESC') {
          return Number(b.grossWage || 0) - Number(a.grossWage || 0);
        }
        if (sortOption === 'PERIOD_OLDEST') {
          return new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime();
        }
        if (sortOption === 'EMP_NAME_ASC') {
          return a.employee.firstName.localeCompare(b.employee.firstName);
        }
        // Default: PERIOD_NEWEST
        return new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime();
      });
  }, [payslips, search, payrunFilter, deptFilter, structureFilter, sortOption]);

  const handleClearAll = () => {
    setSearch('');
    setPayrunFilter('ALL');
    setDeptFilter('ALL');
    setStructureFilter('ALL');
    setSortOption('PERIOD_NEWEST');
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; value: string; onClear: () => void }> = [];
    if (payrunFilter !== 'ALL') {
      const prName = payrunsList.find((pr) => pr.id === payrunFilter)?.name || payrunFilter;
      chips.push({ label: 'Pay Run', value: prName, onClear: () => setPayrunFilter('ALL') });
    }
    if (deptFilter !== 'ALL') {
      chips.push({ label: 'Dept', value: deptFilter, onClear: () => setDeptFilter('ALL') });
    }
    if (structureFilter !== 'ALL') {
      const sName =
        structureOptions.find((s) => s.value === structureFilter)?.label || structureFilter;
      chips.push({ label: 'Structure', value: sName, onClear: () => setStructureFilter('ALL') });
    }
    return chips;
  }, [payrunFilter, deptFilter, structureFilter, payrunsList, structureOptions]);

  const filtersConfig: FilterOption[] = useMemo(() => {
    const list: FilterOption[] = [];
    if (user?.role !== 'EMPLOYEE' && payrunOptions.length > 1) {
      list.push({
        key: 'payrun',
        label: 'Pay Run',
        value: payrunFilter,
        options: payrunOptions,
        onChange: setPayrunFilter,
      });
    }
    if (departmentOptions.length > 1) {
      list.push({
        key: 'department',
        label: 'Department',
        value: deptFilter,
        options: departmentOptions,
        onChange: setDeptFilter,
      });
    }
    if (structureOptions.length > 1) {
      list.push({
        key: 'structure',
        label: 'Salary Structure',
        value: structureFilter,
        options: structureOptions,
        onChange: setStructureFilter,
      });
    }
    return list;
  }, [user, payrunFilter, payrunOptions, deptFilter, departmentOptions, structureFilter, structureOptions]);

  const sortOptionsConfig = [
    { label: 'Sort: Period (Newest)', value: 'PERIOD_NEWEST' },
    { label: 'Sort: Period (Oldest)', value: 'PERIOD_OLDEST' },
    { label: 'Sort: Net Pay (High to Low)', value: 'NET_WAGE_DESC' },
    { label: 'Sort: Net Pay (Low to High)', value: 'NET_WAGE_ASC' },
    { label: 'Sort: Gross Pay (High to Low)', value: 'GROSS_WAGE_DESC' },
    { label: 'Sort: Employee Name (A-Z)', value: 'EMP_NAME_ASC' },
  ];

  // Calculate totals
  const totalGross = filteredPayslips.reduce((sum, p) => sum + Number(p.grossWage || 0), 0);
  const totalNet = filteredPayslips.reduce((sum, p) => sum + Number(p.netWage || 0), 0);
  const totalDeductions = totalGross - totalNet;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {user?.role === 'EMPLOYEE' ? 'My Payslips' : 'Employee Payslips'}
          </h1>
          <p className="text-slate-500 text-sm">
            {user?.role === 'EMPLOYEE'
              ? 'View and download your monthly salary statements.'
              : 'Browse itemized earnings, deductions, and employer contributions.'}
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 font-bold rounded-xl text-lg">
            ₹
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Net Salary
            </div>
            <div className="text-2xl font-bold text-slate-800">
              ₹{totalNet.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-lg">
            ₹
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Gross Earnings
            </div>
            <div className="text-2xl font-bold text-slate-800">
              ₹{totalGross.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 font-bold rounded-xl text-lg">
            ₹
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Deductions
            </div>
            <div className="text-2xl font-bold text-slate-800">
              ₹{totalDeductions.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <SearchFilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search employee by name, ID, or payslip reference..."
        filters={filtersConfig}
        sortOption={sortOption}
        onSortChange={setSortOption}
        sortOptions={sortOptionsConfig}
        activeFilterChips={activeFilterChips}
        onClearAll={handleClearAll}
        resultsCount={filteredPayslips.length}
        totalCount={payslips.length}
        unitName="payslips"
      />

      {/* Table / Empty State */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500 font-semibold">
          Loading payslips...
        </div>
      ) : filteredPayslips.length === 0 ? (
        <EmptyState
          title="No Payslips Found"
          description={
            search || activeFilterChips.length > 0
              ? 'No payslips match your current search and filter selections.'
              : 'Payslips will appear once pay runs are generated and computed.'
          }
          hasActiveFilters={search.trim() !== '' || activeFilterChips.length > 0}
          onClearFilters={handleClearAll}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Pay Period</th>
                <th className="py-3 px-4">Generated Date</th>
                <th className="py-3 px-4">Net Pay</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayslips.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-900">
                      {p.employee.firstName} {p.employee.lastName}
                    </div>
                    <div className="text-xs text-slate-400">
                      #{p.employee.employeeNumber}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(p.periodStart).toLocaleDateString()} -{' '}
                    {new Date(p.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {new Date(p.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-indigo-600">
                    ₹{Number(p.netWage || 0).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full border border-emerald-200">
                      {p.payrun?.state || 'GENERATED'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <a
                      href={`http://localhost:5000/api/payslips/${p.id}/pdf?disposition=inline&token=${token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      View PDF
                    </a>
                    <a
                      href={`http://localhost:5000/api/payslips/${p.id}/pdf?download=true&token=${token}`}
                      download
                      className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

export default Payslips;
