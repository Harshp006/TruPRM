import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

// GET /api/salary-structures
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const structures = await prisma.salaryStructure.findMany({
      include: {
        rules: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: {
            contracts: true,
            rules: true,
          },
        },
      },
      orderBy: { name: 'asc' },
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
        contracts: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeNumber: true },
            },
          },
        },
        _count: {
          select: {
            contracts: true,
            rules: true,
          },
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

// POST /api/salary-structures (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.post(
  '/',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, code, description, rules } = req.body;

      if (!name || !code) {
        res.status(400).json({ message: 'Name and Code are required' });
        return;
      }

      const structure = await prisma.salaryStructure.create({
        data: {
          name,
          code,
          description: description || null,
          rules: rules && rules.length > 0 ? {
            create: rules.map((r: any, idx: number) => ({
              name: r.name,
              code: r.code,
              category: r.category || 'ALLOWANCE',
              sequence: r.sequence !== undefined ? r.sequence : (idx + 1) * 10,
              amountFixed: r.amountFixed !== undefined ? r.amountFixed : null,
              amountPercentage: r.amountPercentage !== undefined ? r.amountPercentage : null,
              baseCode: r.baseCode || null,
              appears_on_payslip: r.appears_on_payslip !== undefined ? r.appears_on_payslip : true,
            })),
          } : undefined,
        },
        include: { rules: true },
      });

      res.status(201).json(structure);
    } catch (err) {
      console.error('Create salary structure error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/salary-structures/:id (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.put(
  '/:id',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name, code, description, rules } = req.body;

      const structure = await prisma.$transaction(async (tx) => {
        if (rules && Array.isArray(rules)) {
          await tx.salaryRule.deleteMany({ where: { salaryStructureId: id } });
          await tx.salaryRule.createMany({
            data: rules.map((r: any, idx: number) => ({
              salaryStructureId: id,
              name: r.name,
              code: r.code,
              category: r.category || 'ALLOWANCE',
              sequence: r.sequence !== undefined ? r.sequence : (idx + 1) * 10,
              amountFixed: r.amountFixed !== undefined ? r.amountFixed : null,
              amountPercentage: r.amountPercentage !== undefined ? r.amountPercentage : null,
              baseCode: r.baseCode || null,
              appears_on_payslip: r.appears_on_payslip !== undefined ? r.appears_on_payslip : true,
            })),
          });
        }

        return await tx.salaryStructure.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(code && { code }),
            ...(description !== undefined && { description }),
          },
          include: { rules: { orderBy: { sequence: 'asc' } } },
        });
      });

      res.json(structure);
    } catch (err) {
      console.error('Update salary structure error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/salary-structures/:id (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.delete(
  '/:id',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await prisma.salaryStructure.delete({ where: { id } });
      res.json({ message: 'Salary structure deleted' });
    } catch (err) {
      console.error('Delete salary structure error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
