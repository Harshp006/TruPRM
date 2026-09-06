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

import PDFDocument from 'pdfkit';

// Amount in Words helper function
function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };
  const integerPart = Math.floor(Math.abs(num));
  if (integerPart === 0) return 'Rupees Zero Only';
  return 'Rupees ' + inWords(integerPart) + ' Only';
}

// GET /api/payslips/:id/pdf - Stream official binary PDF statement
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

    const pStart = new Date(payslip.periodStart);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[pStart.getMonth()] || 'Period';
    const yearNum = pStart.getFullYear();

    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
    const fileName = `${sanitize(payslip.employee.firstName)}-${sanitize(payslip.employee.lastName)}-${monthName}-${yearNum}-Payslip.pdf`;

    const isDownload = req.query.download === 'true' || req.query.disposition === 'attachment';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${fileName}"`
    );

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Header Background Accent Bar
    doc.rect(40, 40, 515, 60).fill('#003366');
    
    // Header Title & Company Details
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('PeoplePay360 / TruPRM', 55, 52);
    doc.fontSize(10).font('Helvetica').text('Official Human Resources & Payroll Voucher', 55, 78);

    // Header Payslip Ref & Date
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(`Ref: #${payslip.id.slice(-8).toUpperCase()}`, 380, 55, { align: 'right', width: 160 });
    doc.fontSize(9).font('Helvetica').text(`Issued: ${new Date(payslip.periodEnd).toLocaleDateString()}`, 380, 75, { align: 'right', width: 160 });

    doc.moveDown(2);

    // Employee & Payroll Meta Data Box
    let y = 115;
    doc.rect(40, y, 515, 95).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#0F172A');

    // Left Column Info
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('EMPLOYEE NAME', 55, y + 10);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text(`${payslip.employee.firstName} ${payslip.employee.lastName}`, 55, y + 22);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('EMPLOYEE ID', 55, y + 38);
    doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(`#${payslip.employee.employeeNumber}`, 55, y + 50);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('DESIGNATION & DEPT', 55, y + 66);
    doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(`${payslip.employee.jobTitle} • ${payslip.employee.department || 'Operations'}`, 55, y + 78);

    // Right Column Info
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('PAY PERIOD', 310, y + 10);
    doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(`${new Date(payslip.periodStart).toLocaleDateString()} to ${new Date(payslip.periodEnd).toLocaleDateString()}`, 310, y + 22);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('SALARY STRUCTURE', 310, y + 38);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4338CA').text(`${payslip.salaryStructure?.name || 'Standard Structure'}`, 310, y + 50);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text('BANK DETAILS', 310, y + 66);
    const bankStr = payslip.employee.bankAccount ? `${payslip.employee.bankName || 'Bank'} (A/C: XXXX-${payslip.employee.bankAccount.slice(-4)})` : 'Direct Account Transfer';
    doc.fontSize(9).font('Helvetica').fillColor('#0F172A').text(bankStr, 310, y + 78);

    // Line items breakdown
    const earnings = payslip.lines.filter((l) => l.category === 'EARNING' || l.category === 'BASIC' || l.category === 'ALLOWANCE' || l.category === 'GROSS');
    const deductions = payslip.lines.filter((l) => l.category === 'DEDUCTION');
    const employerContribs = payslip.lines.filter((l) => l.category === 'EMPLOYER_CONTRIBUTION');

    y = 225;
    const colWidth = 245;

    // EARNINGS TABLE
    doc.rect(40, y, colWidth, 22).fill('#ECFDF5');
    doc.fillColor('#065F46').fontSize(9).font('Helvetica-Bold').text('EARNINGS', 50, y + 6);
    doc.text('AMOUNT (INR)', 40 + colWidth - 95, y + 6, { width: 85, align: 'right' });

    let ey = y + 26;
    for (const e of earnings) {
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(e.name, 50, ey);
      doc.font('Helvetica-Bold').text(`₹${Number(e.amount).toLocaleString()}`, 40 + colWidth - 95, ey, { width: 85, align: 'right' });
      ey += 16;
    }

    // DEDUCTIONS TABLE
    doc.rect(310, y, colWidth, 22).fill('#FFF1F2');
    doc.fillColor('#9F1239').fontSize(9).font('Helvetica-Bold').text('DEDUCTIONS', 320, y + 6);
    doc.text('AMOUNT (INR)', 310 + colWidth - 95, y + 6, { width: 85, align: 'right' });

    let dy = y + 26;
    for (const d of deductions) {
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica').text(d.name, 320, dy);
      doc.fillColor('#BE123C').font('Helvetica-Bold').text(`₹${Number(d.amount).toLocaleString()}`, 310 + colWidth - 95, dy, { width: 85, align: 'right' });
      dy += 16;
    }

    // EMPLOYER CONTRIBUTIONS TABLE (If any)
    let nextY = Math.max(ey, dy) + 15;
    if (employerContribs.length > 0) {
      doc.rect(40, nextY, 515, 20).fill('#EEF2FF');
      doc.fillColor('#3730A3').fontSize(8.5).font('Helvetica-Bold').text('EMPLOYER CONTRIBUTIONS (Statutory Benefits Excluded from Net Pay)', 50, nextY + 5);
      nextY += 24;
      for (const ec of employerContribs) {
        doc.fillColor('#475569').fontSize(8).font('Helvetica').text(ec.name, 50, nextY);
        doc.fillColor('#3730A3').font('Helvetica-Bold').text(`₹${Number(ec.amount).toLocaleString()}`, 460, nextY, { width: 85, align: 'right' });
        nextY += 16;
      }
      nextY += 10;
    }

    // SUMMARY BOX
    const sumY = Math.max(nextY, 390);
    doc.rect(40, sumY, 515, 70).fill('#0F172A');

    const grossVal = Number(payslip.grossWage || 0);
    const netVal = Number(payslip.netWage || 0);
    const dedVal = Math.max(0, grossVal - netVal);

    doc.fillColor('#CBD5E1').fontSize(9).font('Helvetica').text(`Gross Earnings: ₹${grossVal.toLocaleString()}`, 55, sumY + 12);
    doc.fillColor('#FCA5A5').fontSize(9).font('Helvetica').text(`Total Deductions: ₹${dedVal.toLocaleString()}`, 55, sumY + 28);
    doc.fillColor('#E2E8F0').fontSize(8.5).font('Helvetica-Oblique').text(`In Words: ${numberToWords(netVal)}`, 55, sumY + 46);

    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica-Bold').text('NET PAYABLE SALARY', 350, sumY + 14, { align: 'right', width: 190 });
    doc.fillColor('#34D399').fontSize(22).font('Helvetica-Bold').text(`₹${netVal.toLocaleString()}`, 350, sumY + 28, { align: 'right', width: 190 });

    // FOOTER
    doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica').text(
      'This is a system-generated official payslip document and does not require a physical signature. Confidential • TruPRM Systems © 2026',
      40,
      540,
      { align: 'center', width: 515 }
    );

    doc.end();
  } catch (err) {
    console.error('Fetch payslip PDF error:', err);
    res.status(500).send('Internal server error generating PDF document');
  }
});

export default router;
