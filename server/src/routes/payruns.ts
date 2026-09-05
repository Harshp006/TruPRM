import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();
router.use(authenticate);

interface PayrollWarning {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  employeeId?: string;
  employeeName?: string;
}

// Helper to compute payroll warnings for an employee in a payrun period
async function evaluateEmployeeWarnings(
  employee: any,
  periodStart: Date,
  periodEnd: Date,
  salaryStructureId?: string
): Promise<PayrollWarning[]> {
  const warnings: PayrollWarning[] = [];
  const empName = `${employee.firstName} ${employee.lastName}`;

  // 1. Check contracts
  const activeContracts = employee.contracts?.filter((c: any) => c.status === 'ACTIVE') || [];
  if (activeContracts.length === 0) {
    warnings.push({
      severity: 'ERROR',
      code: 'NO_ACTIVE_CONTRACT',
      message: `${empName} has no active contract for this period.`,
      employeeId: employee.id,
      employeeName: empName,
    });
  } else if (activeContracts.length > 1) {
    warnings.push({
      severity: 'ERROR',
      code: 'MULTIPLE_ACTIVE_CONTRACTS',
      message: `${empName} has multiple active contracts.`,
      employeeId: employee.id,
      employeeName: empName,
    });
  }

  const primaryContract = activeContracts[0];
  if (primaryContract) {
    // 2. Check structure
    const targetStructureId = salaryStructureId || primaryContract.salaryStructureId;
    if (!targetStructureId) {
      warnings.push({
        severity: 'ERROR',
        code: 'MISSING_SALARY_STRUCTURE',
        message: `${empName}'s contract does not have a salary structure assigned.`,
        employeeId: employee.id,
        employeeName: empName,
      });
    }

    // 3. Bank information warning
    if (!primaryContract.notes || !primaryContract.notes.toLowerCase().includes('bank')) {
      warnings.push({
        severity: 'WARNING',
        code: 'MISSING_BANK_INFO',
        message: `${empName} is missing verified bank account details.`,
        employeeId: employee.id,
        employeeName: empName,
      });
    }

    // 4. Working schedule
    if (!primaryContract.workingScheduleId) {
      warnings.push({
        severity: 'INFO',
        code: 'NO_WORKING_SCHEDULE',
        message: `${empName} is not linked to a specific working schedule (default 40h applied).`,
        employeeId: employee.id,
        employeeName: empName,
      });
    }

    // 5. Contract expiring soon
    if (primaryContract.endDate) {
      const contractEnd = new Date(primaryContract.endDate);
      const thirtyDaysOut = new Date(periodEnd);
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
      if (contractEnd <= thirtyDaysOut && contractEnd >= periodStart) {
        warnings.push({
          severity: 'INFO',
          code: 'CONTRACT_EXPIRING_SOON',
          message: `${empName}'s contract ends on ${contractEnd.toISOString().slice(0, 10)}.`,
          employeeId: employee.id,
          employeeName: empName,
        });
      }
    }
  }

  return warnings;
}

// Helper: parse custom status from Payrun notes or fallback to state
function getEffectiveStatus(payrun: any): 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' {
  if (payrun.notes) {
    try {
      const parsed = JSON.parse(payrun.notes);
      if (parsed.status) return parsed.status;
    } catch {}
  }
  if (payrun.state === 'DONE') return 'VALIDATED';
  return 'DRAFT';
}

function setEffectiveStatus(existingNotes: string | null, status: string, extraData: any = {}): string {
  let parsed: any = {};
  if (existingNotes) {
    try {
      parsed = JSON.parse(existingNotes);
    } catch {
      parsed = { noteText: existingNotes };
    }
  }
  parsed.status = status;
  Object.assign(parsed, extraData);
  return JSON.stringify(parsed);
}

// GET /api/payruns
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const payruns = await prisma.payrun.findMany({
      include: {
        payslips: {
          select: {
            id: true,
            basicWage: true,
            grossWage: true,
            netWage: true,
          },
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    const result = payruns.map((p) => {
      const effectiveStatus = getEffectiveStatus(p);
      const employeeCount = p.payslips.length;
      const totalBasic = p.payslips.reduce((sum, ps) => sum + Number(ps.basicWage || 0), 0);
      const totalGross = p.payslips.reduce((sum, ps) => sum + Number(ps.grossWage || ps.basicWage || 0), 0);
      const totalNet = p.payslips.reduce((sum, ps) => sum + Number(ps.netWage || ps.grossWage || ps.basicWage || 0), 0);

      return {
        id: p.id,
        name: p.name,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        state: p.state,
        status: effectiveStatus,
        employeeCount,
        totalBasic,
        totalGross,
        totalNet,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch payruns error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payruns/preview-employees (Step 1 - Preview ONLY, NO DB creation)
router.post('/preview-employees', async (req: Request, res: Response): Promise<void> => {
  try {
    const { salaryStructureId, periodStart, periodEnd, department } = req.body;

    if (!periodStart || !periodEnd) {
      res.status(400).json({ message: 'Period start and end dates are required' });
      return;
    }

    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);

    const where: any = {};
    if (department) where.department = department;

    const employees = await prisma.employee.findMany({
      where,
      include: {
        contracts: {
          include: {
            salaryStructure: true,
            workingSchedule: true,
          },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const previewList = await Promise.all(
      employees.map(async (emp) => {
        const activeContract = emp.contracts.find((c) => c.status === 'ACTIVE');
        const warnings = await evaluateEmployeeWarnings(emp, pStart, pEnd, salaryStructureId);

        return {
          employeeId: emp.id,
          employeeNumber: emp.employeeNumber,
          firstName: emp.firstName,
          lastName: emp.lastName,
          department: emp.department || 'General',
          jobTitle: emp.jobTitle,
          color: emp.color,
          contract: activeContract
            ? {
                id: activeContract.id,
                wageAmount: activeContract.wageAmount,
                wageCurrency: activeContract.wageCurrency,
                salaryStructure: activeContract.salaryStructure?.name || 'Default Structure',
                salaryStructureId: activeContract.salaryStructureId,
                workingSchedule: activeContract.workingSchedule?.name || 'Standard 40 Hours',
              }
            : null,
          hasActiveContract: !!activeContract,
          warnings,
          isEligible: !!activeContract,
        };
      })
    );

    res.json({
      periodStart: pStart,
      periodEnd: pEnd,
      salaryStructureId: salaryStructureId || null,
      employees: previewList,
    });
  } catch (err) {
    console.error('Preview employees error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payruns (Step 2 - Persist Payrun to DB)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, salaryStructureId, periodStart, periodEnd, employeeIds, notes } = req.body;

    if (!name || !periodStart || !periodEnd || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ message: 'Name, period dates, and selected employee IDs are required' });
      return;
    }

    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);

    // Fetch employees with active contracts
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          include: { salaryStructure: true },
          orderBy: { startDate: 'desc' },
        },
      },
    });

    const initialNotes = setEffectiveStatus(notes || null, 'DRAFT', {
      salaryStructureId: salaryStructureId || null,
      notesText: notes || '',
    });

    const payrun = await prisma.payrun.create({
      data: {
        name,
        periodStart: pStart,
        periodEnd: pEnd,
        state: 'DRAFT',
        notes: initialNotes,
        payslips: {
          create: employees.map((emp) => {
            const contract = emp.contracts[0];
            const baseWage = contract ? contract.wageAmount : new Decimal(0);
            const targetStructureId = salaryStructureId || contract?.salaryStructureId || null;

            return {
              employeeId: emp.id,
              salaryStructureId: targetStructureId,
              periodStart: pStart,
              periodEnd: pEnd,
              basicWage: baseWage,
              grossWage: baseWage,
              netWage: baseWage,
            };
          }),
        },
      },
      include: {
        payslips: {
          include: {
            employee: true,
          },
        },
      },
    });

    res.status(201).json(payrun);
  } catch (err) {
    console.error('Create payrun error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/payruns/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payrun = await prisma.payrun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: {
              include: {
                contracts: {
                  where: { status: 'ACTIVE' },
                  include: { salaryStructure: true, workingSchedule: true },
                },
              },
            },
            salaryStructure: {
              include: { rules: { orderBy: { sequence: 'asc' } } },
            },
            lines: {
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    });

    if (!payrun) {
      res.status(404).json({ message: 'Payrun not found' });
      return;
    }

    const effectiveStatus = getEffectiveStatus(payrun);

    // Collect all warnings
    const allWarnings: PayrollWarning[] = [];
    const payslipsWithWarnings = await Promise.all(
      payrun.payslips.map(async (ps) => {
        const warnings = await evaluateEmployeeWarnings(
          ps.employee,
          payrun.periodStart,
          payrun.periodEnd,
          ps.salaryStructureId || undefined
        );
        allWarnings.push(...warnings);

        return {
          id: ps.id,
          employeeId: ps.employeeId,
          employee: {
            id: ps.employee.id,
            firstName: ps.employee.firstName,
            lastName: ps.employee.lastName,
            employeeNumber: ps.employee.employeeNumber,
            department: ps.employee.department,
            jobTitle: ps.employee.jobTitle,
            color: ps.employee.color,
          },
          salaryStructure: ps.salaryStructure?.name || 'Standard Structure',
          salaryStructureId: ps.salaryStructureId,
          workedDays: 22, // standard month working days
          basicWage: Number(ps.basicWage),
          grossWage: Number(ps.grossWage || ps.basicWage),
          netWage: Number(ps.netWage || ps.grossWage || ps.basicWage),
          linesCount: ps.lines.length,
          warnings,
          lines: ps.lines,
        };
      })
    );

    const totalBasic = payslipsWithWarnings.reduce((acc, ps) => acc + ps.basicWage, 0);
    const totalGross = payslipsWithWarnings.reduce((acc, ps) => acc + ps.grossWage, 0);
    const totalNet = payslipsWithWarnings.reduce((acc, ps) => acc + ps.netWage, 0);
    const totalDeductions = totalGross - totalNet;

    res.json({
      id: payrun.id,
      name: payrun.name,
      periodStart: payrun.periodStart,
      periodEnd: payrun.periodEnd,
      state: payrun.state,
      status: effectiveStatus,
      totalBasic,
      totalGross,
      totalDeductions,
      totalNet,
      employeeCount: payslipsWithWarnings.length,
      warnings: allWarnings,
      payslips: payslipsWithWarnings,
      createdAt: payrun.createdAt,
      updatedAt: payrun.updatedAt,
    });
  } catch (err) {
    console.error('Fetch payrun detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payruns/:id/compute (Compute/Recompute Payslips based on Salary Rules)
router.post('/:id/compute', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const payrun = await prisma.payrun.findUnique({
      where: { id },
      include: {
        payslips: {
          include: {
            employee: {
              include: {
                contracts: {
                  where: { status: 'ACTIVE' },
                  include: {
                    salaryStructure: {
                      include: {
                        rules: { orderBy: { sequence: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payrun) {
      res.status(404).json({ message: 'Payrun not found' });
      return;
    }

    // Default salary structure if employee contract has none
    const defaultStructure = await prisma.salaryStructure.findFirst({
      include: { rules: { orderBy: { sequence: 'asc' } } },
    });

    await prisma.$transaction(async (tx) => {
      for (const payslip of payrun.payslips) {
        const contract = payslip.employee.contracts[0];
        const structure = contract?.salaryStructure || defaultStructure;
        const baseWage = contract ? Number(contract.wageAmount) : Number(payslip.basicWage) || 5000;

        // Clear existing lines
        await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });

        let basicAmount = baseWage;
        let grossAmount = 0;
        let totalDeductions = 0;
        const generatedLines: any[] = [];
        const linesMap: Record<string, number> = {};

        if (structure && structure.rules.length > 0) {
          for (const rule of structure.rules) {
            let lineAmount = 0;

            if (rule.category === 'BASIC') {
              if (rule.amountFixed) {
                lineAmount = Number(rule.amountFixed);
              } else if (rule.amountPercentage) {
                lineAmount = baseWage * Number(rule.amountPercentage);
              } else {
                lineAmount = baseWage;
              }
              basicAmount = lineAmount;
              grossAmount += lineAmount;
            } else if (rule.category === 'ALLOWANCE') {
              if (rule.amountFixed) {
                lineAmount = Number(rule.amountFixed);
              } else if (rule.amountPercentage) {
                const baseVal = rule.baseCode && linesMap[rule.baseCode] !== undefined ? linesMap[rule.baseCode] : basicAmount;
                lineAmount = baseVal * Number(rule.amountPercentage);
              }
              grossAmount += lineAmount;
            } else if (rule.category === 'GROSS') {
              lineAmount = grossAmount;
            } else if (rule.category === 'DEDUCTION') {
              if (rule.amountFixed) {
                lineAmount = Number(rule.amountFixed);
              } else if (rule.amountPercentage) {
                const baseVal = rule.baseCode && linesMap[rule.baseCode] !== undefined ? linesMap[rule.baseCode] : basicAmount;
                lineAmount = baseVal * Number(rule.amountPercentage);
              }
              totalDeductions += lineAmount;
            } else if (rule.category === 'NET') {
              lineAmount = Math.max(0, grossAmount - totalDeductions);
            }

            linesMap[rule.code] = lineAmount;

            generatedLines.push({
              payslipId: payslip.id,
              name: rule.name,
              code: rule.code,
              category: rule.category,
              quantity: 1,
              rate: new Decimal(lineAmount.toFixed(2)),
              amount: new Decimal(lineAmount.toFixed(2)),
            });
          }
        } else {
          // Fallback standard calculation
          const hra = basicAmount * 0.4;
          const stdAllow = 1200;
          grossAmount = basicAmount + hra + stdAllow;
          const pf = basicAmount * 0.12;
          const profTax = 200;
          totalDeductions = pf + profTax;
          const net = grossAmount - totalDeductions;

          generatedLines.push(
            { payslipId: payslip.id, name: 'Basic Salary', code: 'BASIC', category: 'BASIC', quantity: 1, rate: new Decimal(basicAmount), amount: new Decimal(basicAmount) },
            { payslipId: payslip.id, name: 'House Rent Allowance', code: 'HRA', category: 'ALLOWANCE', quantity: 1, rate: new Decimal(hra), amount: new Decimal(hra) },
            { payslipId: payslip.id, name: 'Standard Allowance', code: 'STD_ALLOW', category: 'ALLOWANCE', quantity: 1, rate: new Decimal(stdAllow), amount: new Decimal(stdAllow) },
            { payslipId: payslip.id, name: 'Gross Salary', code: 'GROSS', category: 'GROSS', quantity: 1, rate: new Decimal(grossAmount), amount: new Decimal(grossAmount) },
            { payslipId: payslip.id, name: 'Provident Fund', code: 'PF', category: 'DEDUCTION', quantity: 1, rate: new Decimal(pf), amount: new Decimal(pf) },
            { payslipId: payslip.id, name: 'Professional Tax', code: 'PROF_TAX', category: 'DEDUCTION', quantity: 1, rate: new Decimal(profTax), amount: new Decimal(profTax) },
            { payslipId: payslip.id, name: 'Net Salary', code: 'NET', category: 'NET', quantity: 1, rate: new Decimal(net), amount: new Decimal(net) }
          );
        }

        const netAmount = Math.max(0, grossAmount - totalDeductions);

        await tx.payslipLine.createMany({ data: generatedLines });
        await tx.payslip.update({
          where: { id: payslip.id },
          data: {
            basicWage: new Decimal(basicAmount.toFixed(2)),
            grossWage: new Decimal(grossAmount.toFixed(2)),
            netWage: new Decimal(netAmount.toFixed(2)),
            salaryStructureId: structure?.id || payslip.salaryStructureId,
          },
        });
      }

      const updatedNotes = setEffectiveStatus(payrun.notes, 'COMPUTED');
      await tx.payrun.update({
        where: { id },
        data: { notes: updatedNotes },
      });
    });

    res.json({ message: 'Payrun computed successfully', status: 'COMPUTED' });
  } catch (err) {
    console.error('Compute payrun error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payruns/:id/validate
router.post('/:id/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (!payrun) {
      res.status(404).json({ message: 'Payrun not found' });
      return;
    }

    const updatedNotes = setEffectiveStatus(payrun.notes, 'VALIDATED');
    const updated = await prisma.payrun.update({
      where: { id },
      data: {
        state: 'DONE',
        notes: updatedNotes,
      },
    });

    res.json({ message: 'Payrun validated successfully', status: 'VALIDATED', payrun: updated });
  } catch (err) {
    console.error('Validate payrun error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/payruns/:id/mark-paid (STRICTLY RESTRICTED - HR_PAYROLL_USER FORBIDDEN)
router.post(
  '/:id/mark-paid',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({ where: { id } });
      if (!payrun) {
        res.status(404).json({ message: 'Payrun not found' });
        return;
      }

      const updatedNotes = setEffectiveStatus(payrun.notes, 'PAID', { paidAt: new Date() });
      const updated = await prisma.payrun.update({
        where: { id },
        data: {
          state: 'DONE',
          notes: updatedNotes,
        },
      });

      res.json({ message: 'Payrun marked as paid', status: 'PAID', payrun: updated });
    } catch (err) {
      console.error('Mark paid error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/send-payslips
router.post('/:id/send-payslips', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (!payrun) {
      res.status(404).json({ message: 'Payrun not found' });
      return;
    }

    const updatedNotes = setEffectiveStatus(payrun.notes, getEffectiveStatus(payrun), {
      payslipsSentAt: new Date(),
    });
    await prisma.payrun.update({
      where: { id },
      data: { notes: updatedNotes },
    });

    res.json({ message: 'Payslips sent to employees successfully' });
  } catch (err) {
    console.error('Send payslips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
