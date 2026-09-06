import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// GET /api/employees
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        contracts: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { workingSchedule: true },
        },
        _count: {
          select: { contracts: true, attendances: true, timeOffRequests: true }
        }
      },
      orderBy: { firstName: 'asc' },
    });
    res.json(employees);
  } catch (err) {
    console.error('Fetch employees error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/employees/me
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    let employee = await prisma.employee.findUnique({
      where: { userId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        contracts: {
          orderBy: { startDate: 'desc' },
          include: { workingSchedule: true, salaryStructure: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!employee) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const roleMeta: Record<string, { title: string; dept: string; first: string; last: string }> = {
          HR_PAYROLL_MANAGER: { title: 'HR Payroll Manager', dept: 'Payroll & HR Operations', first: 'Sarah', last: 'Conner' },
          HR_PAYROLL_ADMIN: { title: 'HR Payroll Manager', dept: 'Payroll & HR Operations', first: 'Sarah', last: 'Conner' },
          HR_PAYROLL_USER: { title: 'HR Payroll Specialist', dept: 'Payroll Operations', first: 'Alex', last: 'Morgan' },
          HR_MANAGER: { title: 'HR Manager', dept: 'Human Resources', first: 'Rachel', last: 'Green' },
          ADMIN: { title: 'System Administrator', dept: 'Executive Management', first: 'Admin', last: 'User' },
          EMPLOYEE: { title: 'Employee', dept: 'Engineering', first: 'John', last: 'Doe' },
        };
        const meta = roleMeta[user.role] || { title: 'Team Member', dept: 'General', first: 'User', last: 'Account' };

        employee = await prisma.employee.create({
          data: {
            userId: user.id,
            employeeNumber: `EMP-${user.role.slice(0, 3)}-${user.id.slice(-4).toUpperCase()}`,
            firstName: meta.first,
            lastName: meta.last,
            jobTitle: meta.title,
            department: meta.dept,
            hireDate: new Date('2024-01-01'),
            color: '#6366f1',
          },
          include: {
            manager: { select: { id: true, firstName: true, lastName: true } },
            contracts: {
              orderBy: { startDate: 'desc' },
              include: { workingSchedule: true, salaryStructure: { select: { id: true, name: true } } },
            },
            user: { select: { id: true, email: true, role: true } },
          },
        });
      }
    }

    if (!employee) {
      res.status(404).json({ message: 'Employee profile not found' });
      return;
    }

    res.json(employee);
  } catch (err) {
    console.error('Fetch my profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/employees/me
router.put('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    const { firstName, lastName, dateOfBirth, color } = req.body;

    // Only allow updating personal information fields
    const data: any = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (color !== undefined) data.color = color;
    if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);

    const employee = await prisma.employee.update({
      where: { userId },
      data,
    });

    res.json(employee);
  } catch (err) {
    console.error('Update my profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/employees/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const [employee, attendanceStats, timeOffStats] = await Promise.all([
      prisma.employee.findUnique({
        where: { id },
        include: {
          user: { select: { email: true, role: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          contracts: {
            include: {
              salaryStructure: { select: { id: true, name: true, code: true } },
              workingSchedule: { select: { id: true, name: true, hoursPerWeek: true } },
            },
            orderBy: { startDate: 'desc' },
          },
          attendances: {
            orderBy: { date: 'desc' },
            take: 10,
          },
          timeOffRequests: {
            include: {
              timeOffType: { select: { id: true, name: true, code: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          payslips: {
            include: {
              payrun: { select: { id: true, name: true, state: true, periodStart: true, periodEnd: true } },
              salaryStructure: { select: { id: true, name: true } },
            },
            orderBy: { periodEnd: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              contracts: true,
              attendances: true,
              timeOffRequests: true,
              payslips: true,
            },
          },
        },
      }),
      Promise.all([
        prisma.attendance.count({ where: { employeeId: id, status: 'PRESENT' } }),
        prisma.attendance.count({ where: { employeeId: id, status: 'ABSENT' } }),
        prisma.attendance.count({ where: { employeeId: id, status: 'LATE' } }),
        prisma.attendance.aggregate({ where: { employeeId: id }, _sum: { workedHours: true } }),
      ]),
      Promise.all([
        prisma.timeOffRequest.count({ where: { employeeId: id, status: { in: ['DRAFT', 'CONFIRMED'] } } }),
        prisma.timeOffRequest.count({ where: { employeeId: id, status: { in: ['APPROVED', 'VALIDATED'] } } }),
        prisma.timeOffRequest.count({ where: { employeeId: id, status: 'REFUSED' } }),
      ]),
    ]);

    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    const [presentDays, absentDays, lateDays, workedHoursAgg] = attendanceStats;
    const [pendingTimeOff, approvedTimeOff, refusedTimeOff] = timeOffStats;

    res.json({
      ...employee,
      attendanceSummary: {
        total: employee._count.attendances,
        presentDays,
        absentDays,
        lateDays,
        totalWorkedHours: Math.round((workedHoursAgg._sum.workedHours || 0) * 10) / 10,
      },
      timeOffSummary: {
        total: employee._count.timeOffRequests,
        pending: pendingTimeOff,
        approved: approvedTimeOff,
        refused: refusedTimeOff,
      },
    });
  } catch (err) {
    console.error('Fetch employee error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/employees
router.post('/', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      employeeNumber,
      firstName,
      lastName,
      dateOfBirth,
      hireDate,
      jobTitle,
      department,
      managerId,
      color
    } = req.body;

    const data: any = {
      employeeNumber,
      firstName,
      lastName,
      hireDate: new Date(hireDate),
      jobTitle,
      department,
      color
    };

    if (userId) data.user = { connect: { id: userId } };
    if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);
    if (managerId) data.manager = { connect: { id: managerId } };

    const employee = await prisma.employee.create({
      data,
    });
    res.status(201).json(employee);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      userId,
      employeeNumber,
      firstName,
      lastName,
      dateOfBirth,
      hireDate,
      jobTitle,
      department,
      managerId,
      color
    } = req.body;

    const data: any = {};
    if (employeeNumber) data.employeeNumber = employeeNumber;
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (jobTitle) data.jobTitle = jobTitle;
    if (department !== undefined) data.department = department;
    if (color !== undefined) data.color = color;
    if (hireDate) data.hireDate = new Date(hireDate);
    if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);
    
    if (userId !== undefined) {
      if (userId === null) data.user = { disconnect: true };
      else data.user = { connect: { id: userId } };
    }

    if (managerId !== undefined) {
      if (managerId === null) data.manager = { disconnect: true };
      else data.manager = { connect: { id: managerId } };
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });
    res.json(employee);
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
