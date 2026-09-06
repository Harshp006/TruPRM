import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { PayrunState, PayslipState, SalaryRuleCategory } from '@prisma/client';
import { calculateSalary, calculateUnpaidLeaveDays } from '../services/payrollCalculator';

const router = Router();

router.use(authenticate);

// ─── Helper: find the contract whose date range CONTAINS the period ──────────
async function findContractForPeriod(employeeId: string, periodStart: Date, periodEnd: Date) {
  return prisma.contract.findFirst({
    where: {
      employeeId,
      startDate: { lte: periodStart },
      OR: [
        { endDate: null },
        { endDate: { gte: periodEnd } },
      ],
    },
    include: {
      salaryStructure: {
        include: {
          rules: { orderBy: { sequence: 'asc' } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });
}

// GET /api/payruns/eligible-employees?periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD
router.get(
  '/eligible-employees',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER', 'HR_MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { periodStart, periodEnd } = req.query;
      if (!periodStart || !periodEnd) {
        res.status(400).json({ message: 'periodStart and periodEnd are required' });
        return;
      }

      const pStart = new Date(String(periodStart));
      const pEnd = new Date(String(periodEnd));

      if (isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) {
        res.status(400).json({ message: 'Invalid date format' });
        return;
      }

      const coveringContracts = await prisma.contract.findMany({
        where: {
          startDate: { lte: pStart },
          OR: [
            { endDate: null },
            { endDate: { gte: pEnd } },
          ],
        },
        include: {
          employee: {
            include: {
              user: { select: { email: true, role: true } },
            },
          },
          salaryStructure: {
            select: { id: true, name: true, code: true, status: true },
          },
        },
        orderBy: { startDate: 'desc' },
      });

      const seen = new Set<string>();
      const eligible: any[] = [];

      for (const c of coveringContracts) {
        if (!seen.has(c.employeeId)) {
          seen.add(c.employeeId);
          eligible.push({
            employeeId: c.employeeId,
            employee: c.employee,
            contractId: c.id,
            contractType: c.contractType,
            wageAmount: Number(c.wageAmount),
            wageCurrency: c.wageCurrency,
            salaryStructure: c.salaryStructure,
            startDate: c.startDate,
            endDate: c.endDate ?? null,
          });
        }
      }

      res.json(eligible);
    } catch (err) {
      console.error('Eligible employees error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// GET /api/payruns
router.get(
  '/',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER', 'HR_MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const payruns = await prisma.payrun.findMany({
        include: {
          payslips: { include: { employee: true } },
          _count: { select: { payslips: true } },
        },
        orderBy: { periodStart: 'desc' },
      });

      const summary = payruns.map((pr) => {
        const totalGross = pr.payslips.reduce((sum, p) => sum + (p.grossWage ? Number(p.grossWage) : 0), 0);
        const totalNet = pr.payslips.reduce((sum, p) => sum + (p.netWage ? Number(p.netWage) : 0), 0);
        return {
          ...pr,
          totalGross: Math.round(totalGross * 100) / 100,
          totalNet: Math.round(totalNet * 100) / 100,
        };
      });

      res.json(summary);
    } catch (err) {
      console.error('Fetch payruns error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// GET /api/payruns/:id
router.get(
  '/:id',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER', 'HR_MANAGER', 'EMPLOYEE'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({
        where: { id },
        include: {
          payslips: {
            include: {
              employee: true,
              salaryStructure: true,
              lines: { orderBy: { createdAt: 'asc' } },
            },
          },
        },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      res.json(payrun);
    } catch (err) {
      console.error('Fetch payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns — Create payrun with selected employee IDs
router.post(
  '/',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, periodStart, periodEnd, notes, employeeIds, salaryStructureId } = req.body;

      if (!name || !periodStart || !periodEnd) {
        res.status(400).json({ message: 'name, periodStart, and periodEnd are required' });
        return;
      }

      const pStart = new Date(periodStart);
      const pEnd = new Date(periodEnd);

      if (isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) {
        res.status(400).json({ message: 'Invalid date format' });
        return;
      }
      if (pEnd < pStart) {
        res.status(400).json({ message: 'Period end date cannot be before period start date' });
        return;
      }

      const selectedIds: string[] = Array.isArray(employeeIds) && employeeIds.length > 0 ? employeeIds : [];
      if (selectedIds.length === 0) {
        res.status(400).json({ message: 'At least one employee must be selected' });
        return;
      }

      const payrun = await prisma.$transaction(async (tx) => {
        const pr = await tx.payrun.create({
          data: {
            name: String(name),
            periodStart: pStart,
            periodEnd: pEnd,
            notes: notes ? String(notes) : null,
            state: PayrunState.DRAFT,
          },
        });

        for (const empId of selectedIds) {
          const contract = await tx.contract.findFirst({
            where: {
              employeeId: empId,
              startDate: { lte: pStart },
              OR: [{ endDate: null }, { endDate: { gte: pEnd } }],
            },
            orderBy: { startDate: 'desc' },
          });

          await tx.payslip.create({
            data: {
              payrunId: pr.id,
              employeeId: empId,
              state: PayslipState.DRAFT,
              salaryStructureId: salaryStructureId || contract?.salaryStructureId || null,
              periodStart: pStart,
              periodEnd: pEnd,
              basicWage: contract ? Number(contract.wageAmount) : 0,
              grossWage: 0,
              netWage: 0,
              totalDeductions: 0,
              status: 'DRAFT',
              statusMessage: null,
            },
          });
        }

        return pr;
      });

      const fullPayrun = await prisma.payrun.findUnique({
        where: { id: payrun.id },
        include: {
          payslips: { include: { employee: true, salaryStructure: true } },
        },
      });

      res.status(201).json(fullPayrun);
    } catch (err) {
      console.error('Create payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Helper function: Evaluate Pre-Check per employee & persist status in DB
async function evaluatePayrunPrecheck(payrunId: string) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: {
      payslips: {
        include: {
          employee: true,
          salaryStructure: true,
        },
      },
    },
  });

  if (!payrun) return { warnings: [], payrun: null };

  const warnings: Array<{ employeeId: string; employeeName: string; reason: string }> = [];

  for (const payslip of payrun.payslips) {
    const empName = `${payslip.employee.firstName} ${payslip.employee.lastName}`;
    const contract = await prisma.contract.findFirst({
      where: {
        employeeId: payslip.employeeId,
        status: 'ACTIVE',
      },
      include: { salaryStructure: true },
      orderBy: { startDate: 'desc' },
    });

    if (!contract) {
      const reason = `Employee ${empName} does not have an active contract.`;
      warnings.push({ employeeId: payslip.employeeId, employeeName: empName, reason });
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: { status: 'FAILED', statusMessage: reason },
      });
      continue;
    }

    const structure = contract.salaryStructure || payslip.salaryStructure;
    if (!structure) {
      const reason = `Employee ${empName} does not have an assigned salary structure.`;
      warnings.push({ employeeId: payslip.employeeId, employeeName: empName, reason });
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: { status: 'FAILED', statusMessage: reason },
      });
      continue;
    }

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: {
        status: 'PASSED',
        statusMessage: null,
        salaryStructureId: structure.id,
        basicWage: Number(contract.wageAmount || 0),
      },
    });
  }

  const updatedPayrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: {
      payslips: {
        include: { employee: true, salaryStructure: true, lines: { orderBy: { createdAt: 'asc' } } },
      },
    },
  });

  return { warnings, payrun: updatedPayrun };
}

// POST /api/payruns/:id/validate — Pre-Computation Check
router.post(
  '/:id/validate',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await evaluatePayrunPrecheck(id);
      if (!result.payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }
      res.json({
        message: 'Pre-computation check completed',
        warningsCount: result.warnings.length,
        warnings: result.warnings,
        payrun: result.payrun,
      });
    } catch (err) {
      console.error('Validate payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/compute — DRAFT → COMPUTED
router.post(
  '/:id/compute',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      let payrun = await prisma.payrun.findUnique({
        where: { id },
        include: {
          payslips: {
            include: { employee: true, salaryStructure: true },
          },
        },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      const eligiblePayslips = payrun.payslips.filter(
        (p) => p.status === 'PASSED' || p.status === 'COMPUTED'
      );
      const skippedPayslips = payrun.payslips.filter(
        (p) => p.status === 'FAILED'
      );

      if (eligiblePayslips.length === 0) {
        res.status(400).json({
          message: 'No eligible employees passed pre-computation check. Please run Pre-Computation Check first to evaluate eligible employees.',
          skippedCount: skippedPayslips.length,
          computedCount: 0,
        });
        return;
      }

      const results: Array<{
        employeeId: string;
        employeeName: string;
        status: 'COMPUTED' | 'FAILED';
        message: string;
      }> = [];

      for (const payslip of eligiblePayslips) {
        const empName = `${payslip.employee.firstName} ${payslip.employee.lastName}`;
        const contract = await prisma.contract.findFirst({
          where: { employeeId: payslip.employeeId, status: 'ACTIVE' },
          include: {
            salaryStructure: {
              include: {
                rules: {
                  orderBy: { sequence: 'asc' },
                },
              },
            },
          },
          orderBy: { startDate: 'desc' },
        });

        const structure = contract?.salaryStructure || payslip.salaryStructure;
        if (!structure) {
          results.push({
            employeeId: payslip.employeeId,
            employeeName: empName,
            status: 'FAILED',
            message: 'No Salary Structure assigned',
          });
          continue;
        }

        const unpaidLeaveDays = await calculateUnpaidLeaveDays(
          payslip.employeeId,
          payrun.periodStart,
          payrun.periodEnd
        );

        const wageAmount = contract ? Number(contract.wageAmount) : Number(payslip.basicWage || 0);

        const context = {
          contractWage: wageAmount,
          BASIC: wageAmount,
          dailySalary: wageAmount > 0 ? wageAmount / 30 : 0,
          unpaidLeaveDays,
          overtimeHours: 0,
          overtimeRate: wageAmount > 0 ? (wageAmount / 160) * 1.5 : 0,
          isPfApplicable: true,
        };

        const calcResult = calculateSalary(structure as any, context);

        await prisma.$transaction(async (tx) => {
          await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
          await tx.payslip.update({
            where: { id: payslip.id },
            data: {
              state: PayslipState.COMPUTED,
              salaryStructureId: structure.id,
              basicWage: wageAmount,
              grossWage: calcResult.grossSalary,
              totalDeductions: calcResult.totalDeductions,
              netWage: calcResult.netSalary,
              status: 'COMPUTED',
              statusMessage: null,
              lines: {
                create: calcResult.lines.map((l) => ({
                  name: l.name,
                  code: l.code,
                  category: l.category as SalaryRuleCategory,
                  quantity: 1,
                  rate: l.amount,
                  amount: l.amount,
                })),
              },
            },
          });
        });

        results.push({
          employeeId: payslip.employeeId,
          employeeName: empName,
          status: 'COMPUTED',
          message: 'Payroll computed successfully',
        });
      }

      for (const payslip of skippedPayslips) {
        const empName = `${payslip.employee.firstName} ${payslip.employee.lastName}`;
        results.push({
          employeeId: payslip.employeeId,
          employeeName: empName,
          status: 'FAILED',
          message: payslip.statusMessage || 'Pre-check failed',
        });
      }

      const updatedPayrun = await prisma.payrun.update({
        where: { id },
        data: { state: PayrunState.COMPUTED },
        include: {
          payslips: {
            include: { employee: true, salaryStructure: true, lines: { orderBy: { createdAt: 'asc' } } },
          },
        },
      });

      res.json({
        message: 'Payroll computation complete',
        total: payrun.payslips.length,
        computedCount: eligiblePayslips.length,
        skippedCount: skippedPayslips.length,
        results,
        payrun: updatedPayrun,
      });
    } catch (err) {
      console.error('Compute payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/payruns/:id/state — State Transition / Lock
router.put(
  '/:id/state',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { state } = req.body;

      if (!state) {
        res.status(400).json({ message: 'Invalid payrun state' });
        return;
      }

      const payrun = await prisma.payrun.findUnique({
        where: { id },
        include: { payslips: true },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (state === 'DONE' || state === PayrunState.PAID) {
        const lockable = payrun.payslips.filter(
          (p) => p.status === 'COMPUTED' || p.status === 'LOCKED'
        );

        if (lockable.length === 0) {
          res.status(400).json({
            message: 'No computed payslips available to approve and lock. Run payroll computation for eligible employees first.',
          });
          return;
        }

        for (const p of lockable) {
          await prisma.payslip.update({
            where: { id: p.id },
            data: { status: 'LOCKED' },
          });
        }
      }

      const targetState = state === 'DONE' ? PayrunState.PAID : (state as PayrunState);

      const updated = await prisma.payrun.update({
        where: { id },
        data: { state: targetState },
        include: {
          payslips: {
            include: {
              employee: true,
              salaryStructure: true,
              lines: { orderBy: { createdAt: 'asc' } },
            },
          },
        },
      });

      res.json(updated);
    } catch (err) {
      console.error('Update payrun state error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/payruns/:id
router.delete(
  '/:id',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await prisma.payrun.delete({ where: { id } });
      res.json({ message: 'Pay run deleted successfully' });
    } catch (err) {
      console.error('Delete payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
