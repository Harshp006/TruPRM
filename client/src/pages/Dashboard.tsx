import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface DashboardData {
  filterOptions: {
    departments: string[];
    employeeTypes: string[];
    companies: string[];
    periods: string[];
  };
  summaryCards: {
    totalNetSalaryPaid: number;
    payslipsGenerated: number;
    avgSalaryPerEmployee: number;
    approvedTimeOffDays: number;
    attendanceHealthPct: number;
  };
  salaryCostByDept: Array<{
    department: string;
    headcount: number;
    totalCost: number;
  }>;
  monthlySalaryTrend: Array<{
    month: string;
    amount: number;
  }>;
  payslipStatusSplit: {
    Paid: number;
    Done: number;
    Draft: number;
    Pending: number;
  };
  currentAlerts: string[];
  attendanceOverview: {
    present: number;
    late: number;
    absent: number;
    overtime: number;
    missingCheckouts: number;
    manualEdits: number;
    attendanceCoverage: number;
  };
  timeOffTable: Array<{
    type: string;
    approvedDays: number;
    pending: number;
    remainingBalance: number;
  }>;
  departmentOverview: Array<{
    department: string;
    headcount: number;
    totalCost: number;
  }>;
  modelsSummary: {
    employeesCount: number;
    contractsCount: number;
    payrunsCount: number;
    payslipsCount: number;
    attendanceCount: number;
    timeoffRequestsCount: number;
  };
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const canCreateStructure = user?.role === 'ADMIN' || user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Filter States
  const [period, setPeriod] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [department, setDepartment] = useState<string>('ALL');
  const [employeeType, setEmployeeType] = useState<string>('ALL');
  const [company, setCompany] = useState<string>('ALL');

  // Interactive Hover / Selection States
  const [activeBar, setActiveBar] = useState<{ department: string; headcount: number; totalCost: number } | null>(null);
  const [activeTrendPoint, setActiveTrendPoint] = useState<{ month: string; amount: number } | null>(null);
  const [selectedDeptDetail, setSelectedDeptDetail] = useState<{ department: string; headcount: number; totalCost: number } | null>(null);

  const isFilterActive = useMemo(() => {
    return period !== 'ALL' || department !== 'ALL' || employeeType !== 'ALL' || company !== 'ALL' || Boolean(startDate) || Boolean(endDate);
  }, [period, department, employeeType, company, startDate, endDate]);

  const handleResetFilters = () => {
    setPeriod('ALL');
    setStartDate('');
    setEndDate('');
    setDepartment('ALL');
    setEmployeeType('ALL');
    setCompany('ALL');
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (period !== 'ALL') queryParams.append('period', period);
      if (period === 'CUSTOM') {
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
      }
      if (department !== 'ALL') queryParams.append('department', department);
      if (employeeType !== 'ALL') queryParams.append('employeeType', employeeType);
      if (company !== 'ALL') queryParams.append('company', company);

      const res = await fetch(`http://localhost:5000/api/dashboard/payroll-manager?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error('Dashboard fetch failed with status:', res.status);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboard();
    }
  }, [token, period, startDate, endDate, department, employeeType, company]);

  // --------------------------------------------------------------------------
  // SVG BAR CHART DATA COMPUTATION (Salary Cost by Department)
  // --------------------------------------------------------------------------
  const barChartData = useMemo(() => {
    if (!data?.salaryCostByDept || data.salaryCostByDept.length === 0) return null;
    const items = data.salaryCostByDept;
    const maxVal = Math.max(...items.map((i) => i.totalCost), 1);
    return { items, maxVal };
  }, [data]);

  // --------------------------------------------------------------------------
  // SVG LINE CHART DATA COMPUTATION (Monthly Net Salary Trend)
  // --------------------------------------------------------------------------
  const lineChartData = useMemo(() => {
    if (!data?.monthlySalaryTrend || data.monthlySalaryTrend.length === 0) return null;
    const items = data.monthlySalaryTrend;
    const maxVal = Math.max(...items.map((i) => i.amount), 1);
    return { items, maxVal };
  }, [data]);

  // --------------------------------------------------------------------------
  // SVG DONUT CHART DATA COMPUTATION (Attendance Overview)
  // --------------------------------------------------------------------------
  const attendanceDonutData = useMemo(() => {
    if (!data?.attendanceOverview) return { present: 0, late: 0, absent: 0, overtime: 0, total: 0 };
    const { present, late, absent, overtime } = data.attendanceOverview;
    const total = present + late + absent + overtime;
    return { present, late, absent, overtime, total };
  }, [data]);

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-10 bg-white text-slate-900 p-4 min-h-screen">
      {/* -------------------------------------------------------------------- */}
      {/* 1. PAYROLL DASHBOARD HEADER                                          */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-brand-700 tracking-tight">
            HR Payroll Manager Control Portal
          </h1>
          <p className="text-slate-500 text-base max-w-4xl leading-relaxed font-normal">
            Strategic control center for payroll configuration, component rules, exception audits, and cost aggregation.
          </p>
        </div>
        {canCreateStructure && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/salary-structures/new')}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap"
            >
              + Create Salary Structure
            </button>
            <button
              onClick={() => navigate('/salary-rules')}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap"
            >
              Manage Salary Rules
            </button>
            <button
              onClick={() => navigate('/payruns')}
              className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap"
            >
              Manage Pay Runs
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* PAYROLL SYSTEM CONFIGURATION & READINESS AUDIT                       */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">System Configuration Health</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Payroll Setup & Readiness Verification</h2>
          <p className="text-xs text-slate-500 max-w-2xl font-normal">
            Calculations depend on active Salary Structures and Salary Rules. Verify rule formulas before User execution.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs shrink-0">
          <div>
            <div className="text-slate-500 font-semibold">Configured Structures:</div>
            <div className="text-lg font-bold text-slate-900">{data?.modelsSummary?.contractsCount ? 'Active' : 'Ready'}</div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div>
            <div className="text-slate-500 font-semibold">Pre-Check Exceptions:</div>
            <div className="text-lg font-bold text-amber-600">{data?.currentAlerts?.length || 0} Alerts</div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. ENHANCED PAYROLL ANALYTICS FILTER CONTROL PANEL                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white p-7 sm:p-8 rounded-2xl border border-slate-200 shadow-sm transition-all w-full min-w-0 space-y-6">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-brand-50 text-brand-600 rounded-xl text-lg font-bold">
              ⚡
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Payroll Analytics Controls</h2>
              <p className="text-xs text-slate-500 font-medium">Filter dashboard metrics by period, department, type, and company</p>
            </div>
          </div>

          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1. PERIOD */}
          <div className="space-y-2.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Time Period
            </label>
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className={`w-full py-3.5 px-4 pr-10 text-sm sm:text-base font-bold rounded-xl border transition-all cursor-pointer appearance-none shadow-2xs ${
                  period !== 'ALL'
                    ? 'bg-gray-200/50 border-indigo-300 text-blue-800 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-300/90 text-slate-900 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              >
                <option value="ALL">All Time</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="QUARTER">This Quarter</option>
                <option value="YEAR">This Year</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* 2. DEPARTMENT */}
          <div className="space-y-2.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Department
            </label>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={`w-full py-3.5 px-4 pr-10 text-sm sm:text-base font-bold rounded-xl border transition-all cursor-pointer appearance-none shadow-2xs ${
                  department !== 'ALL'
                    ? 'bg-gray-200/50 border-indigo-300 text-blue-800 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-300/90 text-slate-900 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              >
                <option value="ALL">All Departments</option>
                {data?.filterOptions?.departments?.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* 3. EMPLOYEE TYPE */}
          <div className="space-y-2.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Employee Type
            </label>
            <div className="relative">
              <select
                value={employeeType}
                onChange={(e) => setEmployeeType(e.target.value)}
                className={`w-full py-3.5 px-4 pr-10 text-sm sm:text-base font-bold rounded-xl border transition-all cursor-pointer appearance-none shadow-2xs ${
                  employeeType !== 'ALL'
                    ? 'bg-gray-200/50 border-indigo-300 text-blue-800 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-300/90 text-slate-900 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              >
                <option value="ALL">All Types</option>
                <option value="FULL_TIME">Full-Time</option>
                <option value="PART_TIME">Part-Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* 4. COMPANY */}
          <div className="space-y-2.5">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Company
            </label>
            <div className="relative">
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={`w-full py-3.5 px-4 pr-10 text-sm sm:text-base font-bold rounded-xl border transition-all cursor-pointer appearance-none shadow-2xs ${
                  company !== 'ALL'
                    ? 'bg-gray-200/50 border-indigo-300 text-blue-800 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-300/90 text-slate-900 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              >
                <option value="ALL">All Companies</option>
                {data?.filterOptions?.companies?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOM PERIOD DATE RANGE SELECTION UI */}
        {period === 'CUSTOM' && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fadeIn bg-slate-50/70 p-5 rounded-xl border border-slate-200/80">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full py-3 px-4 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full py-3 px-4 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. 6 TOP HR & PAYROLL KPI CARDS                                      */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5 w-full min-w-0">
        {/* Card 1: Total Employees */}
        <div
          onClick={() => navigate('/employees')}
          className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between min-h-[160px] space-y-3 min-w-0 cursor-pointer group"
        >
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition">
            Total Employees
          </span>
          <div className="text-3xl font-black text-slate-900 tracking-tight truncate">
            {loading ? '...' : (data?.modelsSummary?.employeesCount || 0)}
          </div>
          <span className="text-xs font-semibold text-slate-500 group-hover:underline">View Employees →</span>
        </div>

        {/* Card 2: Active Contracts */}
        <div
          onClick={() => navigate('/contracts')}
          className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between min-h-[160px] space-y-3 min-w-0 cursor-pointer group"
        >
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition">
            Active Contracts
          </span>
          <div className="text-3xl font-black text-emerald-600 tracking-tight truncate">
            {loading ? '...' : (data?.modelsSummary?.contractsCount || 0)}
          </div>
          <span className="text-xs font-semibold text-slate-500 group-hover:underline">View Contracts →</span>
        </div>

        {/* Card 3: Attendance Health */}
        <div
          onClick={() => navigate('/attendance')}
          className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between min-h-[160px] space-y-3 min-w-0 cursor-pointer group"
        >
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition">
            Attendance Health
          </span>
          <div className="text-3xl font-black text-indigo-600 tracking-tight truncate">
            {loading ? '...' : `${data?.summaryCards?.attendanceHealthPct || 100}%`}
          </div>
          <span className="text-xs font-bold text-indigo-600">Presence Ratio</span>
        </div>

        {/* Card 4: Approved Leave */}
        <div
          onClick={() => navigate('/time-off')}
          className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between min-h-[160px] space-y-3 min-w-0 cursor-pointer group"
        >
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-amber-600 transition">
            Approved Leave
          </span>
          <div className="text-3xl font-black text-amber-600 tracking-tight truncate">
            {loading ? '...' : `${data?.summaryCards?.approvedTimeOffDays || 0} Days`}
          </div>
          <span className="text-xs font-bold text-amber-600">Time Off Requests</span>
        </div>

        {/* Card 5: Total Net Salary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between min-h-[160px] space-y-3 min-w-0">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
            Total Net Salary
          </span>
          <div className="text-2xl font-black text-slate-900 tracking-tight truncate">
            {loading ? '...' : `₹${(data?.summaryCards?.totalNetSalaryPaid || 0).toLocaleString()}`}
          </div>
          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Filtered Payslips
          </span>
        </div>

        {/* Card 6: Payroll Exceptions */}
        <div
          onClick={() => navigate('/payruns')}
          className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between min-h-[160px] space-y-3 min-w-0 cursor-pointer group"
        >
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-rose-600 transition">
            Payroll Exceptions
          </span>
          <div className="text-3xl font-black text-rose-600 tracking-tight truncate">
            {loading ? '...' : (data?.currentAlerts?.length || 0)}
          </div>
          <span className="text-xs font-semibold text-slate-500 group-hover:underline">Audit Alerts →</span>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. MIDDLE ROW — 3 SECTIONS (Bar Chart, Line Chart, Status Split/Alerts) */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full min-w-0">
        {/* Section 6: Salary Cost by Department — INTERACTIVE BAR CHART */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[460px] flex flex-col justify-between min-w-0 overflow-hidden relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Salary Cost by Department</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Click any bar to inspect headcount details</p>
            </div>
            <span className="text-xs font-bold text-blue-800 bg-gray-200 px-3 py-1.5 rounded-lg border border-indigo-100">
              Interactive Bar Chart
            </span>
          </div>

          {!barChartData ? (
            <div className="text-center py-16 text-slate-400 text-sm font-medium">
              No department salary data available.
            </div>
          ) : (
            <div className="space-y-6 min-w-0 py-2">
              {/* Interactive SVG Bar Chart Container */}
              <div className="w-full h-56 flex items-end gap-4 pt-8 pb-3 px-3 border-b border-slate-100 relative">
                {/* Floating Bar Tooltip */}
                {activeBar && (
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-lg font-semibold z-10 whitespace-nowrap">
                    {activeBar.department}: ₹{activeBar.totalCost.toLocaleString()} ({activeBar.headcount} Employee{activeBar.headcount > 1 ? 's' : ''})
                  </div>
                )}

                {barChartData.items.map((item) => {
                  const heightPct = Math.max(15, Math.round((item.totalCost / barChartData.maxVal) * 100));
                  const isHovered = activeBar?.department === item.department;

                  return (
                    <div
                      key={item.department}
                      onMouseEnter={() => setActiveBar(item)}
                      onMouseLeave={() => setActiveBar(null)}
                      onClick={() => setSelectedDeptDetail(item)}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
                    >
                      <span className={`text-xs font-bold transition whitespace-nowrap ${isHovered ? 'text-blue-800 scale-105' : 'text-blue-800 opacity-90'}`}>
                        ₹{(item.totalCost / 1000).toFixed(0)}k
                      </span>
                      <div
                        className={`w-full rounded-t-xl transition-all duration-300 shadow-xs ${
                          isHovered
                            ? 'bg-black ring-2 ring-indigo-400 ring-offset-1'
                            : 'bg-black  '
                        }`}
                        style={{ height: `${heightPct}%` }}
                      ></div>
                      <span className="text-xs font-bold text-slate-700 truncate w-full text-center mt-1 group-hover:text-blue-800">
                        {item.department}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Department Data Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {barChartData.items.slice(0, 4).map((item) => (
                  <div
                    key={item.department}
                    onClick={() => setSelectedDeptDetail(item)}
                    className="flex justify-between items-center bg-slate-50/80 hover:bg-gray-200/60 p-3 rounded-xl cursor-pointer transition border border-transparent hover:border-indigo-100"
                  >
                    <span className="font-semibold text-slate-700 truncate">{item.department}</span>
                    <span className="font-bold text-slate-900">₹{item.totalCost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400 font-medium pt-3 border-t border-slate-100">
            Dynamic database aggregation from active contracts
          </div>
        </div>

        {/* Section 7: Monthly Net Salary Trend — INTERACTIVE LINE CHART */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[460px] flex flex-col justify-between min-w-0 overflow-hidden relative">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Monthly Net Salary Trend</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Hover over nodes for exact monthly totals</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              Interactive Line Chart
            </span>
          </div>

          {!lineChartData ? (
            <div className="text-center py-16 text-slate-400 text-sm font-medium">
              No historical trend data recorded yet.
            </div>
          ) : (
            <div className="space-y-6 min-w-0 py-2">
              {/* Scaled-up SVG Line Chart with Dynamic Path & Tooltips */}
              <div className="w-full h-56 pt-4 pb-2 relative">
                {activeTrendPoint && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-lg font-semibold z-10 whitespace-nowrap">
                    {activeTrendPoint.month}: Total Net Salary ₹{activeTrendPoint.amount.toLocaleString()}
                  </div>
                )}

                <svg viewBox="0 0 460 160" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="460" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="70" x2="460" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="120" x2="460" y2="120" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Trend Path & Points */}
                  {(() => {
                    const count = lineChartData.items.length;
                    
                    if (count === 1) {
                      const item = lineChartData.items[0];
                      const y = 70;
                      return (
                        <>
                          <path d="M 40 70 L 420 70 L 420 130 L 40 130 Z" fill="url(#lineGradient)" />
                          <line x1="40" y1="70" x2="420" y2="70" stroke="#10b981" strokeWidth="4" strokeDasharray="6 6" />
                          <g
                            onMouseEnter={() => setActiveTrendPoint(item)}
                            onMouseLeave={() => setActiveTrendPoint(null)}
                            className="cursor-pointer"
                          >
                            <circle cx="230" cy={y} r="8" fill="#10b981" stroke="#ffffff" strokeWidth="3" className="hover:r-10 transition-all" />
                            <text x="230" y={y - 14} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#047857">
                              ₹{(item.amount / 1000).toFixed(0)}k
                            </text>
                            <text x="230" y="152" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#64748b">
                              {item.month}
                            </text>
                          </g>
                        </>
                      );
                    }

                    const points = lineChartData.items.map((item, idx) => {
                      const x = (idx / (count - 1)) * 400 + 30;
                      const y = 130 - (item.amount / lineChartData.maxVal) * 95;
                      return { x, y, month: item.month, amount: item.amount, original: item };
                    });

                    const pathString = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const areaString = `${pathString} L ${points[points.length - 1].x} 130 L ${points[0].x} 130 Z`;

                    return (
                      <>
                        <path d={areaString} fill="url(#lineGradient)" />
                        <path d={pathString} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        {points.map((p, i) => (
                          <g
                            key={i}
                            onMouseEnter={() => setActiveTrendPoint(p.original)}
                            onMouseLeave={() => setActiveTrendPoint(null)}
                            className="cursor-pointer"
                          >
                            <circle cx={p.x} cy={p.y} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" className="hover:r-9 transition-all" />
                            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#047857">
                              ₹{(p.amount / 1000).toFixed(0)}k
                            </text>
                            <text x={p.x} y="152" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#64748b">
                              {p.month}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Monthly Trend Data List */}
              <div className="grid grid-cols-2 gap-3 text-sm pt-2">
                {lineChartData.items.map((item) => (
                  <div
                    key={item.month}
                    onMouseEnter={() => setActiveTrendPoint(item)}
                    onMouseLeave={() => setActiveTrendPoint(null)}
                    className="flex justify-between items-center bg-slate-50/80 hover:bg-emerald-50/60 p-3 rounded-xl cursor-pointer transition border border-transparent hover:border-emerald-100"
                  >
                    <span className="font-bold text-slate-700">{item.month}</span>
                    <span className="font-extrabold text-emerald-600">₹{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400 font-medium pt-3 border-t border-slate-100">
            Plotted dynamically from database payslip history
          </div>
        </div>

        {/* Section 8: Payslip Status & Payroll Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[460px] flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">Payslip Status & Payroll Alerts</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">Click status badges to open Pay Runs workflow</p>
          </div>

          <div className="space-y-6 min-w-0">
            {/* Status Split */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block">
                Status Split
              </span>
              <div className="grid grid-cols-2 gap-4 text-center text-sm font-bold">
                <div
                  onClick={() => navigate('/payruns')}
                  className="p-4 bg-emerald-50/80 hover:bg-emerald-100/70 rounded-xl border border-emerald-200/60 cursor-pointer transition-all hover:scale-[1.02] shadow-2xs"
                >
                  <span className="text-xs text-emerald-800 uppercase font-bold block">Paid / Done</span>
                  <span className="text-2xl font-black text-emerald-700 mt-1.5 block">
                    {(data?.payslipStatusSplit?.Done || 0) + (data?.payslipStatusSplit?.Paid || 0)}
                  </span>
                </div>
                <div
                  onClick={() => navigate('/payruns')}
                  className="p-4 bg-amber-50/80 hover:bg-amber-100/70 rounded-xl border border-amber-200/60 cursor-pointer transition-all hover:scale-[1.02] shadow-2xs"
                >
                  <span className="text-xs text-amber-800 uppercase font-bold block">Draft</span>
                  <span className="text-2xl font-black text-amber-700 mt-1.5 block">
                    {data?.payslipStatusSplit?.Draft || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Alerts */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block">
                Current Alerts
              </span>
              {!data?.currentAlerts || data.currentAlerts.length === 0 ? (
                <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200/60 text-emerald-800 text-sm font-bold text-center">
                  ✓ No current payroll alerts
                </div>
              ) : (
                <div className="space-y-3 text-sm max-h-48 overflow-y-auto pr-1">
                  {data.currentAlerts.map((alert, idx) => (
                    <div key={idx} className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/60 text-amber-900 font-medium leading-relaxed flex items-start gap-3 shadow-2xs">
                      <span className="text-amber-600 font-extrabold text-base shrink-0">⚠️</span>
                      <span>{alert}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium pt-3 border-t border-slate-100">
            Real-time automated validation engine
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 5. BOTTOM ROW — 4 SECTIONS (2x2 Grid on Desktop for Spacious Cards) */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full min-w-0">
        {/* Section 9: Attendance Overview — ATTENDANCE DONUT CHART */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[380px] flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">Attendance Overview</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium font-normal">Attendance coverage & health ratio</p>
          </div>

          <div className="space-y-6 min-w-0">
            {/* SVG Attendance Donut Chart & Legend Side-by-Side */}
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="4"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeDasharray={`${attendanceDonutData.total > 0 ? Math.round((attendanceDonutData.present / attendanceDonutData.total) * 100) : 100}, 100`}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-black text-slate-900 block">{data?.summaryCards?.attendanceHealthPct || 100}%</span>
                  <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Health</span>
                </div>
              </div>

              {/* Status Breakdown Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 text-sm font-semibold min-w-0">
                <div className="flex items-center gap-2.5 text-emerald-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="whitespace-nowrap">Present: {attendanceDonutData.present}</span>
                </div>
                <div className="flex items-center gap-2.5 text-amber-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="whitespace-nowrap">Late: {attendanceDonutData.late}</span>
                </div>
                <div className="flex items-center gap-2.5 text-rose-700">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span className="whitespace-nowrap">Absent: {attendanceDonutData.absent}</span>
                </div>
                <div className="flex items-center gap-2.5 text-blue-800">
                  <span className="w-3.5 h-3.5 rounded-full bg-gray-200 shrink-0"></span>
                  <span className="whitespace-nowrap">Overtime: {attendanceDonutData.overtime}</span>
                </div>
              </div>
            </div>

            {/* Attendance Supporting Statistics */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Missing Check-outs:</span>
                <span className="font-bold text-slate-900">{data?.attendanceOverview?.missingCheckouts || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Manual Attendance Edits:</span>
                <span className="font-bold text-slate-900">{data?.attendanceOverview?.manualEdits || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Attendance Coverage:</span>
                <span className="font-bold text-emerald-600">{data?.attendanceOverview?.attendanceCoverage || 100}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 10: Time Off Overview Table */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[380px] flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">Time Off Overview</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium font-normal">Leave balance table by type</p>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-sm table-auto border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-extrabold text-xs">
                  <th className="py-3 px-3 text-left">Leave Type</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Approved</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Pending</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Remaining Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium">
                {!data?.timeOffTable || data.timeOffTable.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                      No time-off records available.
                    </td>
                  </tr>
                ) : (
                  data.timeOffTable.map((row) => (
                    <tr key={row.type} className="hover:bg-gray-200/50 transition">
                      <td className="py-3.5 px-3 font-bold text-slate-800 leading-tight">{row.type}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-blue-800 whitespace-nowrap">{row.approvedDays}d</td>
                      <td className="py-3.5 px-3 text-center text-amber-600 font-bold whitespace-nowrap">{row.pending}d</td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">{row.remainingBalance}d</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-slate-400 font-medium pt-3 border-t border-slate-100">
            Derived from TimeOffAllocations & Requests
          </div>
        </div>

        {/* Section 11: Department Overview Table */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[380px] flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">Department Overview</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium font-normal">Headcount & monthly salary breakdown</p>
          </div>

          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-sm table-auto border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-extrabold text-xs">
                  <th className="py-3 px-3 text-left">Department</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Headcount</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Monthly Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80 font-medium">
                {!data?.departmentOverview || data.departmentOverview.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 text-sm">
                      No department data available.
                    </td>
                  </tr>
                ) : (
                  data.departmentOverview.map((row) => (
                    <tr
                      key={row.department}
                      onClick={() => setSelectedDeptDetail(row)}
                      className="hover:bg-gray-200/50 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-3 font-bold text-slate-800 leading-tight">{row.department}</td>
                      <td className="py-3.5 px-3 text-center font-bold text-blue-800 whitespace-nowrap">{row.headcount}</td>
                      <td className="py-3.5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">₹{row.totalCost.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-slate-400 font-medium pt-3 border-t border-slate-100">
            Active employee headcount per department
          </div>
        </div>

        {/* Section 12: Models to Aggregate (Informational Source Card) */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-sm transition-all p-7 space-y-6 min-h-[380px] flex flex-col justify-between min-w-0 overflow-hidden">
          <div className="pb-3 border-b border-slate-100">
            <span className="text-xs font-extrabold uppercase tracking-widest text-blue-800 block">
              Prisma Data Sources
            </span>
            <h3 className="font-bold text-slate-900 text-lg mt-0.5">Models to Aggregate</h3>
          </div>

          <div className="space-y-4 text-sm text-slate-700">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Employees / Depts:</span>
              <span className="font-bold text-slate-900">{data?.modelsSummary?.employeesCount || 0} Records</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Active Contracts:</span>
              <span className="font-bold text-emerald-600">{data?.modelsSummary?.contractsCount || 0} Active</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Payruns / Payslips:</span>
              <span className="font-bold text-blue-800">{data?.modelsSummary?.payslipsCount || 0} Payslips</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Attendance Records:</span>
              <span className="font-bold text-amber-600">{data?.modelsSummary?.attendanceCount || 0} Logged</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Time Off Requests:</span>
              <span className="font-bold text-blue-800">{data?.modelsSummary?.timeoffRequestsCount || 0} Requests</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium pt-3 border-t border-slate-100">
            Integrated PostgreSQL / Prisma models
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 6. INTERACTIVE DEPARTMENT DETAIL MODAL                               */}
      {/* -------------------------------------------------------------------- */}
      {selectedDeptDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl space-y-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-blue-800">Department Inspection</span>
                <h2 className="text-2xl font-black text-slate-900">{selectedDeptDetail.department}</h2>
              </div>
              <button
                onClick={() => setSelectedDeptDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-4 bg-gray-200/70 rounded-xl border border-indigo-100 flex justify-between items-center">
                <span className="font-semibold text-blue-800">Total Department Salary:</span>
                <span className="text-xl font-black text-blue-800">₹{selectedDeptDetail.totalCost.toLocaleString()}</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-slate-700">Active Headcount:</span>
                <span className="text-xl font-black text-slate-900">{selectedDeptDetail.headcount} Employee{selectedDeptDetail.headcount > 1 ? 's' : ''}</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                <span className="font-semibold text-slate-700">Average Salary / Employee:</span>
                <span className="text-lg font-bold text-emerald-700">
                  ₹{selectedDeptDetail.headcount > 0 ? Math.round(selectedDeptDetail.totalCost / selectedDeptDetail.headcount).toLocaleString() : 0}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedDeptDetail(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
