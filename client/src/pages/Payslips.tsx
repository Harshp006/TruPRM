import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchPayslips,
  fetchPayslip,
  getPayslipPdfUrl,
  type PayslipDetail,
} from '../api/payroll';

export default function PayslipsPage() {
  const { id: routePayslipId } = useParams();
  const navigate = useNavigate();

  const [payslips, setPayslips] = useState<any[]>([]);
  const [detail, setDetail] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await fetchPayslips();
      setPayslips(data);
    } catch (err) {
      console.error('Failed to load payslips:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchPayslip(id);
      setDetail(data);
    } catch (err) {
      console.error('Failed to load payslip detail:', err);
      navigate('/payroll/payslips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routePayslipId) {
      loadDetail(routePayslipId);
    } else {
      loadList();
    }
  }, [routePayslipId]);

  // ──────────────────────────────────────────────────────────
  // VIEW: PAYSLIP DETAIL & PDF DOWNLOAD
  // ──────────────────────────────────────────────────────────
  if (routePayslipId && detail) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Back */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/payroll/payslips')}
              className="text-sm text-indigo-600 hover:underline mb-2 block font-medium"
            >
              ← Back to All Payslips
            </button>
            <h1 className="text-2xl font-bold text-slate-800">
              Payslip: {detail.employee.firstName} {detail.employee.lastName}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {detail.payrunName} · Period {new Date(detail.periodStart).toLocaleDateString()} —{' '}
              {new Date(detail.periodEnd).toLocaleDateString()}
            </p>
          </div>

          <a
            href={getPayslipPdfUrl(detail.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition inline-flex items-center gap-2"
          >
            <span>🖨️ Download / Print PDF</span>
          </a>
        </div>

        {/* Employee & Payrun Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400">Employee Details</h3>
            <div className="text-base font-bold text-slate-800">
              {detail.employee.firstName} {detail.employee.lastName}
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Employee ID: <strong className="text-slate-700">#{detail.employee.employeeNumber}</strong></div>
              <div>Department: <strong className="text-slate-700">{detail.employee.department || 'N/A'}</strong></div>
              <div>Position: <strong className="text-slate-700">{detail.employee.jobTitle}</strong></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400">Payroll Calculation Details</h3>
            <div className="text-base font-bold text-slate-800">{detail.salaryStructure}</div>
            <div className="text-xs text-slate-500 space-y-1">
              <div>Worked Days: <strong className="text-slate-700">{detail.workedDays} Days</strong></div>
              <div>Payrun Cycle: <strong className="text-slate-700">{detail.payrunName}</strong></div>
              <div>Status: <strong className="text-green-600">Calculated from Real Database Rules</strong></div>
            </div>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Basic Salary</span>
            <p className="text-xl font-bold text-slate-800 mt-1">
              ${Number(detail.basicWage).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Gross Earnings</span>
            <p className="text-xl font-bold text-slate-800 mt-1">
              ${Number(detail.grossWage).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Deductions</span>
            <p className="text-xl font-bold text-red-600 mt-1">
              -${Number(detail.totalDeductions).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Net Salary</span>
            <p className="text-xl font-bold text-indigo-600 mt-1">
              ${Number(detail.netWage).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Detailed Salary Rule Lines Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800">Itemized Salary Breakdown (From Prisma DB)</h3>
          </div>

          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Code</th>
                <th className="px-5 py-3 text-left">Rule Description</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-right">Rate / Quantity</th>
                <th className="px-5 py-3 text-right">Computed Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {detail.lines && detail.lines.length > 0 ? (
                detail.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 text-xs">{line.code}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{line.name}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          line.category === 'BASIC'
                            ? 'bg-blue-100 text-blue-800'
                            : line.category === 'ALLOWANCE'
                            ? 'bg-green-100 text-green-800'
                            : line.category === 'DEDUCTION'
                            ? 'bg-red-100 text-red-800'
                            : line.category === 'GROSS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {line.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                      {line.quantity} × ${Number(line.rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                      ${Number(line.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No computed lines found. Compute the payrun to generate salary breakdown lines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW: ALL PAYSLIPS LIST
  // ──────────────────────────────────────────────────────────
  const filtered = payslips.filter(
    (ps) =>
      ps.employee?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      ps.employee?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      ps.payrun?.name?.toLowerCase().includes(search.toLowerCase()) ||
      ps.employee?.employeeNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">All Employee Payslips</h1>
        <p className="text-sm text-slate-500 mt-1">
          Historical salary statements, line item breakdowns, and printable PDF documents
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <input
          type="text"
          placeholder="Search payslips by employee name, payrun, or employee number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <div className="text-xs text-slate-400 font-medium">Real Database Records</div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading payslips from database...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No payslip records found.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Employee', 'Payrun', 'Period', 'Basic Salary', 'Gross Salary', 'Net Payable', 'Structure', 'Actions'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((ps) => (
                <tr key={ps.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : '—'}
                    <div className="text-xs text-slate-400 font-normal">#{ps.employee?.employeeNumber}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700 font-medium">{ps.payrun?.name}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {new Date(ps.periodStart).toLocaleDateString()} — {new Date(ps.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-slate-700">${Number(ps.basicWage).toLocaleString()}</td>
                  <td className="px-5 py-4 text-slate-700 font-medium">${Number(ps.grossWage || ps.basicWage).toLocaleString()}</td>
                  <td className="px-5 py-4 font-bold text-indigo-600">
                    ${Number(ps.netWage || ps.grossWage || ps.basicWage).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {ps.salaryStructure?.name || 'Standard'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/payroll/payslips/${ps.id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 px-2.5 py-1 rounded"
                      >
                        Inspect →
                      </button>
                      <a
                        href={getPayslipPdfUrl(ps.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-slate-900 text-xs font-medium"
                      >
                        PDF 🖨️
                      </a>
                    </div>
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
