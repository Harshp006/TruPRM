import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { StructureStatus, RuleStatus, RuleCalculationType, SalaryRuleCategory } from '@prisma/client';
import { calculateSalary } from '../services/payrollCalculator';

const router = Router();

router.use(authenticate);

// GET /api/salary-structures
// Returns salary structures, supports optional query params:
// ?status=ACTIVE|INACTIVE
// ?activeOnly=true (only returns active structures where effectiveFrom <= now and (effectiveTo is null or effectiveTo >= now))
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, activeOnly } = req.query;

    const whereClause: any = {};

    if (status && (status === 'ACTIVE' || status === 'INACTIVE')) {
      whereClause.status = status as StructureStatus;
    }

    if (activeOnly === 'true') {
      const now = new Date();
      whereClause.status = StructureStatus.ACTIVE;
      whereClause.effectiveFrom = { lte: now };
      whereClause.OR = [
        { effectiveTo: null },
        { effectiveTo: { gte: now } },
      ];
    }

    const structures = await prisma.salaryStructure.findMany({
      where: whereClause,
      include: {
        rules: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { contracts: true, payslips: true, rules: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(structures);
  } catch (err) {
    console.error('Fetch salary structures error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/salary-structures/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const structure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { contracts: true, payslips: true },
        },
      },
    });

    if (!structure) {
      res.status(404).json({ message: 'Salary structure not found' });
      return;
    }

    res.json(structure);
  } catch (err) {
    console.error('Fetch salary structure error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/salary-structures/:id/calculate
// Quick test calculation preview using backend payroll calculation engine
router.post('/:id/calculate', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const structure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!structure) {
      res.status(404).json({ message: 'Salary structure not found' });
      return;
    }

    const inputContext = req.body || {};
    const result = calculateSalary(structure, inputContext);

    res.json(result);
  } catch (err) {
    console.error('Calculate salary structure error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/salary-structures
// Restrict to HR Payroll Manager (HR_PAYROLL_ADMIN) and ADMIN
router.post(
  '/',
  authorize('HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        code,
        description,
        status,
        effectiveFrom,
        effectiveTo,
        rules,
      } = req.body;

      if (!name || !code) {
        res.status(400).json({ message: 'Name and code are required' });
        return;
      }

      const existingCode = await prisma.salaryStructure.findUnique({
        where: { code: String(code) },
      });
      if (existingCode) {
        res
          .status(400)
          .json({ message: 'Structure code already exists' });
        return;
      }

      const structure = await prisma.salaryStructure.create({
        data: {
          name: String(name),
          code: String(code),
          description: description ? String(description) : null,
          status: (status as StructureStatus) || StructureStatus.ACTIVE,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          rules: rules && Array.isArray(rules) ? {
            create: rules.map((r: any, idx: number) => ({
              name: String(r.name),
              code: String(r.code),
              category: (r.category as SalaryRuleCategory) || SalaryRuleCategory.EARNING,
              sequence: r.sequence !== undefined ? Number(r.sequence) : idx,
              calculationType: (r.calculationType as RuleCalculationType) || RuleCalculationType.FIXED_AMOUNT,
              fixedAmount: r.fixedAmount !== undefined ? r.fixedAmount : r.amountFixed,
              amountFixed: r.fixedAmount !== undefined ? r.fixedAmount : r.amountFixed,
              percentage: r.percentage !== undefined ? r.percentage : r.amountPercentage,
              amountPercentage: r.percentage !== undefined ? r.percentage : r.amountPercentage,
              baseCode: r.baseCode ? String(r.baseCode) : null,
              formula: r.formula ? String(r.formula) : null,
              condition: r.condition ? String(r.condition) : null,
              conditionType: r.conditionType ? String(r.conditionType) : null,
              conditionValue: r.conditionValue !== undefined && r.conditionValue !== null ? Number(r.conditionValue) : null,
              roundingRule: r.roundingRule ? String(r.roundingRule) : null,
              status: (r.status as RuleStatus) || RuleStatus.ACTIVE,
            })),
          } : undefined,
        },
        include: {
          rules: {
            orderBy: { sequence: 'asc' },
          },
        },
      });

      res.status(201).json(structure);
    } catch (err) {
      console.error('Create salary structure error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/salary-structures/:id
router.put(
  '/:id',
  authorize('HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const {
        name,
        code,
        description,
        status,
        effectiveFrom,
        effectiveTo,
        rules,
      } = req.body;

      const existing = await prisma.salaryStructure.findUnique({
        where: { id },
      });
      if (!existing) {
        res.status(404).json({ message: 'Salary structure not found' });
        return;
      }

      if (code && code !== existing.code) {
        const codeCheck = await prisma.salaryStructure.findUnique({
          where: { code: String(code) },
        });
        if (codeCheck) {
          res
            .status(400)
            .json({ message: 'Structure code already exists' });
          return;
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (rules && Array.isArray(rules)) {
          // Replace rules if full rules array is sent
          await tx.salaryRule.deleteMany({ where: { salaryStructureId: id } });
        }

        return await tx.salaryStructure.update({
          where: { id },
          data: {
            ...(name && { name: String(name) }),
            ...(code && { code: String(code) }),
            ...(description !== undefined && { description: description ? String(description) : null }),
            ...(status && { status: status as StructureStatus }),
            ...(effectiveFrom && { effectiveFrom: new Date(effectiveFrom) }),
            ...(effectiveTo !== undefined && {
              effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
            }),
            ...(rules && Array.isArray(rules) && {
              rules: {
                create: rules.map((r: any, idx: number) => ({
                  name: String(r.name),
                  code: String(r.code),
                  category: (r.category as SalaryRuleCategory) || SalaryRuleCategory.EARNING,
                  sequence: r.sequence !== undefined ? Number(r.sequence) : idx,
                  calculationType: (r.calculationType as RuleCalculationType) || RuleCalculationType.FIXED_AMOUNT,
                  fixedAmount: r.fixedAmount !== undefined ? r.fixedAmount : r.amountFixed,
                  amountFixed: r.fixedAmount !== undefined ? r.fixedAmount : r.amountFixed,
                  percentage: r.percentage !== undefined ? r.percentage : r.amountPercentage,
                  amountPercentage: r.percentage !== undefined ? r.percentage : r.amountPercentage,
                  baseCode: r.baseCode ? String(r.baseCode) : null,
                  formula: r.formula ? String(r.formula) : null,
                  condition: r.condition ? String(r.condition) : null,
                  conditionType: r.conditionType ? String(r.conditionType) : null,
                  conditionValue: r.conditionValue !== undefined && r.conditionValue !== null ? Number(r.conditionValue) : null,
                  roundingRule: r.roundingRule ? String(r.roundingRule) : null,
                  status: (r.status as RuleStatus) || RuleStatus.ACTIVE,
                })),
              },
            }),
          },
          include: {
            rules: {
              orderBy: { sequence: 'asc' },
            },
          },
        });
      });

      res.json(updated);
    } catch (err) {
      console.error('Update salary structure error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/salary-structures/:id
router.delete(
  '/:id',
  authorize('HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.salaryStructure.findUnique({
        where: { id },
        include: { _count: { select: { contracts: true, payslips: true } } },
      });

      if (!existing) {
        res.status(404).json({ message: 'Salary structure not found' });
        return;
      }

      if (existing._count.contracts > 0 || existing._count.payslips > 0) {
        res.status(400).json({
          message:
            'Cannot delete salary structure in use by contracts or payslips. Set status to INACTIVE instead.',
        });
        return;
      }

      await prisma.salaryStructure.delete({ where: { id } });
      res.json({ message: 'Salary structure deleted successfully' });
    } catch (err) {
      console.error('Delete salary structure error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
