import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface StructureSummary {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom: string;
  effectiveTo?: string | null;
  rules?: any[];
  _count?: { rules: number };
}

interface PayrunSummary {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  state: 'DRAFT' | 'DONE' | 'CANCELLED';
  totalNet?: number;
  _count?: { payslips: number };
}

interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  department?: string | null;
  contracts?: Array<{
    id: string;
    wageAmount: number;
    salaryStructureCode?: string;
    status: string;
  }>;
}

interface PayslipSummary {
  id: string;
  netSalary: number;
  grossSalary: number;
  totalDeductions: number;
  periodStart: string;
  employee?: {
    department?: string;
  };
}

export default function HRPayrollManagerDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<StructureSummary[]>([]);
  const [payruns, setPayruns] = useState<PayrunSummary[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [payslips, setPayslips] = useState<PayslipSummary[]>([]);
  const [attendanceCount, setAttendanceCount] = useState({ total: 0, present: 0 });
  const [timeOffCount, setTimeOffCount] = useState({ pending: 0, approved: 0 });

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };

        const [structRes, payrunRes, empRes, payslipRes, attRes, timeoffRes] = await Promise.all([
          fetch('http://localhost:5000/api/salary-structures', { headers }),
          fetch('http://localhost:5000/api/payruns', { headers }),
          fetch('http://localhost:5000/api/employees', { headers }),
          fetch('http://localhost:5000/api/payslips', { headers }),
          fetch('http://localhost:5000/api/attendance', { headers }).catch(() => null),
          fetch('http://localhost:5000/api/time-off/requests', { headers }).catch(() => null),
        ]);

        if (structRes.ok) {
          setStructures(await structRes.json());
        }
        if (payrunRes.ok) {
          setPayruns(await payrunRes.json());
        }
        if (empRes.ok) {
          setEmployees(await empRes.json());
        }
        if (payslipRes.ok) {
          setPayslips(await payslipRes.json());
        }
        if (attRes && attRes.ok) {
          const attData = await attRes.json();
          setAttendanceCount({
            total: attData.length,
            present: attData.filter((a: any) => a.status === 'PRESENT').length,
          });
        }
        if (timeoffRes && timeoffRes.ok) {
          const toData = await timeoffRes.json();
          setTimeOffCount({
            pending: toData.filter((t: any) => t.status === 'PENDING').length,
            approved: toData.filter((t: any) => t.status === 'APPROVED').length,
          });
        }
      } catch (err) {
        console.error('Error loading payroll manager dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  // Extract unique departments for filtering
  const departmentsList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees & payslips based on filters
  const filteredEmployees = useMemo(() => {
    if (selectedDepartment === 'ALL') return employees;
    return employees.filter((e) => e.department === selectedDepartment);
  }, [employees, selectedDepartment]);

  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      const matchDept =
        selectedDepartment === 'ALL' ||
        (p.employee && p.employee.department === selectedDepartment);

      const matchPeriod =
        selectedPeriod === 'ALL' ||
        (selectedPeriod === 'THIS_MONTH' &&
          new Date(p.periodStart).getMonth() === new Date().getMonth()) ||
        (selectedPeriod === 'LAST_MONTH' &&
          new Date(p.periodStart).getMonth() === new Date().getMonth() - 1);

      return matchDept && matchPeriod;
    });
  }, [payslips, selectedDepartment, selectedPeriod]);

  // Real Metric Calculations
  const totalPayrollAmount = useMemo(() => {
    return filteredPayslips.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
  }, [filteredPayslips]);

  const activeStructuresCount = structures.filter((s) => s.status === 'ACTIVE').length;
  const inactiveStructuresCount = structures.filter((s) => s.status === 'INACTIVE').length;

  // Department Salary Distribution
  const salaryByDept = useMemo(() => {
    const map: Record<string, { count: number; totalWage: number }> = {};
    employees.forEach((emp) => {
      const dept = emp.department || 'Unassigned';
      if (!map[dept]) map[dept] = { count: 0, totalWage: 0 };
      map[dept].count += 1;
      const activeContract = emp.contracts?.find((c) => c.status === 'ACTIVE');
      if (activeContract) {
        map[dept].totalWage += Number(activeContract.wageAmount) || 0;
      }
    });
    return Object.entries(map).map(([dept, data]) => ({
      department: dept,
      count: data.count,
      totalWage: data.totalWage,
    }));
  }, [employees]);

  // Attention Items / Warnings
  const warnings = useMemo(() => {
    const list: string[] = [];
    const emptyStructures = structures.filter(
      (s) => (s._count?.rules ?? s.rules?.length ?? 0) === 0
    );
    if (emptyStructures.length > 0) {
      list.push(
        `Attention: ${emptyStructures.length} Salary Structure(s) have NO defined rules.`
      );
    }

    const draftRuns = payruns.filter((p) => p.state === 'DRAFT');
    if (draftRuns.length > 0) {
      list.push(`Notification: ${draftRuns.length} Pay Run(s) are currently in DRAFT status.`);
    }

    const unassignedEmps = employees.filter(
      (e) => !e.contracts || e.contracts.length === 0
    );
    if (unassignedEmps.length > 0) {
      list.push(
        `Notice: ${unassignedEmps.length} Employee(s) have no active contract assigned.`
      );
    }
    return list;
  }, [structures, payruns, employees]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            HR Payroll Manager Portal
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Payroll configuration and oversight dashboard powered by real database analytics.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/salary-structures/new')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            + Create Salary Structure
          </button>
        </div>
      </div>

      {/* Interactive Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Filter Dashboard:
          </span>

          {/* Department Filter */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="text-xs py-1.5 px-3 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departmentsList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Period Filter */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="text-xs py-1.5 px-3 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Payroll Periods</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
          </select>

          {(selectedDepartment !== 'ALL' || selectedPeriod !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedDepartment('ALL');
                setSelectedPeriod('ALL');
              }}
              className="text-xs text-indigo-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Real Database Sync • {filteredEmployees.length} Employees Matched
        </div>
      </div>

      {/* Attention Warnings / Notifications Bar */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚠️ Payroll Oversight Alerts ({warnings.length})</span>
          </div>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Payroll Amount */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Salary / Payroll
          </span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-extrabold text-slate-900">
              {loading
                ? '...'
                : `₹${totalPayrollAmount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Filtered Total
            </span>
          </div>
        </div>

        {/* Number of Payslips / Records */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Payslip Records
          </span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-extrabold text-indigo-600">
              {loading ? '...' : filteredPayslips.length}
            </span>
            <span className="text-xs font-medium text-slate-500">
              Finalized Payslips
            </span>
          </div>
        </div>

        {/* Active Salary Structures */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Structures
          </span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-extrabold text-emerald-600">
              {loading ? '...' : activeStructuresCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {inactiveStructuresCount} Inactive
            </span>
          </div>
        </div>

        {/* Total Employees */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Employees
          </span>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-2xl font-extrabold text-slate-800">
              {loading ? '...' : filteredEmployees.length}
            </span>
            <span className="text-xs font-semibold text-indigo-600">
              Directory
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Grid: Salary by Department & Overview Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Salary Distribution by Department */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-sm">
              Salary Budget Breakdown by Department
            </h3>
            <span className="text-xs text-slate-400">Based on Active Contracts</span>
          </div>
          {salaryByDept.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">No department data.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {salaryByDept.map((row) => (
                <div key={row.department} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{row.department}</span>
                    <span className="text-slate-400 text-[11px] ml-2">({row.count} employees)</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    ₹{row.totalWage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance & Time Off Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-sm">
              Attendance & Time Off Overview
            </h3>
            <p className="text-[11px] text-slate-400">Payroll calculation input data</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Logged Attendance Records</span>
              <span className="font-bold text-slate-900">{attendanceCount.total}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Present Records</span>
              <span className="font-bold text-emerald-600">{attendanceCount.present}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Pending Time Off Requests</span>
              <span className="font-bold text-amber-600">{timeOffCount.pending}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Approved Time Off</span>
              <span className="font-bold text-indigo-600">{timeOffCount.approved}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tables Overview: Salary Structures & Pay Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Salary Structures */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">
              Configured Salary Structures
            </h3>
            <button
              onClick={() => navigate('/salary-structures')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View Structures List →
            </button>
          </div>
          <div className="p-4 flex-1 overflow-x-auto">
            {loading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Loading structures...</div>
            ) : structures.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">No structures created yet.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                    <th className="py-2 px-3">Structure Name</th>
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Rules</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {structures.slice(0, 5).map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/salary-structures/${s.id}`)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{s.code}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {s._count?.rules ?? s.rules?.length ?? 0} rules
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pay Runs Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">
              Pay Runs Tracking (Read-Only)
            </h3>
            <button
              onClick={() => navigate('/payruns')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View Pay Runs →
            </button>
          </div>
          <div className="p-4 flex-1 overflow-x-auto">
            {loading ? (
              <div className="text-center py-6 text-slate-400 text-sm">Loading pay runs...</div>
            ) : payruns.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">No pay runs found.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold">
                    <th className="py-2 px-3">Pay Run</th>
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3">Net Payroll</th>
                    <th className="py-2 px-3">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payruns.slice(0, 5).map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {pr.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(pr.periodStart).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        ₹{pr.totalNet ? pr.totalNet.toLocaleString() : '0'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pr.state === 'DONE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pr.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
