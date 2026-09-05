import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// ==================== TIME OFF TYPES ====================

// GET /api/timeoff/types
router.get('/types', async (req: Request, res: Response): Promise<void> => {
  try {
    const types = await prisma.timeOffType.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (err) {
    console.error('Fetch timeoff types error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/timeoff/types
router.post('/types', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, code, unit, isPaid, requiresAllocation, maxDaysPerYear, requiresApproval } = req.body;

    const type = await prisma.timeOffType.create({
      data: {
        name,
        code,
        unit: unit || 'DAYS',
        isPaid: isPaid ?? true,
        requiresAllocation: requiresAllocation ?? true,
        maxDaysPerYear: maxDaysPerYear ? parseFloat(maxDaysPerYear) : null,
        requiresApproval: requiresApproval ?? true,
      },
    });
    res.status(201).json(type);
  } catch (err: any) {
    console.error('Create timeoff type error:', err);
    res.status(400).json({ message: err.message || 'Error creating time off type' });
  }
});

// ==================== TIME OFF ALLOCATIONS ====================

// GET /api/timeoff/allocations
router.get('/allocations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, year } = req.query;
    const where: any = {};
    if (employeeId) where.employeeId = String(employeeId);
    if (year) where.year = parseInt(String(year), 10);

    const allocations = await prisma.timeOffAllocation.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
      orderBy: { year: 'desc' },
    });
    res.json(allocations);
  } catch (err) {
    console.error('Fetch timeoff allocations error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/timeoff/allocations (Create/Set allocation)
router.post('/allocations', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, timeOffTypeId, year, daysAllocated, validityFrom, validityTo } = req.body;

    const allocatedNum = parseFloat(daysAllocated);

    const allocation = await prisma.timeOffAllocation.upsert({
      where: {
        employeeId_timeOffTypeId_year: {
          employeeId,
          timeOffTypeId,
          year: parseInt(year, 10),
        },
      },
      update: {
        daysAllocated: allocatedNum,
        remaining: allocatedNum, // Reset remaining for allocation update
        validityFrom: validityFrom ? new Date(validityFrom) : null,
        validityTo: validityTo ? new Date(validityTo) : null,
      },
      create: {
        employeeId,
        timeOffTypeId,
        year: parseInt(year, 10),
        daysAllocated: allocatedNum,
        daysUsed: 0,
        remaining: allocatedNum,
        validityFrom: validityFrom ? new Date(validityFrom) : null,
        validityTo: validityTo ? new Date(validityTo) : null,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
    });

    res.status(201).json(allocation);
  } catch (err: any) {
    console.error('Create timeoff allocation error:', err);
    res.status(400).json({ message: err.message || 'Error creating allocation' });
  }
});

// ==================== TIME OFF REQUESTS ====================

// GET /api/timeoff/requests
router.get('/requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, status, search } = req.query;
    const where: any = {};

    if (employeeId) where.employeeId = String(employeeId);
    if (status) where.status = String(status);

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { employee: { firstName: { contains: q, mode: 'insensitive' } } },
        { employee: { lastName: { contains: q, mode: 'insensitive' } } },
        { timeOffType: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const requests = await prisma.timeOffRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, color: true } },
        timeOffType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    console.error('Fetch timeoff requests error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/timeoff/requests - Submit a request
router.post('/requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { employeeId: targetEmpId, timeOffTypeId, startDate, endDate, daysRequested, reason } = req.body;

    let employeeId = targetEmpId;
    if (!employeeId && userId) {
      const emp = await prisma.employee.findUnique({ where: { userId } });
      if (emp) employeeId = emp.id;
    }

    if (!employeeId) {
      res.status(400).json({ message: 'Employee record required to submit time off request' });
      return;
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        employeeId,
        timeOffTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysRequested: parseFloat(daysRequested),
        reason,
        status: 'CONFIRMED', // Submitted status
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
    });

    res.status(201).json(request);
  } catch (err: any) {
    console.error('Create timeoff request error:', err);
    res.status(400).json({ message: err.message || 'Error submitting request' });
  }
});

// POST /api/timeoff/requests/:id/approve - Approve leave request (STRICT SINGLE PRISMA TRANSACTION)
router.post('/requests/:id/approve', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const requestId = req.params.id as string;

    const [updatedReq, updatedAlloc] = await prisma.$transaction(async (tx) => {
      const reqToApprove = await tx.timeOffRequest.findUnique({
        where: { id: requestId },
        include: { timeOffType: true },
      });

      if (!reqToApprove) {
        throw new Error('Time off request not found');
      }

      if (reqToApprove.status === 'APPROVED') {
        throw new Error('Request is already approved');
      }

      let updatedAllocation = null;

      const timeOffType = (reqToApprove as any).timeOffType;

      if (timeOffType?.requiresAllocation) {
        const year = new Date(reqToApprove.startDate).getFullYear();
        const allocation = await tx.timeOffAllocation.findFirst({
          where: {
            employeeId: reqToApprove.employeeId,
            timeOffTypeId: reqToApprove.timeOffTypeId,
            year,
          },
        });

        if (!allocation) {
          throw new Error(`No time off allocation found for year ${year}`);
        }

        if (allocation.remaining < reqToApprove.daysRequested) {
          throw new Error(`Insufficient leave allocation balance. Remaining: ${allocation.remaining}, Requested: ${reqToApprove.daysRequested}`);
        }

        // Increment daysUsed and decrement remaining in single transaction
        updatedAllocation = await tx.timeOffAllocation.update({
          where: { id: allocation.id },
          data: {
            daysUsed: allocation.daysUsed + reqToApprove.daysRequested,
            remaining: allocation.remaining - reqToApprove.daysRequested,
          },
        });
      }

      const approvedRequest = await tx.timeOffRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedById: req.user?.userId,
          approvedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          timeOffType: true,
        },
      });

      return [approvedRequest, updatedAllocation];
    });

    res.json({
      message: 'Time off request approved successfully',
      request: updatedReq,
      allocation: updatedAlloc,
    });
  } catch (err: any) {
    console.error('Approve timeoff request error:', err);
    res.status(400).json({ message: err.message || 'Failed to approve time off request' });
  }
});

// POST /api/timeoff/requests/:id/refuse - Refuse leave request
router.post('/requests/:id/refuse', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const requestId = req.params.id as string;
    const { refusalReason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.timeOffRequest.findUnique({
        where: { id: requestId },
        include: { timeOffType: true },
      });

      if (!existing) {
        throw new Error('Time off request not found');
      }

      const timeOffType = (existing as any).timeOffType;

      // If it was previously approved and required allocation, reverse the allocation decrement
      if (existing.status === 'APPROVED' && timeOffType?.requiresAllocation) {
        const year = new Date(existing.startDate).getFullYear();
        const allocation = await tx.timeOffAllocation.findFirst({
          where: {
            employeeId: existing.employeeId,
            timeOffTypeId: existing.timeOffTypeId,
            year,
          },
        });

        if (allocation) {
          await tx.timeOffAllocation.update({
            where: { id: allocation.id },
            data: {
              daysUsed: Math.max(0, allocation.daysUsed - existing.daysRequested),
              remaining: allocation.remaining + existing.daysRequested,
            },
          });
        }
      }

      const refusedReq = await tx.timeOffRequest.update({
        where: { id: requestId },
        data: {
          status: 'REFUSED',
          refusalReason: refusalReason || 'Request refused by HR/Manager',
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          timeOffType: true,
        },
      });

      return refusedReq;
    });

    res.json({
      message: 'Time off request refused',
      request: result,
    });
  } catch (err: any) {
    console.error('Refuse timeoff request error:', err);
    res.status(400).json({ message: err.message || 'Failed to refuse time off request' });
  }
});

export default router;
