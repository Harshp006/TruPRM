import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

// GET /api/salary-rules
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { salaryStructureId } = req.query;
    const where: any = {};
    if (salaryStructureId) where.salaryStructureId = salaryStructureId as string;

    const rules = await prisma.salaryRule.findMany({
      where,
      include: {
        salaryStructure: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [
        { salaryStructureId: 'asc' },
        { sequence: 'asc' },
      ],
    });
    res.json(rules);
  } catch (err) {
    console.error('Fetch salary rules error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/salary-rules/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const rule = await prisma.salaryRule.findUnique({
      where: { id },
      include: {
        salaryStructure: true,
      },
    });
    if (!rule) {
      res.status(404).json({ message: 'Salary rule not found' });
      return;
    }
    res.json(rule);
  } catch (err) {
    console.error('Fetch salary rule error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/salary-rules (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.post(
  '/',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        salaryStructureId,
        name,
        code,
        category,
        sequence,
        amountFixed,
        amountPercentage,
        baseCode,
        appears_on_payslip,
      } = req.body;

      if (!salaryStructureId || !name || !code) {
        res.status(400).json({ message: 'Structure, Name, and Code are required' });
        return;
      }

      const rule = await prisma.salaryRule.create({
        data: {
          salaryStructureId,
          name,
          code,
          category: category || 'ALLOWANCE',
          sequence: sequence || 0,
          amountFixed: amountFixed !== undefined ? amountFixed : null,
          amountPercentage: amountPercentage !== undefined ? amountPercentage : null,
          baseCode: baseCode || null,
          appears_on_payslip: appears_on_payslip !== undefined ? appears_on_payslip : true,
        },
        include: { salaryStructure: true },
      });

      res.status(201).json(rule);
    } catch (err) {
      console.error('Create salary rule error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/salary-rules/:id (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.put(
  '/:id',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const {
        name,
        code,
        category,
        sequence,
        amountFixed,
        amountPercentage,
        baseCode,
        appears_on_payslip,
      } = req.body;

      const rule = await prisma.salaryRule.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(code && { code }),
          ...(category && { category }),
          ...(sequence !== undefined && { sequence }),
          ...(amountFixed !== undefined && { amountFixed }),
          ...(amountPercentage !== undefined && { amountPercentage }),
          ...(baseCode !== undefined && { baseCode }),
          ...(appears_on_payslip !== undefined && { appears_on_payslip }),
        },
        include: { salaryStructure: true },
      });

      res.json(rule);
    } catch (err) {
      console.error('Update salary rule error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/salary-rules/:id (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.delete(
  '/:id',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await prisma.salaryRule.delete({ where: { id } });
      res.json({ message: 'Salary rule deleted' });
    } catch (err) {
      console.error('Delete salary rule error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
