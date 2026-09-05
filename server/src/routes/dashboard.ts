import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard/payroll-manager
router.get('/payroll-manager', authenticate, async (req: Request, res: Response) => {
  try {
    const { period, department, employeeType, company, startDate, endDate } = req.query;

    // Fetch raw models for aggregation
    const [employees, contracts, payruns, payslips, attendances, timeoffRequests, timeoffAllocations, timeoffTypes, salaryStructures] = await Promise.all([
      prisma.employee.findMany({
        include: {
          contracts: true,
          user: { select: { id: true, email: true, role: true } },
        },
      }),
      prisma.contract.findMany({
        include: { employee: true, salaryStructure: true },
      }),
      prisma.payrun.findMany({
        include: { payslips: true },
        orderBy: { periodStart: 'desc' },
      }),
      prisma.payslip.findMany({
        include: { employee: true, payrun: true, lines: true },
        orderBy: { periodStart: 'desc' },
      }),
      prisma.attendance.findMany({
        include: { employee: true },
        orderBy: { date: 'desc' },
      }),
      prisma.timeOffRequest.findMany({
        include: { employee: true, timeOffType: true },
        orderBy: { startDate: 'desc' },
      }),
      prisma.timeOffAllocation.findMany({
        include: { employee: true, timeOffType: true },
      }),
      prisma.timeOffType.findMany(),
      prisma.salaryStructure.findMany({
        include: { rules: true, _count: { select: { contracts: true } } },
      }),
    ]);

    // Build unique filter options
    const dbDepartments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort() as string[];
    const dbPeriods = Array.from(
      new Set(
        payslips
          .map((p) => {
            if (!p.periodStart) return null;
            const d = new Date(p.periodStart);
            return d.toLocaleString('default', { month: 'short', year: 'numeric' });
          })
          .filter(Boolean)
      )
    ) as string[];

    const filterOptions = {
      departments: dbDepartments,
      employeeTypes: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
      companies: ['TruPRM'],
      periods: dbPeriods,
    };

    // --------------------------------------------------------------------------
    // APPLY DYNAMIC FILTERS
    // --------------------------------------------------------------------------
    let filteredEmployees = employees;
    if (department && department !== 'ALL') {
      filteredEmployees = filteredEmployees.filter((e) => e.department === department);
    }
    if (employeeType && employeeType !== 'ALL') {
      const matchingEmpIds = new Set(contracts.filter((c) => c.contractType === employeeType).map((c) => c.employeeId));
      filteredEmployees = filteredEmployees.filter((e) => matchingEmpIds.has(e.id));
    }

    let filteredPayslips = payslips;
    if (department && department !== 'ALL') {
      filteredPayslips = filteredPayslips.filter((p) => p.employee?.department === department);
    }
    if (employeeType && employeeType !== 'ALL') {
      const matchingEmpIds = new Set(contracts.filter((c) => c.contractType === employeeType).map((c) => c.employeeId));
      filteredPayslips = filteredPayslips.filter((p) => matchingEmpIds.has(p.employeeId));
    }

    // Period filtering
    const now = new Date();
    if (period && period !== 'ALL') {
      if (period === 'CURRENT_MONTH') {
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        filteredPayslips = filteredPayslips.filter((p) => {
          if (!p.periodStart) return false;
          const d = new Date(p.periodStart);
          return d.getMonth() === curMonth && d.getFullYear() === curYear;
        });
      } else if (period === 'PREVIOUS_MONTH') {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pMonth = prevMonthDate.getMonth();
        const pYear = prevMonthDate.getFullYear();
        filteredPayslips = filteredPayslips.filter((p) => {
          if (!p.periodStart) return false;
          const d = new Date(p.periodStart);
          return d.getMonth() === pMonth && d.getFullYear() === pYear;
        });
      } else if (period === 'LAST_3_MONTHS') {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        filteredPayslips = filteredPayslips.filter((p) => p.periodStart && new Date(p.periodStart) >= threeMonthsAgo);
      } else if (period === 'LAST_6_MONTHS') {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        filteredPayslips = filteredPayslips.filter((p) => p.periodStart && new Date(p.periodStart) >= sixMonthsAgo);
      } else if (period === 'CUSTOM' && startDate && endDate) {
        const startD = new Date(startDate as string);
        const endD = new Date(endDate as string);
        filteredPayslips = filteredPayslips.filter((p) => {
          if (!p.periodStart) return false;
          const d = new Date(p.periodStart);
          return d >= startD && d <= endD;
        });
      } else {
        // Specific Period label match e.g. "Mar 2026"
        filteredPayslips = filteredPayslips.filter((p) => {
          if (!p.periodStart) return false;
          const pLabel = new Date(p.periodStart).toLocaleString('default', { month: 'short', year: 'numeric' });
          return pLabel === period;
        });
      }
    }

    // 1. SUMMARY CARDS
    const totalNetSalaryPaid = filteredPayslips.reduce((sum, p) => sum + (Number(p.netWage) || 0), 0);
    const payslipsGenerated = filteredPayslips.length;
    const avgSalaryPerEmployee = filteredEmployees.length > 0 ? Math.round(totalNetSalaryPaid / filteredEmployees.length) : 0;
    
    let filteredTimeoffRequests = timeoffRequests;
    if (department && department !== 'ALL') {
      filteredTimeoffRequests = filteredTimeoffRequests.filter((t) => t.employee?.department === department);
    }
    const approvedTimeOffDays = filteredTimeoffRequests
      .filter((t) => t.status === 'APPROVED' || t.status === 'VALIDATED')
      .reduce((sum, t) => sum + (Number(t.daysRequested) || 0), 0);

    let filteredAttendances = attendances;
    if (department && department !== 'ALL') {
      filteredAttendances = filteredAttendances.filter((a) => a.employee?.department === department);
    }
    const totalAttendances = filteredAttendances.length;
    const presentAttendances = filteredAttendances.filter((a) => a.status === 'PRESENT' || (a.workedHours && a.workedHours >= 8)).length;
    const attendanceHealthPct = totalAttendances > 0 ? Math.round((presentAttendances / totalAttendances) * 100) : 100;

    // 2. SALARY COST BY DEPARTMENT
    const deptMap: Record<string, { headcount: number; totalCost: number }> = {};
    filteredEmployees.forEach((emp) => {
      const dept = emp.department || 'General';
      if (!deptMap[dept]) deptMap[dept] = { headcount: 0, totalCost: 0 };
      deptMap[dept].headcount += 1;

      const activeContract = emp.contracts?.find((c) => c.status === 'ACTIVE');
      if (activeContract) {
        deptMap[dept].totalCost += Number(activeContract.wageAmount) || 0;
      }
    });

    const salaryCostByDept = Object.entries(deptMap).map(([deptName, data]) => ({
      department: deptName,
      headcount: data.headcount,
      totalCost: data.totalCost,
    }));

    // 3. MONTHLY NET SALARY TREND
    const monthlyTrendMap: Record<string, number> = {};
    filteredPayslips.forEach((p) => {
      if (p.periodStart) {
        const monthKey = new Date(p.periodStart).toLocaleString('default', { month: 'short' });
        monthlyTrendMap[monthKey] = (monthlyTrendMap[monthKey] || 0) + (Number(p.netWage) || 0);
      }
    });

    const monthlySalaryTrend = Object.entries(monthlyTrendMap).map(([month, amount]) => ({
      month,
      amount,
    }));

    // 4. PAYSLIP STATUS & PAYROLL ALERTS
    const statusSplit = {
      Paid: filteredPayslips.length,
      Done: payruns.filter((pr) => pr.state === 'DONE').length,
      Draft: payruns.filter((pr) => pr.state === 'DRAFT').length,
      Pending: payruns.filter((pr) => pr.state === 'CANCELLED').length,
    };

    const alerts: string[] = [];
    const emptyStructures = salaryStructures.filter((s) => (s.rules?.length || 0) === 0);
    if (emptyStructures.length > 0) {
      alerts.push(`${emptyStructures.length} Salary Structure(s) have no salary rules configured.`);
    }
    const draftPayruns = payruns.filter((pr) => pr.state === 'DRAFT');
    if (draftPayruns.length > 0) {
      alerts.push(`${draftPayruns.length} Draft Pay Run(s) awaiting processing & validation.`);
    }
    const empsWithoutContract = filteredEmployees.filter((e) => !e.contracts || e.contracts.length === 0);
    if (empsWithoutContract.length > 0) {
      alerts.push(`${empsWithoutContract.length} Employee(s) in selected view missing active contract.`);
    }

    // 5. ATTENDANCE OVERVIEW
    const attendanceOverview = {
      present: filteredAttendances.filter((a) => a.status === 'PRESENT').length,
      late: filteredAttendances.filter((a) => a.status === 'LATE').length,
      absent: filteredAttendances.filter((a) => a.status === 'ABSENT').length,
      overtime: filteredAttendances.filter((a) => a.workedHours && a.workedHours > 8).length,
      missingCheckouts: filteredAttendances.filter((a) => a.checkIn && !a.checkOut).length,
      manualEdits: 0,
      attendanceCoverage: totalAttendances > 0 ? Math.round((presentAttendances / (filteredEmployees.length || 1)) * 100) : 100,
    };

    // 6. TIME OFF OVERVIEW TABLE
    const timeOffTable = timeoffTypes.map((type) => {
      const typeRequests = filteredTimeoffRequests.filter((r) => r.timeOffTypeId === type.id);
      const approvedDays = typeRequests.filter((r) => r.status === 'APPROVED' || r.status === 'VALIDATED').reduce((sum, r) => sum + r.daysRequested, 0);
      const pendingDays = typeRequests.filter((r) => r.status === 'CONFIRMED' || r.status === 'DRAFT').reduce((sum, r) => sum + r.daysRequested, 0);

      const typeAllocations = timeoffAllocations.filter((a) => a.timeOffTypeId === type.id);
      const totalAllocated = typeAllocations.reduce((sum, a) => sum + a.daysAllocated, 0);
      const remainingBalance = Math.max(0, totalAllocated - approvedDays);

      return {
        type: type.name,
        approvedDays,
        pending: pendingDays,
        remainingBalance,
      };
    });

    // 7. DEPARTMENT OVERVIEW TABLE
    const departmentOverview = salaryCostByDept;

    res.json({
      filterOptions,
      summaryCards: {
        totalNetSalaryPaid,
        payslipsGenerated,
        avgSalaryPerEmployee,
        approvedTimeOffDays,
        attendanceHealthPct,
      },
      salaryCostByDept,
      monthlySalaryTrend,
      payslipStatusSplit: statusSplit,
      currentAlerts: alerts,
      attendanceOverview,
      timeOffTable,
      departmentOverview,
      modelsSummary: {
        employeesCount: filteredEmployees.length,
        contractsCount: contracts.length,
        payrunsCount: payruns.length,
        payslipsCount: filteredPayslips.length,
        attendanceCount: filteredAttendances.length,
        timeoffRequestsCount: filteredTimeoffRequests.length,
      },
    });
  } catch (error: any) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({ message: 'Failed to compute dashboard metrics', error: error.message });
  }
});

export default router;
