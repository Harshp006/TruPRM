import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.use(authenticate);

// GET /api/payslips - List payslips
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    const { payrunId, employeeId } = req.query;

    const whereClause: any = {};

    if (userRole === 'EMPLOYEE') {
      // Find employee for this user
      const emp = await prisma.employee.findUnique({
        where: { userId },
      });
      if (!emp) {
        res.json([]);
        return;
      }
      whereClause.employeeId = emp.id;
    } else {
      // HR/Admin roles can filter by payrunId or employeeId
      if (payrunId) {
        whereClause.payrunId = String(payrunId);
      }
      if (employeeId) {
        whereClause.employeeId = String(employeeId);
      }
    }

    const payslips = await prisma.payslip.findMany({
      where: whereClause,
      include: {
        employee: true,
        salaryStructure: true,
        payrun: true,
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    res.json(payslips);
  } catch (err) {
    console.error('Fetch payslips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/payslips/:id - Get detailed payslip with lines
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
        salaryStructure: {
          include: { rules: true },
        },
        payrun: true,
        lines: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!payslip) {
      res.status(404).json({ message: 'Payslip not found' });
      return;
    }

    // Role-based authorization check: EMPLOYEE can only view their own payslips
    if (userRole === 'EMPLOYEE') {
      if (payslip.employee.userId !== userId) {
        res.status(403).json({ message: 'Access denied: You can only view your own payslips' });
        return;
      }
    }

    // Organize lines into Earnings, Deductions, Employer Contributions
    const earnings = payslip.lines.filter(
      (l) => l.category === 'EARNING' || l.category === 'BASIC' || l.category === 'ALLOWANCE' || l.category === 'GROSS'
    );
    const deductions = payslip.lines.filter((l) => l.category === 'DEDUCTION');
    const employerContributions = payslip.lines.filter(
      (l) => l.category === 'EMPLOYER_CONTRIBUTION'
    );

    const totalEmployerContribution = employerContributions.reduce(
      (sum, l) => sum + Number(l.amount),
      0
    );

    res.json({
      ...payslip,
      breakdown: {
        earnings,
        deductions,
        employerContributions,
        totalEmployerContribution: Math.round(totalEmployerContribution * 100) / 100,
      },
    });
  } catch (err) {
    console.error('Fetch payslip detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
