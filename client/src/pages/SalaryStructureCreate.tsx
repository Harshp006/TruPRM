import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createSalaryStructure,
  type SalaryRuleCategory,
  type RuleCalculationType,
} from '../api/hr';

interface DraftRule {
  id: string; // temporary local ID
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  calculationType: RuleCalculationType;
  fixedAmount?: number | null;
  percentage?: number | null;
  baseCode?: string | null;
  formula?: string | null;
  conditionType?: string | null;
  conditionValue?: number | null;
  condition?: string | null;
  roundingRule?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

const CATEGORY_COLORS: Record<string, string> = {
  EARNING: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DEDUCTION: 'bg-rose-100 text-rose-800 border-rose-300',
  EMPLOYER_CONTRIBUTION: 'bg-indigo-100 text-indigo-800 border-indigo-300',
};

const RULE_PRESETS = [
  // EARNINGS
  { name: 'Basic Salary', code: 'BASIC', category: 'EARNING', sequence: 1, calculationType: 'FIXED_AMOUNT', fixedAmount: 50000, roundingRule: 'NEAREST' },
  { name: 'House Rent Allowance (HRA)', code: 'HRA', category: 'EARNING', sequence: 2, calculationType: 'PERCENTAGE', percentage: 40, baseCode: 'BASIC', roundingRule: 'NEAREST' },
  { name: 'Transport Allowance', code: 'TRANS', category: 'EARNING', sequence: 3, calculationType: 'FIXED_AMOUNT', fixedAmount: 3000, roundingRule: 'NEAREST' },
  { name: 'Medical Allowance', code: 'MED', category: 'EARNING', sequence: 4, calculationType: 'FIXED_AMOUNT', fixedAmount: 2500, roundingRule: 'NEAREST' },
  { name: 'Bonus Allowance', code: 'BONUS', category: 'EARNING', sequence: 5, calculationType: 'PERCENTAGE', percentage: 10, baseCode: 'BASIC', roundingRule: 'NEAREST' },
  { name: 'Overtime Allowance', code: 'OT', category: 'EARNING', sequence: 6, calculationType: 'FORMULA', formula: 'overtime_hours * overtime_rate', conditionType: 'HAS_OVERTIME', roundingRule: 'NEAREST' },
  { name: 'Communication Allowance', code: 'COMM', category: 'EARNING', sequence: 7, calculationType: 'FIXED_AMOUNT', fixedAmount: 1500, roundingRule: 'NEAREST' },
  { name: 'Internet Allowance', code: 'INET', category: 'EARNING', sequence: 8, calculationType: 'FIXED_AMOUNT', fixedAmount: 1000, roundingRule: 'NEAREST' },
  { name: 'Education Allowance', code: 'EDU', category: 'EARNING', sequence: 9, calculationType: 'FIXED_AMOUNT', fixedAmount: 2000, roundingRule: 'NEAREST' },
  { name: 'Relocation Allowance', code: 'RELO', category: 'EARNING', sequence: 10, calculationType: 'FIXED_AMOUNT', fixedAmount: 15000, roundingRule: 'NEAREST' },
  
  // DEDUCTIONS
  { name: 'Provident Fund (PF)', code: 'PF', category: 'DEDUCTION', sequence: 11, calculationType: 'PERCENTAGE', percentage: 12, baseCode: 'BASIC', conditionType: 'PF_APPLICABLE', roundingRule: 'NEAREST' },
  { name: 'Leave Deduction', code: 'LEAVE_DED', category: 'DEDUCTION', sequence: 12, calculationType: 'FORMULA', formula: 'unpaid_leave_days * daily_salary', conditionType: 'HAS_UNPAID_LEAVE', roundingRule: 'CEIL' },
  { name: 'Professional Tax', code: 'PT', category: 'DEDUCTION', sequence: 13, calculationType: 'FIXED_AMOUNT', fixedAmount: 200, conditionType: 'SALARY_EXCEEDS', conditionValue: 15000, roundingRule: 'NONE' },
  { name: 'Loan Recovery', code: 'LOAN', category: 'DEDUCTION', sequence: 14, calculationType: 'FIXED_AMOUNT', fixedAmount: 5000, conditionType: 'HAS_ACTIVE_LOAN', roundingRule: 'NONE' },
  { name: 'Salary Advance Recovery', code: 'ADV_REC', category: 'DEDUCTION', sequence: 15, calculationType: 'FIXED_AMOUNT', fixedAmount: 2500, conditionType: 'HAS_ADVANCE', roundingRule: 'NONE' },

  // EMPLOYER CONTRIBUTION
  { name: 'Employer PF Contribution', code: 'EMP_PF', category: 'EMPLOYER_CONTRIBUTION', sequence: 16, calculationType: 'PERCENTAGE', percentage: 12, baseCode: 'BASIC', conditionType: 'PF_APPLICABLE', roundingRule: 'NEAREST' },
];

export default function SalaryStructureCreate() {
  const navigate = useNavigate();

  // Section 1 & 2: Structure Details State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [effectiveTo, setEffectiveTo] = useState('');

  // Section 3: Salary Rules State (Draft Rules)
  const [rules, setRules] = useState<DraftRule[]>([]);

  // Rule Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Rule Form Inputs
  const [ruleName, setRuleName] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [ruleCategory, setRuleCategory] = useState<SalaryRuleCategory>('EARNING');
  const [ruleSequence, setRuleSequence] = useState<number>(1);
  const [ruleCalculationType, setRuleCalculationType] = useState<RuleCalculationType>('FIXED_AMOUNT');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('');
  const [rulePercentage, setRulePercentage] = useState('');
  const [ruleBaseCode, setRuleBaseCode] = useState('BASIC');
  const [ruleFormula, setRuleFormula] = useState('');
  const [ruleConditionType, setRuleConditionType] = useState('ALWAYS');
  const [ruleConditionValue, setRuleConditionValue] = useState('');
  const [ruleCustomCondition, setRuleCustomCondition] = useState('');
  const [ruleRounding, setRuleRounding] = useState('NEAREST');
  const [ruleStatus, setRuleStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Submit & Error State
  const [error, setError] = useState('');
  const [ruleFormError, setRuleFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setEditingRuleId(null);
    setRuleName('');
    setRuleCode('');
    setRuleCategory('EARNING');
    setRuleSequence(rules.length + 1);
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

  const openEditRuleModal = (rule: DraftRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setRuleCode(rule.code);
    setRuleCategory(rule.category);
    setRuleSequence(rule.sequence);
    setRuleCalculationType(rule.calculationType);
    setRuleFixedAmount(
      rule.fixedAmount !== null && rule.fixedAmount !== undefined
        ? String(rule.fixedAmount)
        : ''
    );
    setRulePercentage(
      rule.percentage !== null && rule.percentage !== undefined
        ? String(Number(rule.percentage) <= 1 ? Number(rule.percentage) * 100 : rule.percentage)
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
    setEditingRuleId(null);
    setRuleFormError('');
  };

  const handleSaveRuleModal = (e: React.FormEvent) => {
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

    const numericPercentage = rulePercentage
      ? Number(rulePercentage) > 1
        ? Number(rulePercentage) / 100
        : Number(rulePercentage)
      : null;

    const draftRule: DraftRule = {
      id: editingRuleId || `draft-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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

    if (editingRuleId) {
      setRules((prev) =>
        prev.map((r) => (r.id === editingRuleId ? draftRule : r)).sort((a, b) => a.sequence - b.sequence)
      );
    } else {
      setRules((prev) => [...prev, draftRule].sort((a, b) => a.sequence - b.sequence));
    }

    closeRuleModal();
  };

  const handleDeleteDraftRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleToggleDraftRuleStatus = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : r
      )
    );
  };

  const handleCreateStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Structure Name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Structure Code / ID is required.');
      return;
    }
    if (!effectiveFrom) {
      setError('Effective From date is required.');
      return;
    }
    if (effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
      setError('Effective To date cannot be earlier than Effective From date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        status,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
        rules: rules.map((r) => ({
          name: r.name,
          code: r.code,
          category: r.category,
          sequence: r.sequence,
          calculationType: r.calculationType,
          fixedAmount: r.fixedAmount,
          percentage: r.percentage,
          baseCode: r.baseCode,
          formula: r.formula,
          conditionType: r.conditionType,
          conditionValue: r.conditionValue,
          condition: r.condition,
          roundingRule: r.roundingRule,
          status: r.status,
        })),
      };

      const createdStructure = await createSalaryStructure(payload);
      navigate(`/salary-structures/${createdStructure.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save salary structure and rules.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <Link
            to="/salary-structures"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
          >
            ← Back to Salary Structures
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Create Salary Structure
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Define structure details, validity period, and embedded salary calculation rules in one single workflow.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleCreateStructureSubmit} className="space-y-6">
        {/* SECTION 1 — STRUCTURE DETAILS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              SECTION 1 — STRUCTURE DETAILS
            </h2>
            <p className="text-xs text-slate-500">
              Basic identification information for this compensation structure.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Structure Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Software Engineer Monthly"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                placeholder="e.g. SE-MONTHLY-001"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Monthly salary structure for software engineering employees..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* SECTION 2 — STATUS & EFFECTIVE PERIOD */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              SECTION 2 — STATUS & EFFECTIVE PERIOD
            </h2>
            <p className="text-xs text-slate-500">
              Specify active status and company applicability date range.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Effective To (Optional)
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Leave blank for ongoing active structures.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3 — SALARY RULES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                SECTION 3 — SALARY RULES
              </h2>
              <p className="text-xs text-slate-500">
                Define the earnings, deductions, and employer contribution rules for this structure before saving.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddRuleModal}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              + Add Rule
            </button>
          </div>

          {rules.length === 0 ? (
            <div className="p-8 text-center space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-sm font-semibold text-slate-700">
                No salary rules added to this structure yet.
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Click "+ Add Rule" above to define Basic, HRA, Transport, PF, Tax, and other calculation rules for this structure.
              </p>
              <button
                type="button"
                onClick={openAddRuleModal}
                className="inline-block text-xs font-bold text-indigo-600 hover:underline"
              >
                + Add Rule Now →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-center">Seq</th>
                    <th className="px-4 py-3">Rule Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rules.map((rule) => {
                    const ruleActive = rule.status === 'ACTIVE';
                    const catColor =
                      CATEGORY_COLORS[rule.category] ||
                      'bg-slate-100 text-slate-700 border-slate-300';

                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 text-center font-bold text-indigo-600 text-xs">
                          #{rule.sequence}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {rule.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                          {rule.code}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${catColor}`}
                          >
                            {rule.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditRuleModal(rule)}
                            className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleDraftRuleStatus(rule.id)}
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              ruleActive
                                ? 'text-amber-700 hover:bg-amber-50'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {ruleActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraftRule(rule.id)}
                            className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                          >
                            Remove
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

        {/* BOTTOM SAVE ACTIONS */}
        <div className="flex items-center justify-end space-x-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <Link
            to="/salary-structures"
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition"
          >
            {isSubmitting
              ? 'Saving Structure & Rules...'
              : `Save Structure & ${rules.length} Configured Rules`}
          </button>
        </div>
      </form>

      {/* Add / Edit Draft Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingRuleId ? 'Edit Draft Rule' : 'Add Rule to Structure'}
              </h2>
              <button
                type="button"
                onClick={closeRuleModal}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Quick Rule Presets Dropdown */}
            {!editingRuleId && (
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

            <form onSubmit={handleSaveRuleModal} className="space-y-4">
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setRuleName(val);
                      if (!editingRuleId) {
                        const baseCode = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                        setRuleCode(baseCode);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Rule Code (Auto)
                  </label>
                  <div className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-100 rounded-lg font-mono font-bold text-slate-700 select-none">
                    {ruleCode || '— AUTO —'}
                  </div>
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
                        {rules.map((r) => (
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
                    <option value="SALARY_EXCEEDS">Employee Salary &gt; Threshold</option>
                    <option value="STATE_EQUALS">Employee State / Location Equals</option>
                    <option value="HAS_OVERTIME">Employee Has Overtime Hours</option>
                    <option value="HAS_UNPAID_LEAVE">Employee Has Unpaid Leave Days</option>
                    <option value="PF_APPLICABLE">Statutory PF Applicable</option>
                    <option value="HAS_ACTIVE_LOAN">Employee Has Active Loan</option>
                    <option value="HAS_ADVANCE">Employee Has Salary Advance</option>
                  </select>
                </div>

                {ruleConditionType === 'SALARY_EXCEEDS' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Salary Threshold Amount (₹)
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

                {ruleConditionType === 'STATE_EQUALS' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      State / Location Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra, Karnataka"
                      value={ruleCustomCondition}
                      onChange={(e) => setRuleCustomCondition(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                >
                  {editingRuleId ? 'Update Draft Rule' : 'Add Rule to Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
