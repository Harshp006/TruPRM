import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { PayrunState, PayslipState, SalaryRuleCategory } from '@prisma/client';
import { calculateSalary, calculateUnpaidLeaveDays } from '../services/payrollCalculator';

const router = Router();

router.use(authenticate);

// ─── Helper: find the contract whose date range CONTAINS the period ──────────
// A contract is eligible if:
//   contract.startDate <= periodStart  AND  (contract.endDate IS NULL OR contract.endDate >= periodEnd)
// We never just grab "the latest ACTIVE" — we check date containment explicitly.
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

      // Deduplicate — take the most recent covering contract per employee
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

// POST /api/payruns — Wizard Step 2: Create payrun + draft payslips in one transaction
router.post(
  '/',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, periodStart, periodEnd, notes, employeeIds } = req.body;

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
              salaryStructureId: contract?.salaryStructureId ?? null,
              periodStart: pStart,
              periodEnd: pEnd,
              basicWage: contract ? Number(contract.wageAmount) : 0,
              grossWage: 0,
              netWage: 0,
              totalDeductions: 0,
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

// POST /api/payruns/:id/compute — DRAFT → COMPUTED
router.post(
  '/:id/compute',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({
        where: { id },
        include: { payslips: { include: { employee: true } } },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (payrun.state !== PayrunState.DRAFT) {
        res.status(400).json({ message: `Compute only allowed on DRAFT pay runs (current: ${payrun.state})` });
        return;
      }

      for (const payslip of payrun.payslips) {
        // CRITICAL: Date containment — find the contract that COVERS this period
        const contract = await findContractForPeriod(payslip.employeeId, payrun.periodStart, payrun.periodEnd);

        if (!contract || !contract.salaryStructure) {
          continue; // No valid contract for this period; payslip stays DRAFT
        }

        const structure = contract.salaryStructure;
        const wageAmount = Number(contract.wageAmount);

        const unpaidLeaveDays = await calculateUnpaidLeaveDays(
          payslip.employeeId,
          payrun.periodStart,
          payrun.periodEnd
        );

        const context = {
          contractWage: wageAmount,
          BASIC: wageAmount, // pre-seed BASIC so % rules referencing BASIC work without a dedicated FIXED rule
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

      const updated = await prisma.payrun.update({
        where: { id },
        data: { state: PayrunState.COMPUTED },
        include: {
          payslips: {
            include: { employee: true, salaryStructure: true, lines: { orderBy: { createdAt: 'asc' } } },
          },
        },
      });

      res.json(updated);
    } catch (err) {
      console.error('Compute payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/validate — COMPUTED → VALIDATED
// Checks duplicates and computation completeness. Transitions only if no ERRORs.
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
            include: { employee: true, salaryStructure: true },
          },
        },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (payrun.state !== PayrunState.COMPUTED) {
        res.status(400).json({ message: `Validate only allowed on COMPUTED pay runs (current: ${payrun.state})` });
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
        const ps = payslip as any;

        // 1. Not computed (stayed DRAFT — no valid contract for period)
        if (ps.state === 'DRAFT') {
          warnings.push({
            employeeId: empId, employeeName: empName, severity: 'ERROR',
            code: 'NOT_COMPUTED',
            message: `${empName}'s payslip was not computed — no contract covering this period.`,
          });
        }

        // 2. No salary structure
        if (!payslip.salaryStructure) {
          warnings.push({
            employeeId: empId, employeeName: empName, severity: 'ERROR',
            code: 'NO_STRUCTURE',
            message: `${empName} has no salary structure assigned.`,
          });
        }

        // 3. Duplicate paid payslip for same employee + overlapping period
        const duplicate = await prisma.payslip.findFirst({
          where: {
            employeeId: empId,
            id: { not: payslip.id },
            periodStart: { lte: payrun.periodEnd },
            periodEnd: { gte: payrun.periodStart },
            payrun: { state: PayrunState.PAID },
          },
        });
        if (duplicate) {
          warnings.push({
            employeeId: empId, employeeName: empName, severity: 'ERROR',
            code: 'DUPLICATE_PAYSLIP',
            message: `${empName} already has a paid payslip for an overlapping period.`,
          });
        }

        // 4. Zero net wage warning
        if (!payslip.netWage || Number(payslip.netWage) === 0) {
          warnings.push({
            employeeId: empId, employeeName: empName, severity: 'WARNING',
            code: 'ZERO_NET_WAGE',
            message: `${empName} has a net wage of ₹0. Verify salary structure rules.`,
          });
        }
      }

      const hasErrors = warnings.some((w) => w.severity === 'ERROR');

      if (!hasErrors) {
        await prisma.$transaction(async (tx) => {
          await tx.payslip.updateMany({ where: { payrunId: id }, data: { state: PayslipState.VALIDATED } });
          await tx.payrun.update({ where: { id }, data: { state: PayrunState.VALIDATED } });
        });
      }

      const updatedPayrun = await prisma.payrun.findUnique({
        where: { id },
        include: {
          payslips: {
            include: { employee: true, salaryStructure: true, lines: { orderBy: { createdAt: 'asc' } } },
          },
        },
      });

      res.json({ payrun: updatedPayrun, valid: !hasErrors, transitioned: !hasErrors, warnings });
    } catch (err) {
      console.error('Validate payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/mark-paid — VALIDATED → PAID (immutable lock)
router.post(
  '/:id/mark-paid',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({ where: { id } });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (payrun.state !== PayrunState.VALIDATED) {
        res.status(400).json({
          message: `Mark Paid requires VALIDATED state (current: ${payrun.state}). Run Validate first.`,
        });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.payslip.updateMany({ where: { payrunId: id }, data: { state: PayslipState.PAID } });
        return tx.payrun.update({
          where: { id },
          data: { state: PayrunState.PAID },
          include: {
            payslips: {
              include: { employee: true, salaryStructure: true, lines: { orderBy: { createdAt: 'asc' } } },
            },
          },
        });
      });

      res.json(updated);
    } catch (err) {
      console.error('Mark paid error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/payruns/:id/cancel — DRAFT or COMPUTED only
router.post(
  '/:id/cancel',
  authorize('ADMIN', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payrun = await prisma.payrun.findUnique({ where: { id } });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (payrun.state === PayrunState.PAID) {
        res.status(400).json({ message: 'Cannot cancel a PAID pay run.' });
        return;
      }
      if (payrun.state === PayrunState.CANCELLED) {
        res.status(400).json({ message: 'Pay run is already cancelled.' });
        return;
      }

      const updated = await prisma.payrun.update({ where: { id }, data: { state: PayrunState.CANCELLED } });
      res.json(updated);
    } catch (err) {
      console.error('Cancel payrun error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/payruns/:id — DRAFT only
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

      if (existing.state !== PayrunState.DRAFT) {
        res.status(400).json({ message: 'Only DRAFT pay runs can be deleted.' });
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

// POST /api/payruns/:id/send-payslips
router.post(
  '/:id/send-payslips',
  authorize('HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const payrun = await prisma.payrun.findUnique({
        where: { id },
        include: {
          payslips: {
            include: {
              employee: {
                include: { user: true },
              },
            },
          },
        },
      });

      if (!payrun) {
        res.status(404).json({ message: 'Pay run not found' });
        return;
      }

      if (payrun.state !== PayrunState.PAID) {
        res.status(400).json({ message: 'Only PAID pay runs can have payslips distributed.' });
        return;
      }

      // Mock Email Logic (Standard Output Logging)
      console.log(`\n========================================`);
      console.log(`[EMAIL DISPATCH] Starting bulk distribution for Pay Run: ${payrun.name}`);
      console.log(`========================================`);

      let emailsSent = 0;
      payrun.payslips.forEach((payslip) => {
        const emp = payslip.employee;
        const email = emp.user?.email || `${emp.employeeNumber}@truprm.com`; // Fallback if no user
        console.log(`--> Sending email to: ${email}`);
        console.log(`    Subject: Your Payslip for ${new Date(payrun.periodStart).toLocaleDateString()} to ${new Date(payrun.periodEnd).toLocaleDateString()}`);
        console.log(`    Attachment: payslip-${emp.employeeNumber}-${payrun.periodStart}.pdf`);
        emailsSent++;
      });

      console.log(`========================================`);
      console.log(`[EMAIL DISPATCH] Successfully sent ${emailsSent} emails.\n`);

      res.json({ message: `Successfully sent ${emailsSent} payslips via email.` });
    } catch (err) {
      console.error('Send payslips error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;

