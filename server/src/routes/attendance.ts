import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AttendanceStatus } from '@prisma/client';
import { logTimeOffLedger } from '../services/timeoffService';

const router = Router();

router.use(authenticate);

// Helper: Normalize Date to start of day in UTC
function getStartOfDay(d: Date = new Date()): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

// ─── GET /api/attendance/status ───────────────────────────────────────────────
// Get current authenticated employee's check-in status and today's worked hours
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({
      where: { userId },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, jobTitle: true, color: true },
    });

    if (!employee) {
      res.json({
        isCheckedIn: false,
        activeAttendance: null,
        todayWorkedHours: 0,
        employee: null,
      });
      return;
    }

    // Active session (checkIn exists, checkOut is null)
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    // Today's attendance records for total accumulated hours
    const today = getStartOfDay();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayRecords = await prisma.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    let todayWorkedHours = 0;
    const now = new Date();

    for (const rec of todayRecords) {
      if (rec.checkOut && rec.workedHours != null) {
        todayWorkedHours += Number(rec.workedHours);
      } else if (rec.checkIn && !rec.checkOut) {
        const liveMs = now.getTime() - new Date(rec.checkIn).getTime();
        todayWorkedHours += Math.max(0, liveMs / (1000 * 60 * 60));
      }
    }

    todayWorkedHours = Math.round(todayWorkedHours * 100) / 100;

    res.json({
      isCheckedIn: !!activeAttendance,
      activeAttendance,
      todayWorkedHours,
      employee,
    });
  } catch (err) {
    console.error('Fetch attendance status error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/attendance/check-in ───────────────────────────────────────────
// Explicit check-in for authenticated employee
router.post('/check-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.status(400).json({ message: 'Your user account is not linked to an Employee record.' });
      return;
    }

    // Prevent double check-in
    const existingActive = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: null,
      },
    });

    if (existingActive) {
      res.status(400).json({ message: 'You are already checked in with an active session.' });
      return;
    }

    const now = new Date();
    const today = getStartOfDay(now);

    // Determine status (LATE if checking in after 10:00 AM)
    const isLate = now.getHours() >= 10 && now.getMinutes() > 0;
    const status: AttendanceStatus = isLate ? 'LATE' : 'PRESENT';

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkIn: now,
        status,
        workedHours: 0,
        overtimeHours: 0,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, color: true },
        },
      },
    });

    res.status(201).json({
      message: 'Checked in successfully',
      isCheckedIn: true,
      attendance,
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/attendance/check-out ──────────────────────────────────────────
// Explicit check-out for authenticated employee
router.post('/check-out', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.status(400).json({ message: 'Your user account is not linked to an Employee record.' });
      return;
    }

    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    if (!activeAttendance || !activeAttendance.checkIn) {
      res.status(400).json({ message: 'No active check-in session found to check out.' });
      return;
    }

    const now = new Date();
    const checkInMs = new Date(activeAttendance.checkIn).getTime();
    const diffMs = Math.max(0, now.getTime() - checkInMs);
    const workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const overtimeHours = Math.max(0, Math.round((workedHours - 8) * 100) / 100);

    let status = activeAttendance.status;
    if (workedHours < 4 && status !== 'LATE') {
      status = 'HALF_DAY';
    }

    const updated = await prisma.attendance.update({
      where: { id: activeAttendance.id },
      data: {
        checkOut: now,
        workedHours,
        overtimeHours,
        status,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, color: true },
        },
      },
    });

    // Auto-accrue Comp-Off credit if overtime >= 4 hours
    if (overtimeHours >= 4) {
      try {
        const daysEarned = overtimeHours >= 8 ? 1.0 : 0.5;
        let compOffType = await prisma.timeOffType.findFirst({
          where: { OR: [{ code: 'COMP_OFF' }, { isEarnedThroughWork: true }] },
        });
        if (!compOffType) {
          compOffType = await prisma.timeOffType.create({
            data: {
              name: 'Compensatory Leave',
              code: 'COMP_OFF',
              description: 'Comp-Off earned from extra hours worked',
              unit: 'DAYS',
              isPaid: true,
              requiresAllocation: false,
              isEarnedThroughWork: true,
            },
          });
        }

        const existingCredit = await prisma.compOffCredit.findFirst({
          where: { attendanceId: activeAttendance.id },
        });

        if (!existingCredit) {
          const cr = await prisma.compOffCredit.create({
            data: {
              employeeId: employee.id,
              attendanceId: activeAttendance.id,
              dateEarned: activeAttendance.date,
              daysEarned,
              hoursWorked: overtimeHours,
              reason: `Auto Comp-Off accrued from ${overtimeHours} overtime hours on ${new Date(activeAttendance.date).toISOString().slice(0, 10)}`,
              status: 'APPROVED',
              usedDays: 0,
              remainingDays: daysEarned,
            },
          });

          await logTimeOffLedger(
            employee.id,
            compOffType.id,
            'COMP_OFF_EARNED',
            daysEarned,
            cr.id,
            `Auto Comp-Off credited from ${overtimeHours} overtime hours`,
            null
          );
        }
      } catch (e) {
        console.error('Failed to auto-accrue Comp-Off credit:', e);
      }
    }

    res.json({
      message: 'Checked out successfully',
      isCheckedIn: false,
      attendance: updated,
    });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/attendance/toggle ─────────────────────────────────────────────
// Toggle check-in / check-out
router.post('/toggle', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.status(400).json({ message: 'Your user account is not linked to an Employee record.' });
      return;
    }

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    if (openAttendance) {
      // Check Out
      const now = new Date();
      const checkInTime = new Date(openAttendance.checkIn!).getTime();
      const workedHours = Math.round(((now.getTime() - checkInTime) / (1000 * 60 * 60)) * 100) / 100;
      const overtimeHours = Math.max(0, Math.round((workedHours - 8) * 100) / 100);

      const updated = await prisma.attendance.update({
        where: { id: openAttendance.id },
        data: {
          checkOut: now,
          workedHours,
          overtimeHours,
        },
      });

      res.json({ message: 'Checked out successfully', isCheckedIn: false, attendance: updated });
    } else {
      // Check In
      const now = new Date();
      const today = getStartOfDay(now);
      const created = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date: today,
          checkIn: now,
          status: 'PRESENT',
        },
      });

      res.json({ message: 'Checked in successfully', isCheckedIn: true, attendance: created });
    }
  } catch (err) {
    console.error('Toggle attendance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/attendance ──────────────────────────────────────────────────────
// List attendance records with filters (Global & Individual Employee context)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, search, status, period, startDate, endDate } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    const where: any = {};

    // Security Rule: Employees can ONLY view their own attendance records
    if (userRole === 'EMPLOYEE') {
      const authEmp = await prisma.employee.findUnique({ where: { userId } });
      if (!authEmp) {
        res.json([]);
        return;
      }
      where.employeeId = authEmp.id;
    } else if (employeeId) {
      where.employeeId = String(employeeId);
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.status = String(status) as AttendanceStatus;
    }

    // Period filter
    const now = new Date();
    if (period === 'TODAY') {
      const today = getStartOfDay(now);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      where.date = { gte: today, lt: tomorrow };
    } else if (period === 'THIS_WEEK') {
      const firstDay = new Date(now);
      const day = firstDay.getDay() || 7; // Get current day of week (Monday=1)
      firstDay.setDate(firstDay.getDate() - day + 1);
      firstDay.setHours(0, 0, 0, 0);
      where.date = { gte: firstDay };
    } else if (period === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      where.date = { gte: startOfMonth };
    } else if (startDate && endDate) {
      where.date = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    // Search filter
    if (search && String(search).trim() !== '') {
      const q = String(search).toLowerCase().trim();
      where.OR = [
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { employee: { employeeNumber: { contains: q, mode: 'insensitive' } } },
        { employee: { department: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const attendances = await prisma.attendance.findMany({
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
            color: true,
            manager: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(attendances);
  } catch (err) {
    console.error('Fetch attendances error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /api/attendance/:id ──────────────────────────────────────────────────
// Fetch single attendance record details
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            manager: { select: { id: true, firstName: true, lastName: true } },
            contracts: { where: { status: 'ACTIVE' }, take: 1, include: { workingSchedule: true } },
          },
        },
      },
    });

    if (!attendance) {
      res.status(404).json({ message: 'Attendance record not found' });
      return;
    }

    // Role Security
    if (req.user?.role === 'EMPLOYEE') {
      const authEmp = await prisma.employee.findUnique({ where: { userId: req.user.userId } });
      if (authEmp?.id !== attendance.employeeId) {
        res.status(403).json({ message: 'Forbidden: Cannot access another employee record.' });
        return;
      }
    }

    res.json(attendance);
  } catch (err) {
    console.error('Fetch attendance detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── POST /api/attendance ─────────────────────────────────────────────────────
// Manual attendance record creation (HR & Admin)
router.post(
  '/',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, date, checkIn, checkOut, status, notes, overtimeHours } = req.body;

      if (!employeeId || !date) {
        res.status(400).json({ message: 'employeeId and date are required' });
        return;
      }

      let workedHours: number | undefined = undefined;
      const cIn = checkIn ? new Date(checkIn) : null;
      const cOut = checkOut ? new Date(checkOut) : null;

      if (cIn && cOut) {
        const diff = cOut.getTime() - cIn.getTime();
        workedHours = Math.round((Math.max(0, diff) / (1000 * 60 * 60)) * 100) / 100;
      }

      const attendance = await prisma.attendance.create({
        data: {
          employeeId,
          date: new Date(date),
          checkIn: cIn,
          checkOut: cOut,
          workedHours,
          overtimeHours: overtimeHours != null ? Number(overtimeHours) : Math.max(0, (workedHours || 0) - 8),
          status: status || 'PRESENT',
          notes: notes || null,
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, color: true },
          },
        },
      });

      res.status(201).json(attendance);
    } catch (err) {
      console.error('Create attendance error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─── PUT /api/attendance/:id ──────────────────────────────────────────────────
// Manual attendance record edit (HR & Admin)
router.put(
  '/:id',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'HR_PAYROLL_USER'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { checkIn, checkOut, status, notes, overtimeHours } = req.body;

      const existing = await prisma.attendance.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ message: 'Attendance record not found' });
        return;
      }

      const data: any = {};
      if (checkIn !== undefined) data.checkIn = checkIn ? new Date(checkIn) : null;
      if (checkOut !== undefined) data.checkOut = checkOut ? new Date(checkOut) : null;
      if (status) data.status = status;
      if (notes !== undefined) data.notes = notes;

      const finalCheckIn = data.checkIn !== undefined ? data.checkIn : existing.checkIn;
      const finalCheckOut = data.checkOut !== undefined ? data.checkOut : existing.checkOut;

      if (finalCheckIn && finalCheckOut) {
        const diff = new Date(finalCheckOut).getTime() - new Date(finalCheckIn).getTime();
        data.workedHours = Math.round((Math.max(0, diff) / (1000 * 60 * 60)) * 100) / 100;
        data.overtimeHours = overtimeHours != null ? Number(overtimeHours) : Math.max(0, Math.round((data.workedHours - 8) * 100) / 100);
      } else if (overtimeHours != null) {
        data.overtimeHours = Number(overtimeHours);
      }

      const updated = await prisma.attendance.update({
        where: { id },
        data,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, color: true },
          },
        },
      });

      res.json(updated);
    } catch (err) {
      console.error('Update attendance error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─── DELETE /api/attendance/:id ───────────────────────────────────────────────
router.delete(
  '/:id',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await prisma.attendance.delete({ where: { id } });
      res.json({ message: 'Attendance record deleted' });
    } catch (err) {
      console.error('Delete attendance error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
