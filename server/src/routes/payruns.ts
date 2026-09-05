import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { PayrunState, StructureStatus, SalaryRuleCategory } from '@prisma/client';
import { calculateSalary, calculateUnpaidLeaveDays } from '../services/payrollCalculator';

const router = Router();

router.use(authenticate);

// GET /api/payruns - List all pay runs
router.get(
  '/',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER', 'HR_MANAGER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const payruns = await prisma.payrun.findMany({
        include: {
          payslips: {
            include: {
              employee: true,
            },
          },
          _count: {
            select: { payslips: true },
          },
        },
        orderBy: { periodStart: 'desc' },
      });

      const summary = payruns.map((pr) => {
        const totalGross = pr.payslips.reduce(
          (sum, p) => sum + (p.grossWage ? Number(p.grossWage) : 0),
          0
        );
        const totalNet = pr.payslips.reduce(
          (sum, p) => sum + (p.netWage ? Number(p.netWage) : 0),
          0
        );
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

// GET /api/payruns/:id - Get single pay run details
router.get(
  '/:id',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER', 'HR_MANAGER'),
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
              lines: {
                orderBy: { createdAt: 'asc' },
              },
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

// POST /api/payruns - Create new pay run
router.post(
  '/',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, periodStart, periodEnd, notes, employeeIds } = req.body;

      if (!name || !periodStart || !periodEnd) {
        res.status(400).json({ message: 'Name, periodStart, and periodEnd are required' });
        return;
      }

      const pStart = new Date(periodStart);
      const pEnd = new Date(periodEnd);

      if (pEnd < pStart) {
        res.status(400).json({ message: 'Period end date cannot be before period start date' });
        return;
      }

      const payrun = await prisma.payrun.create({
        data: {
          name: String(name),
          periodStart: pStart,
          periodEnd: pEnd,
          notes: notes ? String(notes) : null,
          state: PayrunState.DRAFT,
        },
      });

      // If employee IDs provided, initialize draft payslips for selected employees
      let selectedEmployeeIds: string[] = [];
      if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
        selectedEmployeeIds = employeeIds;
      } else {
        // Default to all active employees who have an active contract
        const activeContracts = await prisma.contract.findMany({
          where: { status: 'ACTIVE' },
          select: { employeeId: true },
        });
        selectedEmployeeIds = Array.from(new Set(activeContracts.map((c) => c.employeeId)));
      }

      for (const empId of selectedEmployeeIds) {
        const activeContract = await prisma.contract.findFirst({
          where: { employeeId: empId, status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
        });

        await prisma.payslip.create({
          data: {
            payrunId: payrun.id,
            employeeId: empId,
            salaryStructureId: activeContract?.salaryStructureId || null,
            periodStart: pStart,
            periodEnd: pEnd,
            basicWage: activeContract ? Number(activeContract.wageAmount) : 0,
            grossWage: 0,
            netWage: 0,
          },
        });
      }

      const fullPayrun = await prisma.payrun.findUnique({
        where: { id: payrun.id },
        include: {
          payslips: {
            include: {
              employee: true,
              salaryStructure: true,
            },
          },
        },
      });

      res.status(201).json(fullPayrun);
    } catch (err) {
      console.error('Create payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/validate - Pre-computation validation & warnings
router.post(
  '/:id/validate',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({
        where: { id },
        include: {
          payslips: {
            include: {
              employee: true,
              salaryStructure: {
                include: { rules: true },
              },
            },
          },
        },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      const warnings: Array<{
        employeeId: string;
        employeeName: string;
        severity: 'ERROR' | 'WARNING';
        code: string;
        message: string;
      }> = [];

      for (const payslip of payrun.payslips) {
        const empName = `${payslip.employee.firstName} ${payslip.employee.lastName}`;
        const empId = payslip.employeeId;

        // 1. Check for Active Contract
        const activeContract = await prisma.contract.findFirst({
          where: { employeeId: empId, status: 'ACTIVE' },
          include: { salaryStructure: { include: { rules: true } } },
        });

        if (!activeContract) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'ERROR',
            code: 'NO_ACTIVE_CONTRACT',
            message: `Employee ${empName} does not have an active contract.`,
          });
          continue;
        }

        // 2. Check Wage
        if (!activeContract.wageAmount || Number(activeContract.wageAmount) <= 0) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'WARNING',
            code: 'ZERO_WAGE',
            message: `Employee ${empName}'s contract basic wage is 0 or unassigned.`,
          });
        }

        // 3. Check Salary Structure
        const structure = activeContract.salaryStructure || payslip.salaryStructure;
        if (!structure) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'ERROR',
            code: 'NO_STRUCTURE',
            message: `Employee ${empName} has no Salary Structure assigned.`,
          });
          continue;
        }

        if (structure.status !== StructureStatus.ACTIVE) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'ERROR',
            code: 'INACTIVE_STRUCTURE',
            message: `Assigned structure "${structure.name}" is INACTIVE.`,
          });
        }

        // Check structure dates
        if (structure.effectiveFrom > payrun.periodEnd) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'WARNING',
            code: 'FUTURE_STRUCTURE',
            message: `Structure "${structure.name}" effective date is after pay period.`,
          });
        }
        if (structure.effectiveTo && structure.effectiveTo < payrun.periodStart) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'ERROR',
            code: 'EXPIRED_STRUCTURE',
            message: `Structure "${structure.name}" expired before pay period.`,
          });
        }

        // 4. Check active rules in structure
        const activeRules = (structure.rules || []).filter((r) => r.status === 'ACTIVE');
        if (activeRules.length === 0) {
          warnings.push({
            employeeId: empId,
            employeeName: empName,
            severity: 'WARNING',
            code: 'NO_ACTIVE_RULES',
            message: `Structure "${structure.name}" has 0 active salary rules.`,
          });
        }
      }

      res.json({
        valid: warnings.filter((w) => w.severity === 'ERROR').length === 0,
        warnings,
      });
    } catch (err) {
      console.error('Validate payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/compute - Calculate payroll for all payslips in pay run
router.post(
  '/:id/compute',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({
        where: { id },
        include: {
          payslips: {
            include: {
              employee: true,
              salaryStructure: { include: { rules: true } },
            },
          },
        },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (payrun.state === PayrunState.DONE) {
        res.status(400).json({ message: 'Cannot compute payroll for a locked/completed Pay Run' });
        return;
      }

      for (const payslip of payrun.payslips) {
        // 1. Get active contract for employee
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
          continue;
        }

        // 2. Fetch unpaid leave days for calculation context
        const unpaidLeaveDays = await calculateUnpaidLeaveDays(
          payslip.employeeId,
          payrun.periodStart,
          payrun.periodEnd
        );

        const wageAmount = contract ? Number(contract.wageAmount) : Number(payslip.basicWage || 0);

        // 3. Build input context
        const context = {
          contractWage: wageAmount,
          dailySalary: wageAmount > 0 ? wageAmount / 30 : 0,
          unpaidLeaveDays,
          overtimeHours: 0,
          overtimeRate: (wageAmount / 160) * 1.5,
          isPfApplicable: true,
        };

        // 4. Compute using calculation engine
        const calcResult = calculateSalary(structure as any, context);

        // 5. Update Payslip record & recreate PayslipLine items
        await prisma.$transaction(async (tx) => {
          await tx.payslipLine.deleteMany({
            where: { payslipId: payslip.id },
          });

          await tx.payslip.update({
            where: { id: payslip.id },
            data: {
              basicWage: wageAmount,
              grossWage: calcResult.grossSalary,
              netWage: calcResult.netSalary,
              salaryStructureId: structure.id,
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
      }

      // Fetch updated payrun
      const updatedPayrun = await prisma.payrun.findUnique({
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

      res.json(updatedPayrun);
    } catch (err) {
      console.error('Compute payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/payruns/:id/state - Update state (e.g. set DRAFT -> DONE)
router.put(
  '/:id/state',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { state } = req.body;

      if (!state || !Object.values(PayrunState).includes(state as PayrunState)) {
        res.status(400).json({ message: 'Invalid payrun state' });
        return;
      }

      const updated = await prisma.payrun.update({
        where: { id },
        data: { state: state as PayrunState },
        include: {
          payslips: {
            include: {
              employee: true,
              salaryStructure: true,
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

// DELETE /api/payruns/:id - Delete draft payrun
router.delete(
  '/:id',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const existing = await prisma.payrun.findUnique({ where: { id } });

      if (!existing) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (existing.state === PayrunState.DONE) {
        res.status(400).json({ message: 'Cannot delete a completed/locked Pay Run' });
        return;
      }

      await prisma.payrun.delete({ where: { id } });
      res.json({ message: 'Pay run deleted successfully' });
    } catch (err) {
      console.error('Delete payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
