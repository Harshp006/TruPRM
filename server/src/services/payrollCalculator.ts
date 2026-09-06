import { SalaryRule, SalaryStructure } from '@prisma/client';

export interface PayrollInputContext {
  contractWage?: number;
  overtimeHours?: number;
  overtimeRate?: number;
  unpaidLeaveDays?: number;
  dailySalary?: number;
  isPfApplicable?: boolean;
  state?: string;
  [key: string]: any;
}

export interface ComputedRuleLine {
  ruleId?: string;
  code: string;
  name: string;
  category: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | string;
  sequence: number;
  calculationType: string;
  amount: number;
  baseAmount?: number;
  percentage?: number;
  formula?: string;
  condition?: string;
  roundingRule?: string;
}

export interface CalculationResult {
  structureId: string;
  structureName: string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  totalEmployerContribution: number;
  lines: ComputedRuleLine[];
  computedValuesMap: Record<string, number>;
}

/**
 * Safe evaluator for formula expressions like "overtimeHours * overtimeRate" or "(BASIC + HRA) * 0.15"
 */
export function evaluateFormula(
  formulaStr: string,
  context: Record<string, number>
): number {
  if (!formulaStr || !formulaStr.trim()) return 0;

  try {
    let sanitized = formulaStr.trim();

    // Replace known variables from context sorted by length descending to prevent partial replacement
    const keys = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      const val = context[key] ?? 0;
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      sanitized = sanitized.replace(regex, String(val));
    }

    // Only allow digits, decimals, basic operators +, -, *, /, %, (, ), spaces
    if (!/^[0-9.\s\+\-\*\/\%\(\)]+$/.test(sanitized)) {
      console.warn(`Formula contained invalid characters: "${formulaStr}" -> "${sanitized}"`);
      return 0;
    }

    // Safe Function evaluation
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (err) {
    console.error(`Error evaluating formula "${formulaStr}":`, err);
    return 0;
  }
}

/**
 * Evaluates rule condition against payroll context & computed values
 */
export function evaluateCondition(
  rule: SalaryRule,
  context: PayrollInputContext,
  computedValues: Record<string, number>
): boolean {
  // Inactive rules never run
  if (rule.status === 'INACTIVE') return false;

  const condType = rule.conditionType || 'ALWAYS';
  const customCond = rule.condition ? rule.condition.trim() : '';

  if (condType === 'ALWAYS' && (!customCond || customCond === 'ALWAYS')) {
    return true;
  }

  if (condType === 'HAS_OVERTIME') {
    return (context.overtimeHours ?? 0) > 0;
  }

  if (condType === 'HAS_UNPAID_LEAVE') {
    return (context.unpaidLeaveDays ?? 0) > 0;
  }

  if (condType === 'PF_APPLICABLE') {
    return context.isPfApplicable !== false;
  }

  if (condType === 'SALARY_EXCEEDS') {
    const threshold = Number(rule.conditionValue ?? 0);
    const basicOrWage = computedValues['BASIC'] ?? context.contractWage ?? 0;
    return basicOrWage >= threshold;
  }

  if (customCond && customCond !== 'ALWAYS') {
    // Custom condition expression e.g. "BASIC > 3000"
    const evalResult = evaluateFormula(customCond.replace('>', '-').replace('<', '-'), {
      ...computedValues,
      contractWage: context.contractWage ?? 0,
      overtimeHours: context.overtimeHours ?? 0,
      unpaidLeaveDays: context.unpaidLeaveDays ?? 0,
    });
    return evalResult !== 0;
  }

  return true;
}

/**
 * Apply rounding rule to calculated decimal amount
 */
export function applyRounding(amount: number, roundingRule?: string | null): number {
  if (!roundingRule || roundingRule === 'NONE') {
    return Math.round(amount * 100) / 100;
  }

  switch (roundingRule.toUpperCase()) {
    case 'NEAREST':
      return Math.round(amount);
    case 'FLOOR':
      return Math.floor(amount);
    case 'CEIL':
      return Math.ceil(amount);
    case 'HALF_UP':
      return Math.round(amount * 2) / 2;
    default:
      return Math.round(amount * 100) / 100;
  }
}

/**
 * Executes a full Salary Structure calculation for an employee
 */
export function calculateSalary(
  structure: SalaryStructure & { rules: SalaryRule[] },
  context: PayrollInputContext = {}
): CalculationResult {
  // Sort rules strictly by sequence ascending
  const sortedRules = [...(structure.rules || [])].sort((a, b) => a.sequence - b.sequence);

  const computedValuesMap: Record<string, number> = {
    contractWage: context.contractWage ?? 0,
    overtime_hours: context.overtimeHours ?? 0,
    overtime_rate: context.overtimeRate ?? 0,
    unpaid_leave_days: context.unpaidLeaveDays ?? 0,
    daily_salary: context.dailySalary ?? 0,
    // Pre-seed BASIC from contractWage so percentage rules can reference it
    // even before a BASIC-coded salary rule runs in sequence.
    // A rule with code=BASIC will overwrite this once it executes.
    BASIC: context.contractWage ?? 0,
    DAILY_SALARY: context.dailySalary ?? 0,
  };

  const lines: ComputedRuleLine[] = [];

  let grossSalary = 0;
  let totalDeductions = 0;
  let totalEmployerContribution = 0;

  for (const rule of sortedRules) {
    if (!evaluateCondition(rule, context, computedValuesMap)) {
      continue;
    }

    let rawAmount = 0;
    let baseAmount = 0;
    let pctVal = 0;

    if ((rule.calculationType as string) === 'EMPLOYEE_BASIC' || (rule.code === 'BASIC' && (rule.fixedAmount === null || rule.fixedAmount === undefined))) {
      rawAmount = context.contractWage ?? context.basicWage ?? 0;
      baseAmount = rawAmount;
    } else if (rule.calculationType === 'FIXED_AMOUNT') {
      const fixed = rule.fixedAmount ?? rule.amountFixed;
      rawAmount = fixed !== null && fixed !== undefined ? Number(fixed) : 0;
    } else if (rule.calculationType === 'PERCENTAGE') {
      const pct = rule.percentage ?? rule.amountPercentage;
      pctVal = pct !== null && pct !== undefined ? Number(pct) : 0;

      // Normalize percentage (e.g. 0.40 or 40)
      if (pctVal > 1) pctVal = pctVal / 100;

      // Base amount from baseCode (e.g., BASIC) or default to contractWage
      const baseCode = rule.baseCode || 'BASIC';
      baseAmount = computedValuesMap[baseCode] ?? context.contractWage ?? 0;
      rawAmount = baseAmount * pctVal;
    } else if (rule.calculationType === 'FORMULA') {
      const formulaStr = rule.formula || '';
      rawAmount = evaluateFormula(formulaStr, computedValuesMap);
    }

    const finalAmount = applyRounding(rawAmount, rule.roundingRule);

    // Save into computed map for subsequent sequence rules to use!
    computedValuesMap[rule.code] = finalAmount;

    lines.push({
      ruleId: rule.id,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      sequence: rule.sequence,
      calculationType: rule.calculationType,
      amount: finalAmount,
      baseAmount: baseAmount > 0 ? baseAmount : undefined,
      percentage: pctVal > 0 ? pctVal : undefined,
      formula: rule.formula || undefined,
      condition: rule.condition || undefined,
      roundingRule: rule.roundingRule || undefined,
    });

    if (rule.category === 'EARNING' || rule.category === 'BASIC' || rule.category === 'ALLOWANCE' || rule.category === 'GROSS') {
      grossSalary += finalAmount;
    } else if (rule.category === 'DEDUCTION') {
      totalDeductions += finalAmount;
    } else if (rule.category === 'EMPLOYER_CONTRIBUTION') {
      totalEmployerContribution += finalAmount;
    }
  }

  // Ensure computed map has GROSS, DEDUCTIONS, and NET
  computedValuesMap['GROSS'] = Math.round(grossSalary * 100) / 100;
  computedValuesMap['TOTAL_DEDUCTIONS'] = Math.round(totalDeductions * 100) / 100;
  const netSalary = Math.max(0, grossSalary - totalDeductions);
  computedValuesMap['NET'] = Math.round(netSalary * 100) / 100;

  return {
    structureId: structure.id,
    structureName: structure.name,
    grossSalary: Math.round(grossSalary * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
    totalEmployerContribution: Math.round(totalEmployerContribution * 100) / 100,
    lines,
    computedValuesMap,
  };
}

/**
 * Helper to calculate unpaid leave days for an employee in a pay period from TimeOffRequest & TimeOffType models
 */
export async function calculateUnpaidLeaveDays(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  try {
    const { prisma } = await import('../lib/prisma');
    const unpaidRequests = await prisma.timeOffRequest.findMany({
      where: {
        employeeId,
        status: { in: ['VALIDATED', 'CONFIRMED'] },
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
        timeOffType: {
          isPaid: false,
        },
      },
      select: {
        daysRequested: true,
      },
    });

    return unpaidRequests.reduce((sum, r) => sum + (r.daysRequested || 0), 0);
  } catch (err) {
    console.error('Error fetching unpaid leave days:', err);
    return 0;
  }
}

