import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// GET /api/attendance/status - Get current user's check-in status
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { userId } });
    if (!employee) {
      res.json({ isCheckedIn: false, activeAttendance: null });
      return;
    }

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    res.json({
      isCheckedIn: !!openAttendance,
      activeAttendance: openAttendance,
    });
  } catch (err) {
    console.error('Fetch attendance status error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/attendance/toggle - Toggle check-in / check-out
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

    // Check for open session
    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: null,
      },
      orderBy: { checkIn: 'desc' },
    });

    const now = new Date();

    if (openAttendance && openAttendance.checkIn) {
      // CHECK OUT
      const checkInTime = new Date(openAttendance.checkIn).getTime();
      const diffMs = now.getTime() - checkInTime;
      const workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      const updated = await prisma.attendance.update({
        where: { id: openAttendance.id },
        data: {
          checkOut: now,
          workedHours,
          status: 'PRESENT',
        },
      });

      res.json({
        message: 'Checked out successfully',
        isCheckedIn: false,
        attendance: updated,
      });
    } else {
      // CHECK IN
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const created = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date: today,
          checkIn: now,
          status: 'PRESENT',
        },
      });

      res.json({
        message: 'Checked in successfully',
        isCheckedIn: true,
        attendance: created,
      });
    }
  } catch (err) {
    console.error('Toggle attendance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance - List attendance records
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, search } = req.query;
    const where: any = {};

    if (employeeId) {
      where.employeeId = String(employeeId);
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { employee: { employeeNumber: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, color: true },
        },
      },
      orderBy: { checkIn: 'desc' },
    });

    res.json(attendances);
  } catch (err) {
    console.error('Fetch attendances error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/attendance - Manual creation (HR_MANAGER & ADMIN)
router.post('/', authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, date, checkIn, checkOut, status, notes } = req.body;

    if (!employeeId || !date) {
      res.status(400).json({ message: 'employeeId and date are required' });
      return;
    }

    let workedHours: number | undefined = undefined;
    if (checkIn && checkOut) {
      const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
      workedHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
    }

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: new Date(date),
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        workedHours,
        status: status || 'PRESENT',
        notes,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, color: true },
        },
      },
    });

    res.status(201).json(attendance);
  } catch (err) {
    console.error('Create attendance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/attendance/:id - Manual update (HR_MANAGER & ADMIN)
router.put('/:id', authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { checkIn, checkOut, status, notes } = req.body;

    const data: any = {};
    if (checkIn !== undefined) data.checkIn = checkIn ? new Date(checkIn) : null;
    if (checkOut !== undefined) data.checkOut = checkOut ? new Date(checkOut) : null;
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;

    if (data.checkIn && data.checkOut) {
      const diff = new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime();
      data.workedHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
    }

    const attendance = await prisma.attendance.update({
      where: { id },
      data,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeNumber: true, color: true },
        },
      },
    });

    res.json(attendance);
  } catch (err) {
    console.error('Update attendance error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
