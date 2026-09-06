import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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
router.post('/', authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'), async (req: Request, res: Response): Promise<void> => {
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

    if (!firstName || !lastName || !jobTitle) {
      res.status(400).json({ message: 'First Name, Last Name, and Job Title are required.' });
      return;
    }

    let finalEmpNumber = employeeNumber ? String(employeeNumber).trim() : '';
    if (!finalEmpNumber) {
      finalEmpNumber = `EMP-${Date.now().toString().slice(-6)}`;
    }

    // Check unique employee number
    const existingEmpNum = await prisma.employee.findUnique({ where: { employeeNumber: finalEmpNumber } });
    if (existingEmpNum) {
      // If user provided a specific number that exists, alert them or generate a unique suffix
      if (employeeNumber) {
        res.status(400).json({ message: `Employee Number "${finalEmpNumber}" already exists. Please use a unique number.` });
        return;
      }
      finalEmpNumber = `${finalEmpNumber}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const parsedHireDate = hireDate ? new Date(hireDate) : new Date();
    if (isNaN(parsedHireDate.getTime())) {
      res.status(400).json({ message: 'Please provide a valid Hire Date.' });
      return;
    }

    const data: any = {
      employeeNumber: finalEmpNumber,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      hireDate: parsedHireDate,
      jobTitle: String(jobTitle).trim(),
      department: department ? String(department).trim() : null,
      color: color || '#6366f1'
    };

    if (dateOfBirth && String(dateOfBirth).trim() !== '') {
      const parsedDob = new Date(dateOfBirth);
      if (!isNaN(parsedDob.getTime())) {
        data.dateOfBirth = parsedDob;
      }
    }

    if (managerId && String(managerId).trim() !== '') {
      const mgr = await prisma.employee.findUnique({ where: { id: String(managerId) } });
      if (mgr) {
        data.manager = { connect: { id: mgr.id } };
      }
    }

    if (userId && String(userId).trim() !== '') {
      const existingUserLink = await prisma.employee.findUnique({ where: { userId: String(userId) } });
      if (existingUserLink) {
        res.status(400).json({ message: 'The selected user account is already linked to another employee.' });
        return;
      }
      data.user = { connect: { id: String(userId) } };
    } else {
      // Auto-create linked user account if none selected
      const sanitizedFn = (firstName || 'emp').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sanitizedLn = (lastName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
      const generatedEmail = `${sanitizedFn}.${sanitizedLn}.${Date.now()}@truprm.com`;
      const defaultPasswordHash = await bcrypt.hash('password123', 12);
      data.user = {
        create: {
          email: generatedEmail,
          passwordHash: defaultPasswordHash,
          role: 'EMPLOYEE',
          mustChangePassword: true,
        },
      };
    }

    const employee = await prisma.employee.create({
      data,
      include: {
        user: { select: { id: true, email: true, role: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(employee);
  } catch (err: any) {
    console.error('Create employee error:', err);
    res.status(400).json({ message: err.message || 'Failed to create employee record' });
  }
});

// PUT /api/employees/:id
router.put('/:id', authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN'), async (req: Request, res: Response): Promise<void> => {
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
    if (employeeNumber) {
      const cleanEmpNum = String(employeeNumber).trim();
      const existing = await prisma.employee.findFirst({
        where: { employeeNumber: cleanEmpNum, id: { not: id } }
      });
      if (existing) {
        res.status(400).json({ message: `Employee Number "${cleanEmpNum}" already belongs to another employee.` });
        return;
      }
      data.employeeNumber = cleanEmpNum;
    }

    if (firstName) data.firstName = String(firstName).trim();
    if (lastName) data.lastName = String(lastName).trim();
    if (jobTitle) data.jobTitle = String(jobTitle).trim();
    if (department !== undefined) data.department = department ? String(department).trim() : null;
    if (color !== undefined) data.color = color;
    
    if (hireDate) {
      const parsedHireDate = new Date(hireDate);
      if (!isNaN(parsedHireDate.getTime())) data.hireDate = parsedHireDate;
    }

    if (dateOfBirth !== undefined) {
      if (dateOfBirth && String(dateOfBirth).trim() !== '') {
        const parsedDob = new Date(dateOfBirth);
        if (!isNaN(parsedDob.getTime())) data.dateOfBirth = parsedDob;
      } else {
        data.dateOfBirth = null;
      }
    }
    
    if (userId !== undefined) {
      if (!userId || String(userId).trim() === '') {
        data.user = { disconnect: true };
      } else {
        const existingLink = await prisma.employee.findFirst({
          where: { userId: String(userId), id: { not: id } }
        });
        if (existingLink) {
          res.status(400).json({ message: 'The selected user account is already linked to another employee.' });
          return;
        }
        data.user = { connect: { id: String(userId) } };
      }
    }

    if (managerId !== undefined) {
      if (!managerId || String(managerId).trim() === '') {
        data.manager = { disconnect: true };
      } else {
        data.manager = { connect: { id: String(managerId) } };
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });
    res.json(employee);
  } catch (err: any) {
    console.error('Update employee error:', err);
    res.status(400).json({ message: err.message || 'Failed to update employee' });
  }
});

export default router;
