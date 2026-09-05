import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

// GET /api/time-off/types
router.get('/types', async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = await prisma.timeOffType.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { allocations: true, requests: true } },
      },
    });
    res.json(types);
  } catch (err) {
    console.error('Fetch time-off types error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/time-off/allocations
router.get('/allocations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, year } = req.query;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;
    if (year) where.year = parseInt(year as string, 10);

    const allocations = await prisma.timeOffAllocation.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: true,
          },
        },
        timeOffType: true,
      },
      orderBy: { year: 'desc' },
    });
    res.json(allocations);
  } catch (err) {
    console.error('Fetch time-off allocations error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/time-off/requests
router.get('/requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, status } = req.query;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId as string;
    if (status) where.status = status as any;

    const requests = await prisma.timeOffRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: true,
            color: true,
          },
        },
        timeOffType: true,
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(requests);
  } catch (err) {
    console.error('Fetch time-off requests error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/time-off/requests
router.post('/requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, timeOffTypeId, startDate, endDate, daysRequested, reason } = req.body;

    if (!employeeId || !timeOffTypeId || !startDate || !endDate || !daysRequested) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        employeeId,
        timeOffTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysRequested: Number(daysRequested),
        reason: reason || null,
        status: 'DRAFT',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        timeOffType: true,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    console.error('Create time-off request error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/time-off/requests/:id/approve (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.patch(
  '/requests/:id/approve',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const request = await prisma.timeOffRequest.update({
        where: { id },
        data: {
          status: 'VALIDATED',
          approvedById: req.user?.userId || null,
          approvedAt: new Date(),
        },
        include: {
          employee: true,
          timeOffType: true,
        },
      });
      res.json(request);
    } catch (err) {
      console.error('Approve time-off request error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PATCH /api/time-off/requests/:id/refuse (HR_MANAGER / ADMIN / HR_PAYROLL_ADMIN only)
router.patch(
  '/requests/:id/refuse',
  authorize('HR_MANAGER', 'ADMIN', 'HR_PAYROLL_ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { refusalReason } = req.body;
      const request = await prisma.timeOffRequest.update({
        where: { id },
        data: {
          status: 'REFUSED',
          refusalReason: refusalReason || 'Request refused by HR Manager',
        },
        include: {
          employee: true,
          timeOffType: true,
        },
      });
      res.json(request);
    } catch (err) {
      console.error('Refuse time-off request error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router;
