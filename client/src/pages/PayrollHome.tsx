import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    status?: 'DRAFT' | 'PASSED' | 'FAILED' | 'COMPUTED' | 'LOCKED';
    statusMessage?: string | null;
    employee: {
      firstName: string;
      lastName: string;
      employeeNumber: string;
    };
  }>;
}

export default function PayrollHome() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOperationalData = async () => {
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
      console.error('Failed to load operational payruns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOperationalData();
    }
  }, [token]);

  // Derived Operational Metrics
  const activePayrun = payruns.find((p) => p.state !== 'DONE' && p.state !== 'PAID' && p.state !== 'CANCELLED');
  const draftPayruns = payruns.filter((p) => p.state === 'DRAFT');
  const validationErrorPayruns = payruns.filter((p) => p.state === 'VALIDATION_ERROR');
  const awaitingValidationPayruns = payruns.filter((p) => p.state === 'DRAFT' || p.state === 'VALIDATING');
  const finalizedPayruns = payruns.filter((p) => p.state === 'DONE' || p.state === 'PAID');
  
  const totalEmployeesProcessed = payruns.reduce((acc, pr) => acc + (pr._count?.payslips || pr.payslips?.length || 0), 0);
  const totalPayslipsGenerated = finalizedPayruns.reduce((acc, pr) => acc + (pr._count?.payslips || pr.payslips?.length || 0), 0);

  // Extract all validation warning exceptions from payruns
  const validationExceptions: Array<{ payrunName: string; employeeName: string; message: string }> = [];
  payruns.forEach((pr) => {
    pr.payslips?.forEach((ps) => {
      if (ps.status === 'FAILED' && ps.statusMessage) {
        validationExceptions.push({
          payrunName: pr.name,
          employeeName: `${ps.employee.firstName} ${ps.employee.lastName} (${ps.employee.employeeNumber})`,
          message: ps.statusMessage,
        });
      }
    });
  });

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'DONE':
      case 'PAID':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">PAYSLIP GENERATED</span>;
      case 'VALIDATED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">VALIDATED</span>;
      case 'COMPUTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">COMPUTED</span>;
      case 'VALIDATION_ERROR':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">VALIDATION ERROR</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">DRAFT</span>;
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-8 bg-white text-slate-900 p-4 min-h-screen">
      {/* -------------------------------------------------------------------- */}
      {/* 1. OPERATIONAL WORKSPACE HEADER & QUICK ACTIONS                       */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
              {user?.role === 'HR_PAYROLL_USER' ? 'HR Payroll Operational Workspace' : 'Payroll User Workspace'}
            </span>
            <span className="text-xs text-slate-500 font-medium">● Daily Work Queue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            What payroll work needs attention today?
          </h1>
          <p className="text-slate-500 text-sm max-w-3xl leading-relaxed">
            Execute active pay runs, resolve pre-check validation errors, compute employee wages, and issue finalized payslips.
          </p>
        </div>

        {/* Operational Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/payruns')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition"
          >
            + Create Pay Run
          </button>
          <button
            onClick={() => navigate('/payruns')}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition"
          >
            View Pay Runs ({payruns.length})
          </button>
          <button
            onClick={() => navigate('/payslips')}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition"
          >
            View Payslips
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. OPERATIONAL SUMMARY METRICS (NO ANALYTICS GRAPHS)                */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Card 1: Current Pay Run */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Current Pay Run</span>
          <div className="text-lg font-black text-slate-900 truncate">
            {activePayrun ? activePayrun.name : 'No Active Cycle'}
          </div>
          <span className="text-xs font-bold text-indigo-600">
            {activePayrun ? activePayrun.state.replace('_', ' ') : 'All cycles finalized'}
          </span>
        </div>

        {/* Card 2: Draft Pay Runs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Draft Pay Runs</span>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : draftPayruns.length}
          </div>
          <span className="text-xs font-medium text-slate-500">Awaiting pre-check</span>
        </div>

        {/* Card 3: Awaiting Validation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Awaiting Validation</span>
          <div className="text-2xl font-black text-blue-700">
            {loading ? '...' : awaitingValidationPayruns.length}
          </div>
          <span className="text-xs font-bold text-blue-700">Needs pre-check run</span>
        </div>

        {/* Card 4: Validation Errors */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Validation Errors</span>
          <div className="text-2xl font-black text-amber-700">
            {loading ? '...' : validationErrorPayruns.length}
          </div>
          <span className="text-xs font-bold text-amber-700">Requires setup fix</span>
        </div>

        {/* Card 5: Payslips Generated */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Payslips Generated</span>
          <div className="text-2xl font-black text-emerald-700">
            {loading ? '...' : totalPayslipsGenerated}
          </div>
          <span className="text-xs font-bold text-emerald-700">Issued & printable</span>
        </div>

        {/* Card 6: Employees Processed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Employees Processed</span>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : totalEmployeesProcessed}
          </div>
          <span className="text-xs font-medium text-slate-500">Staff payroll total</span>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. ACTIVE PAYROLL WORK QUEUE & VALIDATION EXCEPTIONS                */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Active & Recent Pay Runs Work Queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pay Runs Work Queue</h2>
              <p className="text-xs text-slate-500 font-medium">Select a pay run to validate, compute, or generate payslips</p>
            </div>
            <button
              onClick={() => navigate('/payruns')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              Open Pay Runs Workspace →
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading work queue...</div>
          ) : payruns.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No pay runs found in the database.</div>
          ) : (
            <div className="space-y-3">
              {payruns.map((pr) => (
                <div
                  key={pr.id}
                  onClick={() => navigate('/payruns')}
                  className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 rounded-xl transition cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{pr.name}</span>
                      {getStatusBadge(pr.state)}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                      Period: {new Date(pr.periodStart).toLocaleDateString()} &ndash; {new Date(pr.periodEnd).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold shrink-0">
                    <span className="text-slate-600">
                      {pr._count?.payslips || pr.payslips?.length || 0} Staff
                    </span>
                    <span className="text-slate-900">
                      ₹{(pr.totalNet || 0).toLocaleString()}
                    </span>
                    <span className="text-indigo-600 hover:underline">Process →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Validation Exceptions Requiring Attention */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Pre-Check Exceptions</h2>
                <p className="text-xs text-slate-500 font-medium">Validation errors blocking payslip generation</p>
              </div>
              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-extrabold">
                {validationExceptions.length} Action Items
              </span>
            </div>

            {validationExceptions.length === 0 ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800 text-xs font-bold">
                ✓ No active validation errors blocking payroll. All checked employees are eligible!
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {validationExceptions.map((ex, idx) => (
                  <div key={idx} className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-amber-900 flex justify-between">
                      <span>{ex.employeeName}</span>
                      <span className="text-[10px] text-amber-700 uppercase font-extrabold">{ex.payrunName}</span>
                    </div>
                    <div className="text-amber-800 font-medium leading-relaxed">{ex.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-400 font-medium">
            Pre-check rules enforce bank details, structure setup, and positive Net Pay.
          </div>
        </div>
      </div>
    </div>
  );
}
