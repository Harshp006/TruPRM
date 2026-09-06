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

// GET /api/payslips/:id/pdf - Stream printable PDF statement (with strict role check)
router.get('/:id/pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: true,
        salaryStructure: true,
        payrun: true,
        lines: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!payslip) {
      res.status(404).send('Payslip not found');
      return;
    }

    if (userRole === 'EMPLOYEE' && payslip.employee.userId !== userId) {
      res.status(403).send('Forbidden: Access denied to this payslip document.');
      return;
    }

    const earnings = payslip.lines.filter((l) => l.category === 'EARNING' || l.category === 'BASIC' || l.category === 'ALLOWANCE' || l.category === 'GROSS');
    const deductions = payslip.lines.filter((l) => l.category === 'DEDUCTION');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${payslip.employee.firstName} ${payslip.employee.lastName} (${payslip.periodStart.toISOString().slice(0, 10)})</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; background-color: #fff; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #003366; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #003366; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px; font-size: 13px; }
          .meta-item label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; display: block; }
          .meta-item span { font-weight: bold; color: #0f172a; }
          .table-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f1f5f9; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
          td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
          .amount { text-align: right; font-weight: bold; }
          .footer-box { background: #0f172a; color: white; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
          .net-label { font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; }
          .net-amount { font-size: 28px; font-weight: bold; color: #34d399; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">TruPRM / PeoplePay360</div>
            <div class="subtitle">Official Salary Statement & Payslip Voucher</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: bold; color: #003366;">Ref: #${payslip.id.slice(-8).toUpperCase()}</div>
            <div class="subtitle">Generated Date: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><label>Employee</label><span>${payslip.employee.firstName} ${payslip.employee.lastName} (#${payslip.employee.employeeNumber})</span></div>
          <div class="meta-item"><label>Department / Role</label><span>${payslip.employee.department || 'Operations'} • ${payslip.employee.jobTitle || 'Staff'}</span></div>
          <div class="meta-item"><label>Pay Period</label><span>${new Date(payslip.periodStart).toLocaleDateString()} - ${new Date(payslip.periodEnd).toLocaleDateString()}</span></div>
          <div class="meta-item"><label>Salary Structure</label><span>${payslip.salaryStructure?.name || 'Standard Structure'}</span></div>
        </div>

        <div class="table-container">
          <div>
            <h4 style="margin: 0 0 10px 0; color: #047857;">EARNINGS</h4>
            <table>
              <thead><tr><th>Item</th><th class="amount">Amount</th></tr></thead>
              <tbody>
                ${earnings.map((e) => `<tr><td>${e.name}</td><td class="amount">₹${Number(e.amount).toLocaleString()}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div>
            <h4 style="margin: 0 0 10px 0; color: #be123c;">DEDUCTIONS</h4>
            <table>
              <thead><tr><th>Item</th><th class="amount">Amount</th></tr></thead>
              <tbody>
                ${deductions.map((d) => `<tr><td>${d.name}</td><td class="amount">₹${Number(d.amount).toLocaleString()}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer-box">
          <div>
            <div>Basic Wage: ₹${Number(payslip.basicWage || 0).toLocaleString()}</div>
            <div>Gross Salary: ₹${Number(payslip.grossWage || 0).toLocaleString()}</div>
          </div>
          <div style="text-align: right;">
            <div class="net-label">NET PAYABLE AMOUNT</div>
            <div class="net-amount">₹${Number(payslip.netWage || 0).toLocaleString()}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            if (window.location.search.includes('download=true')) {
              window.print();
            }
          };
        </script>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Fetch payslip PDF error:', err);
    res.status(500).send('Internal server error');
  }
});

export default router;
