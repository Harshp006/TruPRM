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

    // ─── FONT REGISTRATION (Unicode Rupee Symbol Support) ─────────────────
    const fs = require('fs');
    const path = require('path');
    const customRegPath = path.resolve(__dirname, '../fonts/CustomFont-Regular.ttf');
    const customBoldPath = path.resolve(__dirname, '../fonts/CustomFont-Bold.ttf');

    let fontRegular = 'Helvetica';
    let fontBold = 'Helvetica-Bold';

    if (fs.existsSync(customRegPath) && fs.existsSync(customBoldPath)) {
      doc.registerFont('AppFont', customRegPath);
      doc.registerFont('AppFont-Bold', customBoldPath);
      fontRegular = 'AppFont';
      fontBold = 'AppFont-Bold';
    } else if (fs.existsSync('/System/Library/Fonts/Supplemental/Georgia.ttf')) {
      doc.registerFont('AppFont', '/System/Library/Fonts/Supplemental/Georgia.ttf');
      doc.registerFont('AppFont-Bold', '/System/Library/Fonts/Supplemental/Georgia Bold.ttf');
      fontRegular = 'AppFont';
      fontBold = 'AppFont-Bold';
    }

    const startX = 35;
    const contentWidth = 525;

    // ─── 1. COMPANY HEADER (Black & White Corporate Style) ─────────────────
    doc.fillColor('#000000').fontSize(15).font(fontBold).text('PEOPLEPAY360 / TRUPRM', startX, 35);
    doc.fillColor('#333333').fontSize(9).font(fontBold).text(`PAYSLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${yearNum}`, startX, 54);
    doc.fillColor('#666666').fontSize(7.5).font(fontRegular).text('Corporate HQ: Tech Park Phase II, Electronic City, Bangalore - 560100', startX, 67);

    // Top Right Header Info
    doc.fillColor('#000000').fontSize(10).font(fontBold).text('PAYSLIP VOUCHER', 380, 35, { align: 'right', width: 180 });
    doc.fillColor('#555555').fontSize(8).font(fontRegular).text(`Ref No: #${payslip.id.slice(-8).toUpperCase()}`, 380, 48, { align: 'right', width: 180 });
    doc.text(`Issue Date: ${new Date(payslip.periodEnd).toLocaleDateString('en-IN')}`, 380, 60, { align: 'right', width: 180 });

    // Divider Line
    doc.moveTo(startX, 80).lineTo(startX + contentWidth, 80).strokeColor('#000000').lineWidth(1.25).stroke();

    // ─── 2. EMPLOYEE & PAYROLL INFORMATION (Structured Grid Layout) ───────
    let y = 90;
    const infoBoxHeight = 110;

    // Outer Rectangle Box
    doc.rect(startX, y, contentWidth, infoBoxHeight).strokeColor('#000000').lineWidth(0.75).stroke();
    
    // Header Bar inside Box
    doc.rect(startX, y, contentWidth, 18).fill('#F0F0F0');
    doc.fillColor('#000000').fontSize(8.5).font(fontBold).text('EMPLOYEE & PAYROLL INFORMATION', startX + 8, y + 5);
    doc.moveTo(startX, y + 18).lineTo(startX + contentWidth, y + 18).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

    // Two Column Structured Layout
    const col1X = startX + 8; // x = 43
    const col2X = startX + 265; // x = 300

    const label1Width = 85;
    const val1Width = 160;

    const label2Width = 75;
    const val2Width = 170;

    // Left Column Info (Col 1)
    let c1y = y + 24;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Employee Name:', col1X, c1y, { width: label1Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontBold).text(`${payslip.employee.firstName} ${payslip.employee.lastName}`, col1X + label1Width, c1y, { width: val1Width });

    c1y += 16;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Employee ID:', col1X, c1y, { width: label1Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(`#${payslip.employee.employeeNumber}`, col1X + label1Width, c1y, { width: val1Width });

    c1y += 16;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Joining Date:', col1X, c1y, { width: label1Width });
    const hireDt = payslip.employee.hireDate ? new Date(payslip.employee.hireDate).toLocaleDateString('en-IN') : 'N/A';
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(hireDt, col1X + label1Width, c1y, { width: val1Width });

    // Right Column Info (Col 2)
    let c2y = y + 24;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Department:', col2X, c2y, { width: label2Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(`${payslip.employee.department || 'Operations'}`, col2X + label2Width, c2y, { width: val2Width });

    c2y += 14;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Designation:', col2X, c2y, { width: label2Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(`${payslip.employee.jobTitle}`, col2X + label2Width, c2y, { width: val2Width });

    c2y += 14;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Structure:', col2X, c2y, { width: label2Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(`${payslip.salaryStructure?.name || 'Standard Structure'}`, col2X + label2Width, c2y, { width: val2Width });

    c2y += 14;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Pay Period:', col2X, c2y, { width: label2Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(`${new Date(payslip.periodStart).toLocaleDateString('en-IN')} - ${new Date(payslip.periodEnd).toLocaleDateString('en-IN')}`, col2X + label2Width, c2y, { width: val2Width });

    c2y += 14;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Bank Name:', col2X, c2y, { width: label2Width });
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(`${payslip.employee.bankName || 'ICICI Bank'}`, col2X + label2Width, c2y, { width: val2Width });

    c2y += 14;
    doc.fillColor('#555555').fontSize(8).font(fontBold).text('Bank A/C No:', col2X, c2y, { width: label2Width });
    const bankAccStr = payslip.employee.bankAccount ? `XXXX-${payslip.employee.bankAccount.slice(-4)}` : 'N/A';
    doc.fillColor('#000000').fontSize(8.5).font(fontRegular).text(bankAccStr, col2X + label2Width, c2y, { width: val2Width });

    // ─── 3. EARNINGS & DEDUCTIONS STATEMENT (Side-by-Side Tables) ─────────
    y = 210;
    const tableWidth = 257;

    const earnings = payslip.lines.filter((l) => l.category === 'EARNING' || l.category === 'BASIC' || l.category === 'ALLOWANCE' || l.category === 'GROSS');
    const deductions = payslip.lines.filter((l) => l.category === 'DEDUCTION');
    const employerContribs = payslip.lines.filter((l) => l.category === 'EMPLOYER_CONTRIBUTION');

    // Headers
    // Earnings Header (Left)
    doc.rect(startX, y, tableWidth, 20).fillAndStroke('#F0F0F0', '#000000');
    doc.fillColor('#000000').fontSize(8.5).font(fontBold).text('EARNINGS', startX + 8, y + 6);
    doc.text('AMOUNT (INR)', startX + tableWidth - 90, y + 6, { width: 80, align: 'right' });

    // Deductions Header (Right)
    const rightTableX = startX + tableWidth + 11;
    doc.rect(rightTableX, y, tableWidth, 20).fillAndStroke('#F0F0F0', '#000000');
    doc.fillColor('#000000').fontSize(8.5).font(fontBold).text('DEDUCTIONS', rightTableX + 8, y + 6);
    doc.text('AMOUNT (INR)', rightTableX + tableWidth - 90, y + 6, { width: 80, align: 'right' });

    // Rows
    let ey = y + 20;
    let dy = y + 20;

    // Draw Earnings Rows
    let eIndex = 0;
    for (const e of earnings) {
      if (eIndex % 2 === 1) {
        doc.rect(startX, ey, tableWidth, 18).fill('#FAFAFA');
      }
      doc.rect(startX, ey, tableWidth, 18).strokeColor('#E5E5E5').lineWidth(0.5).stroke();
      doc.fillColor('#000000').fontSize(8).font(fontRegular).text(e.name, startX + 8, ey + 5);
      doc.font(fontBold).text(`₹${Number(e.amount).toLocaleString('en-IN')}`, startX + tableWidth - 90, ey + 5, { width: 80, align: 'right' });
      ey += 18;
      eIndex++;
    }

    // Draw Deductions Rows
    let dIndex = 0;
    for (const d of deductions) {
      if (dIndex % 2 === 1) {
        doc.rect(rightTableX, dy, tableWidth, 18).fill('#FAFAFA');
      }
      doc.rect(rightTableX, dy, tableWidth, 18).strokeColor('#E5E5E5').lineWidth(0.5).stroke();
      doc.fillColor('#000000').fontSize(8).font(fontRegular).text(d.name, rightTableX + 8, dy + 5);
      doc.font(fontBold).text(`₹${Number(d.amount).toLocaleString('en-IN')}`, rightTableX + tableWidth - 90, dy + 5, { width: 80, align: 'right' });
      dy += 18;
      dIndex++;
    }

    // Ensure equal height padding before total row
    const maxY = Math.max(ey, dy, y + 110);

    // Total Earnings Row
    doc.rect(startX, maxY, tableWidth, 20).fillAndStroke('#F5F5F5', '#000000');
    doc.fillColor('#000000').fontSize(8.5).font(fontBold).text('TOTAL EARNINGS (A)', startX + 8, maxY + 6);
    doc.text(`₹${Number(payslip.grossWage || 0).toLocaleString('en-IN')}`, startX + tableWidth - 90, maxY + 6, { width: 80, align: 'right' });

    // Total Deductions Row
    doc.rect(rightTableX, maxY, tableWidth, 20).fillAndStroke('#F5F5F5', '#000000');
    doc.fillColor('#000000').fontSize(8.5).font(fontBold).text('TOTAL DEDUCTIONS (B)', rightTableX + 8, maxY + 6);
    doc.text(`₹${Number(payslip.totalDeductions || 0).toLocaleString('en-IN')}`, rightTableX + tableWidth - 90, maxY + 6, { width: 80, align: 'right' });

    let nextY = maxY + 30;

    // ─── 4. EMPLOYER CONTRIBUTIONS (If Any) ────────────────────────────────
    if (employerContribs.length > 0) {
      doc.rect(startX, nextY, contentWidth, 18).fillAndStroke('#F0F0F0', '#000000');
      doc.fillColor('#000000').fontSize(8).font(fontBold).text('EMPLOYER CONTRIBUTIONS (Statutory Benefits Excluded from Net Salary)', startX + 8, nextY + 5);
      nextY += 18;

      for (const ec of employerContribs) {
        doc.rect(startX, nextY, contentWidth, 16).strokeColor('#E5E5E5').lineWidth(0.5).stroke();
        doc.fillColor('#333333').fontSize(7.5).font(fontRegular).text(ec.name, startX + 8, nextY + 4);
        doc.fillColor('#000000').font(fontBold).text(`₹${Number(ec.amount).toLocaleString('en-IN')}`, startX + contentWidth - 100, nextY + 4, { width: 90, align: 'right' });
        nextY += 16;
      }
      nextY += 10;
    }

    // ─── 5. NET SALARY SUMMARY BOX (Monochrome) ───────────────────────────
    const netVal = Number(payslip.netWage || 0);
    const sumBoxHeight = 55;
    const sumY = Math.max(nextY, 360);

    doc.rect(startX, sumY, contentWidth, sumBoxHeight).fillAndStroke('#F9F9F9', '#000000');

    // Left: Net Salary Title & Amount
    doc.fillColor('#333333').fontSize(8.5).font(fontBold).text('NET PAYABLE SALARY (A - B):', startX + 12, sumY + 10);
    doc.fillColor('#000000').fontSize(15).font(fontBold).text(`₹${netVal.toLocaleString('en-IN')}`, startX + 12, sumY + 22);

    // Amount in Words
    doc.fillColor('#555555').fontSize(8).font(fontRegular).text(`Amount in Words: ${numberToWords(netVal)}`, startX + 12, sumY + 40);

    // Right: Summary Breakdown Text
    doc.fillColor('#555555').fontSize(8).font(fontRegular).text(`Gross Earnings: ₹${Number(payslip.grossWage || 0).toLocaleString('en-IN')}`, 350, sumY + 12, { align: 'right', width: 200 });
    doc.text(`Total Deductions: ₹${Number(payslip.totalDeductions || 0).toLocaleString('en-IN')}`, 350, sumY + 24, { align: 'right', width: 200 });

    // ─── 6. FOOTER & AUTHORIZATION ─────────────────────────────────────────
    const footerY = 445;
    doc.moveTo(startX, footerY).lineTo(startX + contentWidth, footerY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();

    doc.fillColor('#333333').fontSize(8).font(fontBold).text('Prepared By: HR & Payroll Department', startX, footerY + 10);
    doc.text('Authorized Signatory (System Verified)', startX + contentWidth - 200, footerY + 10, { align: 'right', width: 200 });

    doc.fillColor('#777777').fontSize(7.5).font(fontRegular).text(
      'This is a system-generated official payslip voucher and does not require a physical signature.\nConfidential • TruPRM HR & Payroll Systems © 2026',
      startX,
      footerY + 30,
      { align: 'center', width: contentWidth }
    );

    doc.end();
  } catch (err) {
    console.error('Fetch payslip PDF error:', err);
    res.status(500).send('Internal server error generating PDF document');
  }
});

export default router;
