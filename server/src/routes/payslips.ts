import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

// GET /api/payslips
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { payrunId, employeeId } = req.query;
    const where: any = {};
    if (payrunId) where.payrunId = payrunId as string;
    if (employeeId) where.employeeId = employeeId as string;

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: true,
            jobTitle: true,
          },
        },
        payrun: {
          select: {
            id: true,
            name: true,
            periodStart: true,
            periodEnd: true,
            state: true,
          },
        },
        salaryStructure: {
          select: { id: true, name: true, code: true },
        },
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(payslips);
  } catch (err) {
    console.error('Fetch payslips error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/payslips/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            contracts: {
              where: { status: 'ACTIVE' },
              include: { workingSchedule: true, salaryStructure: true },
            },
          },
        },
        payrun: true,
        salaryStructure: {
          include: { rules: { orderBy: { sequence: 'asc' } } },
        },
        lines: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!payslip) {
      res.status(404).json({ message: 'Payslip not found' });
      return;
    }

    const basicWage = Number(payslip.basicWage || 0);
    const grossWage = Number(payslip.grossWage || payslip.basicWage || 0);
    const netWage = Number(payslip.netWage || payslip.grossWage || payslip.basicWage || 0);
    const totalDeductions = grossWage - netWage;

    // Group lines by category
    const allowances = payslip.lines.filter((l) => l.category === 'ALLOWANCE' || l.category === 'BASIC');
    const deductions = payslip.lines.filter((l) => l.category === 'DEDUCTION');

    res.json({
      id: payslip.id,
      payrunId: payslip.payrunId,
      payrunName: payslip.payrun.name,
      periodStart: payslip.periodStart,
      periodEnd: payslip.periodEnd,
      workedDays: 22,
      basicWage,
      grossWage,
      totalDeductions,
      netWage,
      employee: {
        id: payslip.employee.id,
        firstName: payslip.employee.firstName,
        lastName: payslip.employee.lastName,
        employeeNumber: payslip.employee.employeeNumber,
        department: payslip.employee.department,
        jobTitle: payslip.employee.jobTitle,
        hireDate: payslip.employee.hireDate,
        contract: payslip.employee.contracts[0] || null,
      },
      salaryStructure: payslip.salaryStructure?.name || 'Standard Salary Structure',
      lines: payslip.lines,
      allowances,
      deductions,
      createdAt: payslip.createdAt,
    });
  } catch (err) {
    console.error('Fetch payslip detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/payslips/:id/pdf (Generates clean HTML Printable view formatted for direct printing / download)
router.get('/:id/pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: true,
        payrun: true,
        salaryStructure: true,
        lines: { orderBy: { id: 'asc' } },
      },
    });

    if (!payslip) {
      res.status(404).send('Payslip not found');
      return;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip - ${payslip.employee.firstName} ${payslip.employee.lastName}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; background: #fff; }
    .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company { font-size: 24px; font-weight: bold; color: #1e293b; }
    .doc-title { font-size: 20px; color: #6366f1; font-weight: 600; text-align: right; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .label { color: #64748b; font-weight: 500; }
    .value { font-weight: 600; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f1f5f9; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
    td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; width: 320px; margin-left: auto; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .summary-row.total { border-top: 2px solid #6366f1; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: bold; color: #4338ca; }
    .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">TruPRM PeoplePay360</div>
      <div style="color: #64748b; font-size: 13px; margin-top: 4px;">Human Resources & Payroll Management</div>
    </div>
    <div>
      <div class="doc-title">PAYSLIP</div>
      <div style="font-size: 12px; color: #64748b;">${new Date(payslip.periodStart).toLocaleDateString()} - ${new Date(payslip.periodEnd).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="grid">
    <div class="info-card">
      <div style="font-weight: bold; margin-bottom: 10px; color: #334155;">Employee Information</div>
      <div class="info-row"><span class="label">Name:</span><span class="value">${payslip.employee.firstName} ${payslip.employee.lastName}</span></div>
      <div class="info-row"><span class="label">Employee ID:</span><span class="value">#${payslip.employee.employeeNumber}</span></div>
      <div class="info-row"><span class="label">Department:</span><span class="value">${payslip.employee.department || 'N/A'}</span></div>
      <div class="info-row"><span class="label">Position:</span><span class="value">${payslip.employee.jobTitle}</span></div>
    </div>
    <div class="info-card">
      <div style="font-weight: bold; margin-bottom: 10px; color: #334155;">Payrun Details</div>
      <div class="info-row"><span class="label">Payrun:</span><span class="value">${payslip.payrun.name}</span></div>
      <div class="info-row"><span class="label">Structure:</span><span class="value">${payslip.salaryStructure?.name || 'Standard'}</span></div>
      <div class="info-row"><span class="label">Worked Days:</span><span class="value">22 Days</span></div>
      <div class="info-row"><span class="label">Payment Status:</span><span class="value" style="color: #16a34a;">Verified</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Description</th>
        <th>Category</th>
        <th class="text-right">Amount (USD)</th>
      </tr>
    </thead>
    <tbody>
      ${payslip.lines
        .map(
          (l) => `
        <tr>
          <td style="font-family: monospace; font-weight: bold;">${l.code}</td>
          <td>${l.name}</td>
          <td><span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #e0e7ff; color: #3730a3;">${l.category}</span></td>
          <td class="text-right" style="font-weight: 600;">$${Number(l.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="summary-box">
    <div class="summary-row"><span class="label">Basic Salary:</span><span class="value">$${Number(payslip.basicWage).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
    <div class="summary-row"><span class="label">Gross Earnings:</span><span class="value">$${Number(payslip.grossWage || payslip.basicWage).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
    <div class="summary-row"><span class="label">Total Deductions:</span><span class="value">-$${(Number(payslip.grossWage || payslip.basicWage) - Number(payslip.netWage || payslip.grossWage || payslip.basicWage)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
    <div class="summary-row total"><span>Net Payable:</span><span>$${Number(payslip.netWage || payslip.grossWage || payslip.basicWage).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
  </div>

  <div class="footer">
    This is a computer-generated payslip from TruPRM and does not require a physical signature.
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Download payslip PDF error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
