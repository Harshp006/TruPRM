import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchSalaryStructure,
  updateSalaryStructure,
  createSalaryRule,
  updateSalaryRule,
  deleteSalaryRule,
  calculateSalaryStructure,
  type SalaryStructure,
  type SalaryRule,
  type SalaryRuleCategory,
  type RuleCalculationType,
} from '../api/hr';



const RULE_PRESETS = [
  { name: 'Basic Salary', code: 'BASIC', category: 'EARNING', sequence: 1, calculationType: 'FIXED_AMOUNT', fixedAmount: 30000, roundingRule: 'NEAREST' },
  { name: 'House Rent Allowance (HRA)', code: 'HRA', category: 'EARNING', sequence: 2, calculationType: 'PERCENTAGE', percentage: 40, baseCode: 'BASIC', roundingRule: 'NEAREST' },
  { name: 'Transport Allowance', code: 'TRANS', category: 'EARNING', sequence: 3, calculationType: 'FIXED_AMOUNT', fixedAmount: 3000, roundingRule: 'NEAREST' },
  { name: 'Medical Allowance', code: 'MED', category: 'EARNING', sequence: 4, calculationType: 'FIXED_AMOUNT', fixedAmount: 1500, roundingRule: 'NEAREST' },
  { name: 'Bonus Allowance', code: 'BONUS', category: 'EARNING', sequence: 5, calculationType: 'PERCENTAGE', percentage: 10, baseCode: 'BASIC', roundingRule: 'NEAREST' },
  { name: 'Overtime Allowance', code: 'OT', category: 'EARNING', sequence: 6, calculationType: 'FORMULA', formula: 'overtime_hours * overtime_rate', conditionType: 'HAS_OVERTIME', roundingRule: 'NEAREST' },
  { name: 'Relocation Allowance', code: 'RELOC', category: 'EARNING', sequence: 10, calculationType: 'FIXED_AMOUNT', fixedAmount: 10000, roundingRule: 'NEAREST' },
  { name: 'Provident Fund (PF)', code: 'PF', category: 'DEDUCTION', sequence: 11, calculationType: 'PERCENTAGE', percentage: 12, baseCode: 'BASIC', conditionType: 'PF_APPLICABLE', roundingRule: 'NEAREST' },
  { name: 'Leave Deduction', code: 'LEAVE_DED', category: 'DEDUCTION', sequence: 12, calculationType: 'FORMULA', formula: 'unpaid_leave_days * daily_salary', conditionType: 'HAS_UNPAID_LEAVE', roundingRule: 'CEIL' },
  { name: 'Professional Tax', code: 'PT', category: 'DEDUCTION', sequence: 13, calculationType: 'FIXED_AMOUNT', fixedAmount: 200, conditionType: 'SALARY_EXCEEDS', conditionValue: 15000, roundingRule: 'NONE' },
  { name: 'Loan Recovery', code: 'LOAN', category: 'DEDUCTION', sequence: 14, calculationType: 'FIXED_AMOUNT', fixedAmount: 5000, roundingRule: 'NONE' },
  { name: 'Salary Advance Recovery', code: 'ADVANCE', category: 'DEDUCTION', sequence: 15, calculationType: 'FIXED_AMOUNT', fixedAmount: 2000, roundingRule: 'NONE' },
  { name: 'Employer PF Contribution', code: 'EMP_PF', category: 'EMPLOYER_CONTRIBUTION', sequence: 16, calculationType: 'PERCENTAGE', percentage: 12, baseCode: 'BASIC', conditionType: 'PF_APPLICABLE', roundingRule: 'NEAREST' },
];

export default function SalaryStructureDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_PAYROLL_ADMIN';

  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Structure Details Edit Modal State
  const [isEditStructOpen, setIsEditStructOpen] = useState<boolean>(false);
  const [structName, setStructName] = useState<string>('');
  const [structCode, setStructCode] = useState<string>('');
  const [structDescription, setStructDescription] = useState<string>('');
  const [structStatus, setStructStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [structEffectiveFrom, setStructEffectiveFrom] = useState<string>('');
  const [structEffectiveTo, setStructEffectiveTo] = useState<string>('');
  const [structEditError, setStructEditError] = useState<string>('');
  const [isSavingStruct, setIsSavingStruct] = useState<boolean>(false);

  // Live Calculation Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [calcContextWage, setCalcContextWage] = useState<number>(30000);
  const [calcOvertimeHours, setCalcOvertimeHours] = useState<number>(5);
  const [calcOvertimeRate, setCalcOvertimeRate] = useState<number>(250);
  const [calcUnpaidLeaveDays, setCalcUnpaidLeaveDays] = useState<number>(1);
  const [calcDailySalary, _setCalcDailySalary] = useState<number>(1000);
  const [calcIsPf, setCalcIsPf] = useState<boolean>(true);
  const [calcResult, setCalcResult] = useState<any | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Rule Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<SalaryRule | null>(null);
  const [viewingRule, setViewingRule] = useState<SalaryRule | null>(null);

  // Rule Form State
  const [ruleName, setRuleName] = useState<string>('');
  const [ruleCode, setRuleCode] = useState<string>('');
  const [ruleCategory, setRuleCategory] = useState<SalaryRuleCategory>('EARNING');
  const [ruleSequence, setRuleSequence] = useState<number>(1);
  const [ruleCalculationType, setRuleCalculationType] = useState<RuleCalculationType>('FIXED_AMOUNT');
  const [ruleFixedAmount, setRuleFixedAmount] = useState<string>('');
  const [rulePercentage, setRulePercentage] = useState<string>('');
  const [ruleBaseCode, setRuleBaseCode] = useState<string>('BASIC');
  const [ruleFormula, setRuleFormula] = useState<string>('');
  const [ruleConditionType, setRuleConditionType] = useState<string>('ALWAYS');
  const [ruleConditionValue, setRuleConditionValue] = useState<string>('');
  const [ruleCustomCondition, setRuleCustomCondition] = useState<string>('');
  const [ruleRounding, setRuleRounding] = useState<string>('NEAREST');
  const [ruleStatus, setRuleStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  const [ruleFormError, setRuleFormError] = useState<string>('');
  const [isSubmittingRule, setIsSubmittingRule] = useState<boolean>(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchSalaryStructure(id);
      setStructure(data);
      if (data) {
        runCalculationPreview(data.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load salary structure details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const runCalculationPreview = async (structId?: string) => {
    const targetId = structId || id;
    if (!targetId) return;
    setIsCalculating(true);
    try {
      const result = await calculateSalaryStructure(targetId, {
        contractWage: Number(calcContextWage) || 0,
        overtimeHours: Number(calcOvertimeHours) || 0,
        overtimeRate: Number(calcOvertimeRate) || 0,
        unpaidLeaveDays: Number(calcUnpaidLeaveDays) || 0,
        dailySalary: Number(calcDailySalary) || 0,
        isPfApplicable: calcIsPf,
      });
      setCalcResult(result);
    } catch (err: any) {
      console.error('Calculation preview error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  const openEditStructModal = () => {
    if (!structure) return;
    setStructName(structure.name);
    setStructCode(structure.code);
    setStructDescription(structure.description || '');
    setStructStatus(structure.status);
    setStructEffectiveFrom(structure.effectiveFrom ? structure.effectiveFrom.slice(0, 10) : '');
    setStructEffectiveTo(structure.effectiveTo ? structure.effectiveTo.slice(0, 10) : '');
    setStructEditError('');
    setIsEditStructOpen(true);
  };

  const handleSaveStruct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !structure) return;
    setStructEditError('');

    if (!structName.trim()) {
      setStructEditError('Structure Name is required.');
      return;
    }
    if (!structCode.trim()) {
      setStructEditError('Structure Code / ID is required.');
      return;
    }
    if (!structEffectiveFrom) {
      setStructEditError('Effective From date is required.');
      return;
    }
    if (structEffectiveTo && new Date(structEffectiveTo) < new Date(structEffectiveFrom)) {
      setStructEditError('Effective To date cannot be earlier than Effective From date.');
      return;
    }

    setIsSavingStruct(true);
    try {
      await updateSalaryStructure(id, {
        name: structName.trim(),
        code: structCode.trim().toUpperCase(),
        description: structDescription.trim() || null,
        status: structStatus,
        effectiveFrom: new Date(structEffectiveFrom).toISOString(),
        effectiveTo: structEffectiveTo ? new Date(structEffectiveTo).toISOString() : null,
      });
      setIsEditStructOpen(false);
      setSuccessMsg('Structure details and effective period updated successfully.');
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setStructEditError(err.response?.data?.message || 'Failed to update structure details.');
    } finally {
      setIsSavingStruct(false);
    }
  };

  const applyPreset = (presetName: string) => {
    const p = RULE_PRESETS.find((preset) => preset.name === presetName);
    if (!p) return;
    setRuleName(p.name);
    setRuleCode(p.code);
    setRuleCategory(p.category as SalaryRuleCategory);
    setRuleSequence(p.sequence);
    setRuleCalculationType(p.calculationType as RuleCalculationType);
    if (p.fixedAmount !== undefined) setRuleFixedAmount(String(p.fixedAmount));
    if (p.percentage !== undefined) setRulePercentage(String(p.percentage));
    if (p.baseCode) setRuleBaseCode(p.baseCode);
    if (p.formula) setRuleFormula(p.formula);
    if (p.conditionType) setRuleConditionType(p.conditionType);
    if (p.conditionValue !== undefined) setRuleConditionValue(String(p.conditionValue));
    if (p.roundingRule) setRuleRounding(p.roundingRule);
  };

  const openAddRuleModal = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleCode('');
    setRuleCategory('EARNING');
    const nextSeq = (structure?.rules?.length ?? 0) + 1;
    setRuleSequence(nextSeq);
    setRuleCalculationType('FIXED_AMOUNT');
    setRuleFixedAmount('');
    setRulePercentage('');
    setRuleBaseCode('BASIC');
    setRuleFormula('');
    setRuleConditionType('ALWAYS');
    setRuleConditionValue('');
    setRuleCustomCondition('');
    setRuleRounding('NEAREST');
    setRuleStatus('ACTIVE');
    setRuleFormError('');
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: SalaryRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleCode(rule.code);
    setRuleCategory(rule.category);
    setRuleSequence(rule.sequence);
    setRuleCalculationType(rule.calculationType);
    setRuleFixedAmount(
      rule.fixedAmount !== null && rule.fixedAmount !== undefined
        ? String(rule.fixedAmount)
        : rule.amountFixed !== null && rule.amountFixed !== undefined
        ? String(rule.amountFixed)
        : ''
    );
    setRulePercentage(
      rule.percentage !== null && rule.percentage !== undefined
        ? String(Number(rule.percentage) <= 1 ? Number(rule.percentage) * 100 : rule.percentage)
        : rule.amountPercentage !== null && rule.amountPercentage !== undefined
        ? String(Number(rule.amountPercentage) <= 1 ? Number(rule.amountPercentage) * 100 : rule.amountPercentage)
        : ''
    );
    setRuleBaseCode(rule.baseCode || 'BASIC');
    setRuleFormula(rule.formula || '');
    setRuleConditionType(rule.conditionType || 'ALWAYS');
    setRuleConditionValue(
      rule.conditionValue !== null && rule.conditionValue !== undefined
        ? String(rule.conditionValue)
        : ''
    );
    setRuleCustomCondition(rule.condition || '');
    setRuleRounding(rule.roundingRule || 'NEAREST');
    setRuleStatus(rule.status);
    setRuleFormError('');
    setIsRuleModalOpen(true);
  };

  const closeRuleModal = () => {
    setIsRuleModalOpen(false);
    setEditingRule(null);
    setRuleFormError('');
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleFormError('');

    if (!ruleName.trim()) {
      setRuleFormError('Rule Name is required.');
      return;
    }
    if (!ruleCode.trim()) {
      setRuleFormError('Rule Code is required.');
      return;
    }

    if (ruleCalculationType === 'FIXED_AMOUNT' && !ruleFixedAmount) {
      setRuleFormError('Fixed Amount (₹) is required for FIXED_AMOUNT type.');
      return;
    }

    if (ruleCalculationType === 'PERCENTAGE' && !rulePercentage) {
      setRuleFormError('Percentage (%) is required for PERCENTAGE type.');
      return;
    }

    if (ruleCalculationType === 'FORMULA' && !ruleFormula.trim()) {
      setRuleFormError('Formula expression is required for FORMULA type.');
      return;
    }

    setIsSubmittingRule(true);
    try {
      const numericPercentage = rulePercentage
        ? Number(rulePercentage) > 1
          ? Number(rulePercentage) / 100
          : Number(rulePercentage)
        : null;

      const payload: Partial<SalaryRule> = {
        salaryStructureId: id,
        name: ruleName.trim(),
        code: ruleCode.trim().toUpperCase(),
        category: ruleCategory,
        sequence: Number(ruleSequence),
        calculationType: ruleCalculationType,
        fixedAmount: ruleCalculationType === 'FIXED_AMOUNT' ? Number(ruleFixedAmount) : null,
        percentage: ruleCalculationType === 'PERCENTAGE' ? numericPercentage : null,
        baseCode: ruleCalculationType === 'PERCENTAGE' ? ruleBaseCode || 'BASIC' : null,
        formula: ruleCalculationType === 'FORMULA' ? ruleFormula.trim() : null,
        conditionType: ruleConditionType,
        conditionValue: ruleConditionValue ? Number(ruleConditionValue) : null,
        condition: ruleCustomCondition.trim() || ruleConditionType,
        roundingRule: ruleRounding !== 'NONE' ? ruleRounding : null,
        status: ruleStatus,
      };

      if (editingRule && editingRule.id) {
        await updateSalaryRule(editingRule.id, payload);
        setSuccessMsg(`Salary rule "${ruleName}" updated successfully.`);
      } else {
        await createSalaryRule(payload);
        setSuccessMsg(`Salary rule "${ruleName}" added to structure successfully.`);
      }

      closeRuleModal();
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setRuleFormError(err.response?.data?.message || 'Failed to save salary rule.');
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const handleToggleRuleStatus = async (rule: SalaryRule) => {
    if (!rule.id) return;
    const newStatus = rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateSalaryRule(rule.id, { status: newStatus });
      setSuccessMsg(`Rule "${rule.name}" is now ${newStatus.toLowerCase()}.`);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update rule status.');
    }
  };

  const handleDeleteRule = async (rule: SalaryRule) => {
    if (!rule.id) return;
    if (!window.confirm(`Are you sure you want to delete rule "${rule.name}" (${rule.code})?`)) {
      return;
    }
    try {
      await deleteSalaryRule(rule.id);
      setSuccessMsg(`Rule "${rule.name}" deleted successfully.`);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Cannot delete rule: prefer setting status to INACTIVE if used in history.');
    }
  };

  const handleToggleStructureStatus = async () => {
    if (!structure) return;
    const newStatus = structure.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateSalaryStructure(structure.id, { status: newStatus });
      setSuccessMsg(`Structure "${structure.name}" status updated to ${newStatus}.`);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update structure status.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 space-y-3">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
        <p className="text-sm font-medium">Loading structure details & calculation rules...</p>
      </div>
    );
  }

  if (error || !structure) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Link to="/salary-structures" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          ← Back to Salary Structures
        </Link>
        <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
          <h3 className="text-lg font-bold">Error</h3>
          <p className="text-sm mt-1">{error || 'Salary structure not found.'}</p>
        </div>
      </div>
    );
  }

  const isActive = structure.status === 'ACTIVE';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/salary-structures"
          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
        >
          ← Back to Salary Structures List
        </Link>
        <button
          onClick={() => {
            setIsPreviewOpen(!isPreviewOpen);
            if (!calcResult) runCalculationPreview();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg transition"
        >
          {isPreviewOpen ? 'Hide Calculation Simulator' : '⚡ Live Calculation Simulator'}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 font-bold ml-4">×</button>
        </div>
      )}

      {/* LIVE CALCULATION SIMULATOR PANEL */}
      {isPreviewOpen && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                Rule Engine Execution Test
              </span>
              <h2 className="text-lg font-bold text-white">⚡ Live Calculation Simulator</h2>
            </div>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="text-slate-400 hover:text-white text-xl font-bold p-1"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Base Wage (₹)</label>
              <input
                type="number"
                value={calcContextWage}
                onChange={(e) => setCalcContextWage(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Overtime Hours</label>
              <input
                type="number"
                value={calcOvertimeHours}
                onChange={(e) => setCalcOvertimeHours(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">OT Rate (₹/hr)</label>
              <input
                type="number"
                value={calcOvertimeRate}
                onChange={(e) => setCalcOvertimeRate(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Unpaid Leave Days</label>
              <input
                type="number"
                value={calcUnpaidLeaveDays}
                onChange={(e) => setCalcUnpaidLeaveDays(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">PF Applicable</label>
              <select
                value={calcIsPf ? 'YES' : 'NO'}
                onChange={(e) => setCalcIsPf(e.target.value === 'YES')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => runCalculationPreview()}
              disabled={isCalculating}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
            >
              {isCalculating ? 'Computing Rules...' : 'Re-Run Rule Engine Preview'}
            </button>
          </div>

          {calcResult && (
            <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Simulated Gross</span>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">₹{(calcResult.grossSalary || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Simulated Deductions</span>
                <p className="text-lg font-bold text-rose-400 mt-0.5">₹{(calcResult.totalDeductions || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Employer Contribution</span>
                <p className="text-lg font-bold text-indigo-400 mt-0.5">₹{(calcResult.totalEmployerContribution || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Simulated Net Take-Home</span>
                <p className="text-xl font-extrabold text-white mt-0.5">₹{(calcResult.netSalary || 0).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1 & 2: STRUCTURE DETAILS & EFFECTIVE PERIOD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{structure.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                {structure.code}
              </span>
              {isActive ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ● ACTIVE
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                  ○ INACTIVE
                </span>
              )}
            </div>
            {structure.description && (
              <p className="text-sm text-slate-600 max-w-3xl">{structure.description}</p>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <button
                onClick={openEditStructModal}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              >
                Edit Structure Details
              </button>
              <button
                onClick={handleToggleStructureStatus}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  isActive
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {isActive ? 'Deactivate Structure' : 'Activate Structure'}
              </button>
            </div>
          )}
        </div>

        {/* Section 1 & 2 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-sm">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              SECTION 2 — EFFECTIVE PERIOD
            </span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {new Date(structure.effectiveFrom).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}{' '}
              –{' '}
              {structure.effectiveTo ? (
                new Date(structure.effectiveTo).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              ) : (
                <span className="text-indigo-600 font-bold">Present / Ongoing</span>
              )}
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              TOTAL RULES DEFINED
            </span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {structure.rules?.length || 0} sequence-ordered rules
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              ASSIGNED CONTRACTS
            </span>
            <span className="font-semibold text-slate-800 mt-1 block">
              {structure._count?.contracts || 0} active contracts
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3 — SALARY RULES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">SECTION 3 — SALARY RULES</h2>
            <p className="text-xs text-slate-500">
              Rules defined for structure <span className="font-semibold text-slate-700">{structure.name}</span>. Rules are executed in sequence order.
            </p>
          </div>
          {canManage && (
            <button
              onClick={openAddRuleModal}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              + Add Rule
            </button>
          )}
        </div>

        {!structure.rules || structure.rules.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-slate-600 font-medium">No salary rules defined for this structure yet.</p>
            {canManage && (
              <button
                onClick={openAddRuleModal}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                + Add Rule to Structure →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'].map((catKey) => {
              const categoryRules = (structure.rules || []).filter((r) => r.category === catKey);
              if (categoryRules.length === 0) return null;
              const title =
                catKey === 'EARNING'
                  ? 'EARNINGS'
                  : catKey === 'DEDUCTION'
                  ? 'DEDUCTIONS'
                  : 'EMPLOYER CONTRIBUTIONS';
              const headerBadgeClass =
                catKey === 'EARNING'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : catKey === 'DEDUCTION'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-indigo-100 text-indigo-800 border-indigo-300';

              return (
                <div key={catKey} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider border ${headerBadgeClass}`}>
                      {title} ({categoryRules.length})
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Rule Name</th>
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-center">Sequence</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {categoryRules.map((rule) => {
                          const ruleActive = rule.status === 'ACTIVE';

                          return (
                            <tr
                              key={rule.id || rule.code}
                              onClick={() => setViewingRule(rule)}
                              className="hover:bg-slate-50/80 transition cursor-pointer"
                            >
                              <td className="px-4 py-3 font-semibold text-slate-900">{rule.name}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                  {rule.code}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${headerBadgeClass}`}>
                                  {rule.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-indigo-600 text-xs">
                                #{rule.sequence}
                              </td>
                              <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setViewingRule(rule)}
                                  className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                                >
                                  View Details
                                </button>
                                {canManage && (
                                  <>
                                    <button
                                      onClick={() => openEditRuleModal(rule)}
                                      className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleRuleStatus(rule)}
                                      className={`px-2 py-1 text-xs font-semibold rounded ${
                                        ruleActive
                                          ? 'text-amber-700 hover:bg-amber-50'
                                          : 'text-emerald-700 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {ruleActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRule(rule)}
                                      className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Structure Details Modal */}
      {isEditStructOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Edit Structure Details & Effective Period
              </h2>
              <button
                onClick={() => setIsEditStructOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {structEditError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {structEditError}
              </div>
            )}

            <form onSubmit={handleSaveStruct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Structure Name *
                </label>
                <input
                  type="text"
                  required
                  value={structName}
                  onChange={(e) => setStructName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Structure Code / ID *
                </label>
                <input
                  type="text"
                  required
                  value={structCode}
                  onChange={(e) => setStructCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={structDescription}
                  onChange={(e) => setStructDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status *
                  </label>
                  <select
                    value={structStatus}
                    onChange={(e) => setStructStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={structEffectiveFrom}
                    onChange={(e) => setStructEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Effective To
                  </label>
                  <input
                    type="date"
                    value={structEffectiveTo}
                    onChange={(e) => setStructEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for ongoing active structures.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditStructOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStruct}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition"
                >
                  {isSavingStruct ? 'Saving...' : 'Save Structure Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingRule ? 'Edit Salary Rule' : 'Add Rule to Structure'}
              </h2>
              <button onClick={closeRuleModal} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">
                ×
              </button>
            </div>

            {/* Quick Rule Presets Dropdown */}
            {!editingRule && (
              <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl space-y-1">
                <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  ⚡ Quick Rule Template Quick-Fill
                </label>
                <select
                  onChange={(e) => e.target.value && applyPreset(e.target.value)}
                  className="w-full text-xs py-1.5 px-2.5 border border-indigo-200 rounded-lg bg-white text-indigo-950 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select a standard payroll rule template —</option>
                  {RULE_PRESETS.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      #{preset.sequence} {preset.name} ({preset.code} - {preset.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {ruleFormError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {ruleFormError}
              </div>
            )}

            <form onSubmit={handleRuleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Basic Salary, HRA, PF"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rule Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BASIC, HRA, PF"
                    value={ruleCode}
                    onChange={(e) => setRuleCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value as SalaryRuleCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="EARNING">EARNING</option>
                    <option value="DEDUCTION">DEDUCTION</option>
                    <option value="EMPLOYER_CONTRIBUTION">EMPLOYER_CONTRIBUTION</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Sequence Order *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={ruleSequence}
                    onChange={(e) => setRuleSequence(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status *
                  </label>
                  <select
                    value={ruleStatus}
                    onChange={(e) => setRuleStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Calculation Type & Input Configuration */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Calculation Type *
                  </label>
                  <div className="flex items-center gap-4">
                    {(['FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA'] as RuleCalculationType[]).map((type) => (
                      <label key={type} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="calcType"
                          value={type}
                          checked={ruleCalculationType === type}
                          onChange={() => setRuleCalculationType(type)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>

                {/* FIXED_AMOUNT Input */}
                {ruleCalculationType === 'FIXED_AMOUNT' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Fixed Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 3000.00"
                      value={ruleFixedAmount}
                      onChange={(e) => setRuleFixedAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                )}

                {/* PERCENTAGE Input */}
                {ruleCalculationType === 'PERCENTAGE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Percentage (%) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 40 (for 40%)"
                        value={rulePercentage}
                        onChange={(e) => setRulePercentage(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Based On (Component Code) *
                      </label>
                      <select
                        value={ruleBaseCode}
                        onChange={(e) => setRuleBaseCode(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      >
                        <option value="BASIC">BASIC (Basic Salary)</option>
                        {structure?.rules?.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.code} ({r.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* FORMULA Input */}
                {ruleCalculationType === 'FORMULA' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Formula Expression *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. overtime_hours * overtime_rate"
                      value={ruleFormula}
                      onChange={(e) => setRuleFormula(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-500">
                      <span>Quick Inserts:</span>
                      <button type="button" onClick={() => setRuleFormula('overtime_hours * overtime_rate')} className="text-indigo-600 hover:underline">overtime_hours * overtime_rate</button>
                      <span>|</span>
                      <button type="button" onClick={() => setRuleFormula('unpaid_leave_days * daily_salary')} className="text-indigo-600 hover:underline">unpaid_leave_days * daily_salary</button>
                      <span>|</span>
                      <button type="button" onClick={() => setRuleFormula('(BASIC + HRA) * 0.15')} className="text-indigo-600 hover:underline">(BASIC + HRA) * 0.15</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Condition Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Applicability Condition
                  </label>
                  <select
                    value={ruleConditionType}
                    onChange={(e) => setRuleConditionType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALWAYS">Always Applicable</option>
                    <option value="HAS_OVERTIME">If Employee Has Overtime</option>
                    <option value="HAS_UNPAID_LEAVE">If Unpaid Leave &gt; 0</option>
                    <option value="PF_APPLICABLE">If PF Applicable</option>
                    <option value="SALARY_EXCEEDS">If Salary Exceeds Threshold</option>
                    <option value="CUSTOM">Custom Expression</option>
                  </select>
                </div>

                {ruleConditionType === 'SALARY_EXCEEDS' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Salary Threshold (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={ruleConditionValue}
                      onChange={(e) => setRuleConditionValue(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {ruleConditionType === 'CUSTOM' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Custom Condition Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BASIC > 3000"
                      value={ruleCustomCondition}
                      onChange={(e) => setRuleCustomCondition(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Rounding Rule */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Rounding Rule
                </label>
                <select
                  value={ruleRounding}
                  onChange={(e) => setRuleRounding(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="NONE">No Rounding</option>
                  <option value="NEAREST">Round to Nearest Integer (Nearest ₹1)</option>
                  <option value="CEIL">Round Up (Ceil)</option>
                  <option value="FLOOR">Round Down (Floor)</option>
                </select>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeRuleModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRule}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition"
                >
                  {isSubmittingRule ? 'Saving...' : editingRule ? 'Update Rule' : 'Add Rule to Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Rule Detail View Modal */}
      {viewingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                  Salary Rule Detail
                </span>
                <h2 className="text-lg font-bold text-slate-900">{viewingRule.name}</h2>
              </div>
              <button
                onClick={() => setViewingRule(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Rule Code</span>
                  <span className="font-mono font-bold text-slate-800">{viewingRule.code}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Category</span>
                  <span className="font-semibold text-slate-800">{viewingRule.category}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Sequence</span>
                  <span className="font-bold text-indigo-600">#{viewingRule.sequence}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-400 uppercase">Status</span>
                  <span className={`font-semibold ${viewingRule.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {viewingRule.status}
                  </span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Parent Structure
                </span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
                  {structure.name} ({structure.code})
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Calculation Configuration
                </span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div>
                    <span className="text-slate-500 font-medium">Type: </span>
                    <span className="font-bold text-slate-800">{viewingRule.calculationType}</span>
                  </div>
                  {viewingRule.calculationType === 'FIXED_AMOUNT' && (
                    <div>
                      <span className="text-slate-500 font-medium">Fixed Amount: </span>
                      <span className="font-bold text-emerald-700">₹{(viewingRule.fixedAmount ?? viewingRule.amountFixed ?? 0).toLocaleString()}</span>
                    </div>
                  )}
                  {viewingRule.calculationType === 'PERCENTAGE' && (
                    <div>
                      <span className="text-slate-500 font-medium">Percentage: </span>
                      <span className="font-bold text-indigo-700">
                        {Number(viewingRule.percentage ?? viewingRule.amountPercentage ?? 0) <= 1
                          ? (Number(viewingRule.percentage ?? viewingRule.amountPercentage ?? 0) * 100).toFixed(1)
                          : viewingRule.percentage ?? viewingRule.amountPercentage}% of {viewingRule.baseCode || 'BASIC'}
                      </span>
                    </div>
                  )}
                  {viewingRule.calculationType === 'FORMULA' && (
                    <div>
                      <span className="text-slate-500 font-medium">Formula: </span>
                      <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-800">
                        {viewingRule.formula}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Applicability Condition
                </span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-800">
                    {viewingRule.conditionType || viewingRule.condition || 'ALWAYS'}
                  </span>
                  {viewingRule.conditionValue && (
                    <span className="ml-2 text-slate-600">(Threshold: ₹{viewingRule.conditionValue.toLocaleString()})</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Rounding Rule
                </span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800">
                  {viewingRule.roundingRule || 'NEAREST'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {canManage && (
                <button
                  onClick={() => {
                    const r = viewingRule;
                    setViewingRule(null);
                    openEditRuleModal(r);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                >
                  Edit Rule
                </button>
              )}
              <button
                onClick={() => setViewingRule(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
