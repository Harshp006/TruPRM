import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchPayruns,
  fetchPayrun,
  previewPayrunEmployees,
  createPayrun,
  computePayrun,
  validatePayrun,
  markPayrunPaid,
  sendPayslips,
  fetchSalaryStructures,
  type Payrun,
  type PreviewResult,
  type SalaryStructure,
} from '../api/payroll';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT: { label: 'Draft', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  COMPUTED: { label: 'Computed', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  VALIDATED: { label: 'Validated', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  PAID: { label: 'Paid', badge: 'bg-green-100 text-green-800 border-green-300' },
};

export default function PayrunsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePayrunId = searchParams.get('id');
  const isWizardMode = searchParams.get('mode') === 'new';

  // Can mark paid is strictly restricted from HR_PAYROLL_USER
  const canMarkPaid = user?.role === 'ADMIN' || user?.role === 'HR_PAYROLL_ADMIN' || user?.role === 'HR_MANAGER';

  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [currentPayrun, setCurrentPayrun] = useState<Payrun | null>(null);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Wizard State (Step 1 & Step 2)
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardName, setWizardName] = useState('');
  const [wizardStructureId, setWizardStructureId] = useState('');
  const [wizardStartDate, setWizardStartDate] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [wizardEndDate, setWizardEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [wizardPreview, setWizardPreview] = useState<PreviewResult | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [wizardSearch, setWizardSearch] = useState('');
  const [wizardError, setWizardError] = useState('');

  const loadPayrunsList = async () => {
    setLoading(true);
    try {
      const [pData, sData] = await Promise.all([fetchPayruns(), fetchSalaryStructures()]);
      setPayruns(pData);
      setStructures(sData);
      if (sData.length > 0 && !wizardStructureId) {
        setWizardStructureId(sData[0].id);
      }
    } catch (err) {
      console.error('Failed to load payruns:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPayrunDetail = async (id: string) => {
    setLoading(true);
    try {
      const p = await fetchPayrun(id);
      setCurrentPayrun(p);
    } catch (err) {
      console.error('Failed to load payrun detail:', err);
      setSearchParams({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activePayrunId) {
      loadPayrunDetail(activePayrunId);
    } else {
      loadPayrunsList();
    }
  }, [activePayrunId, isWizardMode]);

  // Wizard Step 1 -> Step 2
  const handlePreviewEmployees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardStartDate || !wizardEndDate) {
      setWizardError('Start and end dates are required');
      return;
    }

    setWizardError('');
    setActionLoading(true);
    try {
      const preview = await previewPayrunEmployees({
        salaryStructureId: wizardStructureId || undefined,
        periodStart: wizardStartDate,
        periodEnd: wizardEndDate,
      });
      setWizardPreview(preview);
      // Auto-select eligible employees
      const eligibleIds = preview.employees.filter((emp) => emp.isEligible).map((emp) => emp.employeeId);
      setSelectedEmpIds(eligibleIds);
      if (!wizardName) {
        const monthName = new Date(wizardStartDate).toLocaleString('default', { month: 'long', year: 'numeric' });
        setWizardName(`${monthName} Payroll Payrun`);
      }
      setWizardStep(2);
    } catch (err: any) {
      setWizardError(err.response?.data?.message || 'Failed to preview eligible employees');
    } finally {
      setActionLoading(false);
    }
  };

  // Wizard Step 2 -> Create Payrun
  const handleCreatePayrun = async () => {
    if (!wizardName || selectedEmpIds.length === 0) {
      setWizardError('Name and at least one employee must be selected');
      return;
    }

    setWizardError('');
    setActionLoading(true);
    try {
      const created = await createPayrun({
        name: wizardName,
        salaryStructureId: wizardStructureId || undefined,
        periodStart: wizardStartDate,
        periodEnd: wizardEndDate,
        employeeIds: selectedEmpIds,
      });
      setSearchParams({ id: created.id });
    } catch (err: any) {
      setWizardError(err.response?.data?.message || 'Failed to create payrun');
    } finally {
      setActionLoading(false);
    }
  };

  // Payrun Action handlers
  const handleCompute = async () => {
    if (!currentPayrun) return;
    setActionLoading(true);
    try {
      await computePayrun(currentPayrun.id);
      await loadPayrunDetail(currentPayrun.id);
    } catch (err) {
      alert('Compute payrun failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!currentPayrun) return;
    setActionLoading(true);
    try {
      await validatePayrun(currentPayrun.id);
      await loadPayrunDetail(currentPayrun.id);
    } catch (err) {
      alert('Validate payrun failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!currentPayrun) return;
    if (!window.confirm('Are you sure you want to mark this payrun as PAID?')) return;
    setActionLoading(true);
    try {
      await markPayrunPaid(currentPayrun.id);
      await loadPayrunDetail(currentPayrun.id);
    } catch (err) {
      alert('Mark paid failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendPayslips = async () => {
    if (!currentPayrun) return;
    setActionLoading(true);
    try {
      await sendPayslips(currentPayrun.id);
      alert('Payslips sent to employees successfully!');
    } catch (err) {
      alert('Send payslips failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // VIEW: 2-STEP NEW PAYRUN WIZARD
  // ──────────────────────────────────────────────────────────
  if (isWizardMode) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">New Payrun Wizard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Step {wizardStep} of 2: {wizardStep === 1 ? 'Configure Pay Period & Structure' : 'Review & Select Eligible Employees'}
            </p>
          </div>
          <button
            onClick={() => setSearchParams({})}
            className="text-sm text-slate-500 hover:text-slate-800 font-medium"
          >
            ← Cancel & Return
          </button>
        </div>

        {/* Wizard Progress Bar */}
        <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
          <div
            className={`p-3 rounded-xl border flex items-center gap-3 ${
              wizardStep === 1
                ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
              1
            </span>
            <span>1. Period & Structure</span>
          </div>
          <div
            className={`p-3 rounded-xl border flex items-center gap-3 ${
              wizardStep === 2
                ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs">
              2
            </span>
            <span>2. Select Employees & Review</span>
          </div>
        </div>

        {wizardStep === 1 ? (
          /* STEP 1: CONFIGURATION (DOES NOT PERSIST TO DB) */
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <form onSubmit={handlePreviewEmployees} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payrun Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. September 2026 Monthly Payroll"
                  value={wizardName}
                  onChange={(e) => setWizardName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Period Start Date *</label>
                  <input
                    type="date"
                    value={wizardStartDate}
                    onChange={(e) => setWizardStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Period End Date *</label>
                  <input
                    type="date"
                    value={wizardEndDate}
                    onChange={(e) => setWizardEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Salary Structure</label>
                <select
                  value={wizardStructureId}
                  onChange={(e) => setWizardStructureId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">— Use Employee Contract Structure —</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              {wizardError && <p className="text-sm text-red-600">{wizardError}</p>}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {actionLoading ? 'Scanning Employees...' : 'Continue to Employee Selection →'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* STEP 2: EMPLOYEE SELECTION & WARNINGS CHECK */
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Search eligible employees..."
                value={wizardSearch}
                onChange={(e) => setWizardSearch(e.target.value)}
                className="w-72 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <div className="text-sm font-medium text-slate-600">
                Selected: <strong className="text-indigo-600">{selectedEmpIds.length}</strong> /{' '}
                {wizardPreview?.employees.length ?? 0}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          wizardPreview?.employees.length === selectedEmpIds.length &&
                          selectedEmpIds.length > 0
                        }
                        onChange={(e) => {
                          if (e.target.checked && wizardPreview) {
                            setSelectedEmpIds(wizardPreview.employees.map((emp) => emp.employeeId));
                          } else {
                            setSelectedEmpIds([]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Wage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Structure</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {wizardPreview?.employees
                    .filter(
                      (emp) =>
                        emp.firstName.toLowerCase().includes(wizardSearch.toLowerCase()) ||
                        emp.lastName.toLowerCase().includes(wizardSearch.toLowerCase()) ||
                        emp.employeeNumber.toLowerCase().includes(wizardSearch.toLowerCase())
                    )
                    .map((emp) => {
                      const isSelected = selectedEmpIds.includes(emp.employeeId);
                      return (
                        <tr key={emp.employeeId} className={isSelected ? 'bg-indigo-50/30' : ''}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedEmpIds((prev) => [...prev, emp.employeeId]);
                                } else {
                                  setSelectedEmpIds((prev) => prev.filter((id) => id !== emp.employeeId));
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="text-xs text-slate-400">#{emp.employeeNumber}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {emp.contract ? `$${Number(emp.contract.wageAmount).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {emp.contract?.salaryStructure || 'Standard'}
                          </td>
                          <td className="px-4 py-3">
                            {emp.warnings.length > 0 ? (
                              <div className="space-y-1">
                                {emp.warnings.map((w, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-1 ${
                                      w.severity === 'ERROR'
                                        ? 'bg-red-100 text-red-700'
                                        : w.severity === 'WARNING'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}
                                  >
                                    {w.message}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-green-600 text-xs font-medium">✓ Ready</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {wizardError && <p className="text-sm text-red-600">{wizardError}</p>}

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                ← Back to Step 1
              </button>
              <button
                type="button"
                onClick={handleCreatePayrun}
                disabled={actionLoading || selectedEmpIds.length === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {actionLoading ? 'Creating Payrun...' : 'Create & Persist Payrun →'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW: PAYRUN DETAIL VIEW
  // ──────────────────────────────────────────────────────────
  if (activePayrunId && currentPayrun) {
    const statusMeta = STATUS_CONFIG[currentPayrun.status] || STATUS_CONFIG.DRAFT;

    return (
      <div className="space-y-6">
        {/* Detail Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => setSearchParams({})}
              className="text-sm text-indigo-600 hover:underline mb-2 block font-medium"
            >
              ← Back to Payruns List
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{currentPayrun.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusMeta.badge}`}>
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Period: {new Date(currentPayrun.periodStart).toLocaleDateString()} —{' '}
              {new Date(currentPayrun.periodEnd).toLocaleDateString()}
            </p>
          </div>

          {/* Role-Aware Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {currentPayrun.status === 'DRAFT' && (
              <button
                onClick={handleCompute}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {actionLoading ? 'Computing...' : 'Compute Payrun'}
              </button>
            )}

            {currentPayrun.status === 'COMPUTED' && (
              <>
                <button
                  onClick={handleCompute}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  {actionLoading ? 'Recomputing...' : 'Recompute'}
                </button>
                <button
                  onClick={handleValidate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {actionLoading ? 'Validating...' : 'Validate Payrun'}
                </button>
              </>
            )}

            {currentPayrun.status === 'VALIDATED' && (
              <>
                <button
                  onClick={handleSendPayslips}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  Send Payslips
                </button>
                {/* Mark Paid: ONLY for HR Payroll Manager / Admin */}
                {canMarkPaid && (
                  <button
                    onClick={handleMarkPaid}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    Mark Paid
                  </button>
                )}
              </>
            )}

            {currentPayrun.status === 'PAID' && (
              <span className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200">
                ✓ Payrun Fully Settled
              </span>
            )}
          </div>
        </div>

        {/* Financial Metrics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Basic</span>
            <p className="text-xl font-bold text-slate-800 mt-1">
              ${(currentPayrun.totalBasic || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Gross Earnings</span>
            <p className="text-xl font-bold text-slate-800 mt-1">
              ${(currentPayrun.totalGross || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Deductions</span>
            <p className="text-xl font-bold text-red-600 mt-1">
              -${(currentPayrun.totalDeductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Net Payable</span>
            <p className="text-xl font-bold text-indigo-600 mt-1">
              ${(currentPayrun.totalNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Warnings Banner if any */}
        {currentPayrun.warnings && currentPayrun.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2">
            <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              ⚠️ Payroll Computation Warnings ({currentPayrun.warnings.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {currentPayrun.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-amber-900 bg-amber-100/50 p-2 rounded">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                      w.severity === 'ERROR' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'
                    }`}
                  >
                    {w.severity}
                  </span>
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payslips Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Generated Payslips ({currentPayrun.payslips?.length || 0})</h3>
            <span className="text-xs text-slate-400">Click a payslip to view line breakdown and PDF</span>
          </div>

          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Employee', 'Worked Days', 'Basic Wage', 'Gross Wage', 'Net Wage', 'Lines', 'Warnings', 'Action'].map(
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
              {currentPayrun.payslips?.map((ps) => (
                <tr key={ps.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800">
                      {ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : '—'}
                    </div>
                    <div className="text-xs text-slate-400">
                      #{ps.employee?.employeeNumber} · {ps.employee?.department || 'General'}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 font-medium">{ps.workedDays} days</td>
                  <td className="px-5 py-4 text-slate-700">${Number(ps.basicWage).toLocaleString()}</td>
                  <td className="px-5 py-4 text-slate-700 font-semibold">${Number(ps.grossWage).toLocaleString()}</td>
                  <td className="px-5 py-4 font-bold text-indigo-600">${Number(ps.netWage).toLocaleString()}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{ps.linesCount || 7} lines</td>
                  <td className="px-5 py-4">
                    {ps.warnings && ps.warnings.length > 0 ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        {ps.warnings.length} warning(s)
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">✓ Clean</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => navigate(`/payroll/payslips/${ps.id}`)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 px-2.5 py-1 rounded"
                    >
                      Open Payslip →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW: PAYRUNS LIST
  // ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payroll Payruns</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage company salary calculation cycles, computation rules, and payslip generation
          </p>
        </div>
        <button
          onClick={() => {
            setWizardStep(1);
            setSearchParams({ mode: 'new' });
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          + New Payrun
        </button>
      </div>

      {/* Payruns List */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading payruns from database...
        </div>
      ) : payruns.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          No payruns found in database. Create your first payrun above.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Payrun Name', 'Period', 'Employees', 'Status', 'Total Basic', 'Total Gross', 'Total Net', 'Actions'].map(
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
              {payruns.map((p) => {
                const statusMeta = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4 font-semibold text-slate-800">{p.name}</td>
                    <td className="px-5 py-4 text-slate-600 text-xs">
                      {new Date(p.periodStart).toLocaleDateString()} — {new Date(p.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{p.employeeCount} staff</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">
                      ${(p.totalBasic || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">
                      ${(p.totalGross || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 font-bold text-indigo-600">
                      ${(p.totalNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSearchParams({ id: p.id })}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 px-3 py-1 rounded"
                      >
                        Open Payrun →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
