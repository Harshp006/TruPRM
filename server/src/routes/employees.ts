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
          take: 1
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

// GET /api/employees/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, role: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        contracts: { orderBy: { startDate: 'desc' } },
        _count: { select: { contracts: true, attendances: true, timeOffRequests: true } }
      },
    });

    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }
    res.json(employee);
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
    const { id } = req.params;
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
