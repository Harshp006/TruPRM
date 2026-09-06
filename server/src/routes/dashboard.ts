import { Router, Request, Response } from 'express';
import { PrismaClient, PayrunState } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard and route aliases (/stats, /summary, /user, /payroll-manager)
router.get(['/', '/stats', '/summary', '/user', '/payroll-manager'], authenticate, async (req: Request, res: Response) => {
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
      Done: payruns.filter((pr) => pr.state === PayrunState.PAID || (pr.state as string) === 'DONE').length,
      Draft: payruns.filter((pr) => pr.state === PayrunState.DRAFT).length,
      Pending: payruns.filter((pr) => pr.state === PayrunState.CANCELLED).length,
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

    const activeContractsCount = contracts.filter((c) => c.status === 'ACTIVE').length;
    const pendingTimeOffCount = filteredTimeoffRequests.filter((t) => t.status === 'CONFIRMED' || t.status === 'DRAFT' || (t.status as string) === 'PENDING').length;
    const departmentBreakdown: Record<string, number> = {};
    Object.entries(deptMap).forEach(([dept, data]) => {
      departmentBreakdown[dept] = data.headcount;
    });

    const recentPayruns = payruns.slice(0, 5).map((pr) => ({
      id: pr.id,
      name: pr.name,
      periodStart: pr.periodStart.toISOString(),
      periodEnd: pr.periodEnd.toISOString(),
      status: pr.state,
      employeeCount: pr.payslips?.length || 0,
      totalNet: pr.payslips?.reduce((sum, p) => sum + (Number(p.netWage) || 0), 0) || 0,
    }));

    const departmentOverview = salaryCostByDept;

    res.json({
      // DashboardStats format
      totalEmployees: filteredEmployees.length,
      activeContractsCount,
      pendingTimeOffCount,
      totalNetPaid: totalNetSalaryPaid,
      attendanceRate: attendanceHealthPct,
      departmentBreakdown,
      recentPayruns,
      recentAttendances: filteredAttendances.slice(0, 10),

      // DashboardData format
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
      recentTimeOffs: filteredTimeoffRequests.slice(0, 20).map(r => ({
        id: r.id,
        employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown',
        type: r.timeOffType?.name || 'Leave',
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      })),
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

// GET /api/dashboard/hr-manager — Dedicated HR Manager Dashboard Metrics (Zero Payroll Data)
router.get('/hr-manager', authenticate, async (req: Request, res: Response) => {
  try {
    const [employees, contracts, attendances, timeoffRequests, workingSchedules] = await Promise.all([
      prisma.employee.findMany({
        include: { contracts: true },
      }),
      prisma.contract.findMany({
        include: { employee: true },
      }),
      prisma.attendance.findMany({
        include: { employee: true },
        orderBy: { date: 'desc' },
      }),
      prisma.timeOffRequest.findMany({
        include: { employee: true, timeOffType: true },
        orderBy: { startDate: 'desc' },
      }),
      prisma.workingSchedule.findMany({
        include: { _count: { select: { contracts: true } } },
      }),
    ]);

    const headcount = employees.length;
    const activeContractsCount = contracts.filter((c) => c.status === 'ACTIVE').length;
    
    // Attendance Metrics
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAttendances = attendances.filter(a => a.date && new Date(a.date).toISOString().slice(0, 10) === todayStr);
    const presentCount = todayAttendances.filter(a => a.status === 'PRESENT' || (a.workedHours && a.workedHours >= 8)).length;
    const lateCount = todayAttendances.filter(a => a.status === 'LATE').length;
    const absentCount = todayAttendances.filter(a => a.status === 'ABSENT').length;
    const attendanceHealthPct = headcount > 0 ? Math.round((presentCount / headcount) * 100) : 100;

    // Pending Time Off Requests
    const pendingRequests = timeoffRequests.filter(r => r.status === 'CONFIRMED' || r.status === 'DRAFT' || (r.status as string) === 'PENDING');
    
    // Department Breakdown (Headcount only)
    const deptHeadcountMap: Record<string, number> = {};
    employees.forEach(emp => {
      const dept = emp.department || 'General';
      deptHeadcountMap[dept] = (deptHeadcountMap[dept] || 0) + 1;
    });

    const departmentHeadcount = Object.entries(deptHeadcountMap).map(([department, count]) => ({
      department,
      count,
    }));

    // Working Schedules Summary
    const schedulesSummary = workingSchedules.map(s => ({
      id: s.id,
      name: s.name,
      hoursPerWeek: s.hoursPerWeek,
      flexibleHours: s.flexibleHours,
      assignedContracts: s._count?.contracts || 0,
    }));

    res.json({
      headcount,
      activeContractsCount,
      attendanceHealthPct,
      pendingTimeoffCount: pendingRequests.length,
      todayAttendance: {
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        total: todayAttendances.length,
      },
      departmentHeadcount,
      pendingRequests: pendingRequests.slice(0, 10).map(r => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown',
        employeeNumber: r.employee?.employeeNumber || 'N/A',
        department: r.employee?.department || 'General',
        typeName: r.timeOffType?.name || 'Leave',
        startDate: r.startDate,
        endDate: r.endDate,
        daysRequested: r.daysRequested,
        status: r.status,
        reason: r.reason,
      })),
      recentTimeOffs: timeoffRequests.slice(0, 15).map(r => ({
        id: r.id,
        employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : 'Unknown',
        typeName: r.timeOffType?.name || 'Leave',
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      })),
      schedulesSummary,
      activeContracts: contracts.filter(c => c.status === 'ACTIVE').slice(0, 10).map(c => ({
        id: c.id,
        employeeName: c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : 'Unknown',
        contractType: c.contractType,
        startDate: c.startDate,
        endDate: c.endDate,
      })),
    });
  } catch (err: any) {
    console.error('HR Manager dashboard metrics error:', err);
    res.status(500).json({ message: 'Failed to compute HR Manager metrics', error: err.message });
  }
});

export default router;
