import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  Area, AreaChart
} from 'recharts';

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}
function parseISO(s: string): Date {
  return new Date(s);
}
function differenceInDays(d1: Date, d2: Date): number {
  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}
function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

interface DashboardData {
  filterOptions: { departments: string[]; employeeTypes: string[]; companies: string[]; periods: string[]; };
  summaryCards: { totalNetSalaryPaid: number; payslipsGenerated: number; avgSalaryPerEmployee: number; approvedTimeOffDays: number; attendanceHealthPct: number; };
  salaryCostByDept: Array<{ department: string; headcount: number; totalCost: number; }>;
  monthlySalaryTrend: Array<{ month: string; amount: number; }>;
  payslipStatusSplit: { Paid: number; Done: number; Draft: number; Pending: number; };
  currentAlerts: string[];
  attendanceOverview: { present: number; late: number; absent: number; overtime: number; missingCheckouts: number; manualEdits: number; attendanceCoverage: number; };
  timeOffTable: Array<{ type: string; approvedDays: number; pending: number; remainingBalance: number; }>;
  departmentOverview: Array<{ department: string; headcount: number; totalCost: number; }>;
  recentTimeOffs: Array<{ id: string; employeeName: string; type: string; startDate: string; endDate: string; status: string; }>;
  modelsSummary: { employeesCount: number; contractsCount: number; payrunsCount: number; payslipsCount: number; attendanceCount: number; timeoffRequestsCount: number; };
}

const COLORS = ['#0052cc', '#6554C0', '#003366', '#80abe8', '#b3ccee', '#e0e8f2'];

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const canCreateStructure = user?.role === 'ADMIN' || user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Filters
  const [period] = useState<string>('ALL');
  const [startDate] = useState<string>('');
  const [endDate] = useState<string>('');
  const [department] = useState<string>('ALL');

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

      const res = await fetch(`http://localhost:5000/api/dashboard/payroll-manager?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDashboard();
  }, [token, period, startDate, endDate, department]);

  // Format data for charts
  const pieData = useMemo(() => {
    if (!data?.attendanceOverview) return [];
    return [
      { name: 'Present', value: data.attendanceOverview.present },
      { name: 'Late', value: data.attendanceOverview.late },
      { name: 'Absent', value: data.attendanceOverview.absent },
      { name: 'Overtime', value: data.attendanceOverview.overtime },
    ].filter(item => item.value > 0);
  }, [data]);

  // Gantt Chart logic for time offs
  const timelineStart = useMemo(() => {
    if (!data?.recentTimeOffs || data.recentTimeOffs.length === 0) return new Date();
    const dates = data.recentTimeOffs.map(r => parseISO(r.startDate).getTime());
    return new Date(Math.min(...dates));
  }, [data]);
  
  const timelineDays = 30; // Show 30 days window in Gantt

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-8 bg-slate-50 text-slate-900 p-6 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Strategic command center for your workforce.</p>
        </div>
        {canCreateStructure && (
          <div className="flex gap-3">
            <button onClick={() => navigate('/salary-structures/new')} className="px-4 py-2 bg-brand-primary text-white text-sm font-semibold rounded-lg shadow hover:bg-brand-secondary transition">
              + New Salary Structure
            </button>
            <button onClick={() => navigate('/payruns')} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition">
              Manage Pay Runs
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Employees', value: data?.modelsSummary?.employeesCount || 0, click: '/employees' },
          { label: 'Total Net Salary', value: `₹${(data?.summaryCards?.totalNetSalaryPaid || 0).toLocaleString()}`, click: '/payruns' },
          { label: 'Attendance Health', value: `${data?.summaryCards?.attendanceHealthPct || 100}%`, click: '/attendance' },
          { label: 'Payroll Alerts', value: data?.currentAlerts?.length || 0, click: '/payruns', alert: (data?.currentAlerts?.length || 0) > 0 }
        ].map((kpi, idx) => (
          <div key={idx} onClick={() => navigate(kpi.click)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-brand-300 cursor-pointer transition flex flex-col justify-between h-36">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</h3>
            <div className={`text-3xl font-black ${kpi.alert ? 'text-rose-500' : 'text-brand-dark'}`}>{loading ? '...' : kpi.value}</div>
            <span className="text-xs font-semibold text-brand-primary group-hover:underline">View details &rarr;</span>
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Bar Chart: Salary by Department */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Salary Cost by Department</h3>
          <div className="h-72 w-full">
            {data?.salaryCostByDept && data.salaryCostByDept.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.salaryCostByDept} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="department" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="totalCost" fill="var(--color-brand-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">No data available</div>
            )}
          </div>
        </div>

        {/* Line Chart: Monthly Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Monthly Salary Trend</h3>
          <div className="h-72 w-full">
            {data?.monthlySalaryTrend && data.monthlySalaryTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlySalaryTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand-secondary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-brand-secondary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="amount" stroke="var(--color-brand-secondary)" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Pie Chart: Attendance */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-lg text-slate-800 mb-2">Today's Attendance</h3>
          <div className="h-64 w-full relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">No data available</div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-36px]">
              <span className="text-2xl font-black text-slate-800">{data?.summaryCards?.attendanceHealthPct || 100}%</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Health</span>
            </div>
          </div>
        </div>

        {/* Gantt Chart / Timeline */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Time Off Requests Timeline</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Timeline Header (Days) */}
              <div className="flex border-b border-slate-200 pb-2 mb-4">
                <div className="w-1/4 font-semibold text-xs text-slate-500 uppercase tracking-wider">Employee</div>
                <div className="w-3/4 flex relative">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex-1 text-center text-xs text-slate-400">
                      {formatDate(addDays(timelineStart, i * 5))}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Timeline Tracks */}
              <div className="space-y-4">
                {!data?.recentTimeOffs || data.recentTimeOffs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">No recent time off requests</div>
                ) : (
                  data.recentTimeOffs.slice(0, 5).map((req) => {
                    const reqStart = parseISO(req.startDate);
                    const reqEnd = parseISO(req.endDate);
                    const offsetDays = differenceInDays(reqStart, timelineStart);
                    const durationDays = differenceInDays(reqEnd, reqStart) + 1;
                    
                    const leftPct = Math.max(0, (offsetDays / timelineDays) * 100);
                    const widthPct = Math.min(100 - leftPct, (durationDays / timelineDays) * 100);

                    // Colors based on status
                    let bgColor = 'bg-brand-primary';
                    if (req.status === 'APPROVED' || req.status === 'VALIDATED') bgColor = 'bg-emerald-500';
                    if (req.status === 'REFUSED') bgColor = 'bg-rose-500';
                    if (req.status === 'DRAFT') bgColor = 'bg-slate-400';

                    return (
                      <div key={req.id} className="flex items-center group">
                        <div className="w-1/4 pr-4 truncate">
                          <div className="font-semibold text-sm text-slate-800 truncate">{req.employeeName}</div>
                          <div className="text-xs text-slate-500 truncate">{req.type}</div>
                        </div>
                        <div className="w-3/4 relative h-8 bg-slate-50 rounded border border-slate-100">
                          {leftPct <= 100 && (
                            <div 
                              className={`absolute h-full rounded-md shadow-sm flex items-center px-2 text-white text-xs font-bold whitespace-nowrap overflow-hidden transition-all ${bgColor}`}
                              style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
                              title={`${req.employeeName} - ${req.type} (${req.status})`}
                            >
                              {widthPct > 5 && req.status}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-6 text-center">
                <button onClick={() => navigate('/time-off')} className="text-sm font-semibold text-brand-primary hover:underline">
                  View all requests &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
