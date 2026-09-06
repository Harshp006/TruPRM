import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  calculateEmployeeLeaveBalances,
  calculateLeaveDays,
  logTimeOffLedger,
} from '../services/timeoffService';
import { createNotification, createRoleNotification } from '../services/notificationService';

const router = Router();

router.use(authenticate);

// ==================== HELPER: GET AUTHENTICATED EMPLOYEE ID ====================
async function getAuthEmployeeId(req: Request): Promise<string | null> {
  const userId = req.user?.userId;
  if (!userId) return null;
  const emp = await prisma.employee.findUnique({ where: { userId } });
  return emp ? emp.id : null;
}

// ==================== LEAVE BALANCES ====================

// GET /api/timeoff/balances
// Employees can only view their own balances; HR/Admin can query any employee or view matrix across employees
router.get('/balances', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);

    let targetEmployeeId = req.query.employeeId ? String(req.query.employeeId) : null;

    if (userRole === 'EMPLOYEE') {
      if (!authEmpId) {
        res.status(403).json({ message: 'Employee record not found for logged in user' });
        return;
      }
      targetEmployeeId = authEmpId; // Force employee scope
    }

    const year = req.query.year ? parseInt(String(req.query.year), 10) : new Date().getFullYear();

    if (targetEmployeeId) {
      // Single employee balance summary
      const balances = await calculateEmployeeLeaveBalances(targetEmployeeId, year);
      const employee = await prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, jobTitle: true },
      });
      res.json({ employee, year, balances });
    } else {
      // HR Matrix across all employees
      const employees = await prisma.employee.findMany({
        select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true, jobTitle: true, color: true },
        orderBy: { firstName: 'asc' },
      });

      const matrix = await Promise.all(
        employees.map(async (emp) => {
          const balances = await calculateEmployeeLeaveBalances(emp.id, year);
          return {
            employee: emp,
            balances,
          };
        })
      );

      res.json({ year, matrix });
    }
  } catch (err) {
    console.error('Fetch leave balances error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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

// POST /api/timeoff/types (Create configurable timeoff type)
router.post(
  '/types',
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        code,
        description,
        unit,
        isPaid,
        requiresAllocation,
        maxDaysPerYear,
        requiresApproval,
        allowEmployeeRequest,
        isEarnedThroughWork,
        allowPartialDays,
        isSandwichLeave,
        allocationMethod,
        allocationAmount,
        carryForwardDays,
        expiryDays,
      } = req.body;

      const type = await prisma.timeOffType.create({
        data: {
          name,
          code: code ? String(code).toUpperCase().replace(/\s+/g, '_') : name.toUpperCase().replace(/\s+/g, '_'),
          description,
          unit: unit || 'DAYS',
          isPaid: isPaid ?? true,
          requiresAllocation: requiresAllocation ?? true,
          maxDaysPerYear: maxDaysPerYear ? parseFloat(maxDaysPerYear) : null,
          requiresApproval: requiresApproval ?? true,
          allowEmployeeRequest: allowEmployeeRequest ?? true,
          isEarnedThroughWork: isEarnedThroughWork ?? false,
          allowPartialDays: allowPartialDays ?? true,
          isSandwichLeave: isSandwichLeave ?? false,
          allocationMethod: allocationMethod || 'MANUAL',
          allocationAmount: allocationAmount ? parseFloat(allocationAmount) : 0,
          carryForwardDays: carryForwardDays ? parseFloat(carryForwardDays) : 0,
          expiryDays: expiryDays ? parseInt(expiryDays, 10) : null,
          isActive: true,
        },
      });
      res.status(201).json(type);
    } catch (err: any) {
      console.error('Create timeoff type error:', err);
      res.status(400).json({ message: err.message || 'Error creating time off type' });
    }
  }
);

// PUT /api/timeoff/types/:id (Update configurable type)
router.put(
  '/types/:id',
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      const data = { ...req.body };
      if (data.maxDaysPerYear != null) data.maxDaysPerYear = parseFloat(data.maxDaysPerYear);
      if (data.allocationAmount != null) data.allocationAmount = parseFloat(data.allocationAmount);
      if (data.carryForwardDays != null) data.carryForwardDays = parseFloat(data.carryForwardDays);

      const updated = await prisma.timeOffType.update({
        where: { id },
        data,
      });
      res.json(updated);
    } catch (err: any) {
      console.error('Update timeoff type error:', err);
      res.status(400).json({ message: err.message || 'Error updating time off type' });
    }
  }
);

// GET /api/timeoff/types/:id
router.get('/types/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const type = await prisma.timeOffType.findUnique({
      where: { id },
      include: {
        _count: { select: { allocations: true, requests: true } },
      },
    });
    if (!type) {
      res.status(404).json({ message: 'Time off type not found' });
      return;
    }
    res.json(type);
  } catch (err) {
    console.error('Fetch timeoff type error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== TIME OFF ALLOCATIONS ====================

// GET /api/timeoff/allocations
router.get('/allocations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);

    const { employeeId: queryEmpId, year } = req.query;
    const where: any = {};

    if (userRole === 'EMPLOYEE') {
      if (!authEmpId) {
        res.status(403).json({ message: 'Employee record required' });
        return;
      }
      where.employeeId = authEmpId;
    } else if (queryEmpId) {
      where.employeeId = String(queryEmpId);
    }

    if (year) where.year = parseInt(String(year), 10);

    const allocations = await prisma.timeOffAllocation.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true } },
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

// GET /api/timeoff/allocations/:id
router.get('/allocations/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);

    const allocation = await prisma.timeOffAllocation.findUnique({
      where: { id },
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
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        timeOffType: true,
      },
    });

    if (!allocation) {
      res.status(404).json({ message: 'Allocation not found' });
      return;
    }

    if (userRole === 'EMPLOYEE' && allocation.employeeId !== authEmpId) {
      res.status(403).json({ message: 'Forbidden: Cannot access another employee\'s allocation' });
      return;
    }

    res.json(allocation);
  } catch (err) {
    console.error('Fetch allocation detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/timeoff/allocations
router.post(
  '/allocations',
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, timeOffTypeId, year, daysAllocated, validityFrom, validityTo } = req.body;
      const allocatedNum = parseFloat(daysAllocated);
      const yearNum = parseInt(year, 10);

      const allocation = await prisma.$transaction(async (tx) => {
        const alloc = await tx.timeOffAllocation.upsert({
          where: {
            employeeId_timeOffTypeId_year: {
              employeeId,
              timeOffTypeId,
              year: yearNum,
            },
          },
          update: {
            daysAllocated: allocatedNum,
            remaining: allocatedNum,
            validityFrom: validityFrom ? new Date(validityFrom) : null,
            validityTo: validityTo ? new Date(validityTo) : null,
          },
          create: {
            employeeId,
            timeOffTypeId,
            year: yearNum,
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

        // Audit ledger entry
        await logTimeOffLedger(
          employeeId,
          timeOffTypeId,
          'ALLOCATION',
          allocatedNum,
          alloc.id,
          `Leave allocation set to ${allocatedNum} days for year ${yearNum}`,
          req.user?.userId || null,
          tx
        );

        return alloc;
      });

      res.status(201).json(allocation);
    } catch (err: any) {
      console.error('Create timeoff allocation error:', err);
      res.status(400).json({ message: err.message || 'Error creating allocation' });
    }
  }
);

// ==================== TIME OFF REQUESTS ====================

// GET /api/timeoff/requests
router.get('/requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);
    const { employeeId: queryEmpId, status, search } = req.query;

    const where: any = {};

    if (userRole === 'EMPLOYEE') {
      if (!authEmpId) {
        res.status(403).json({ message: 'Employee record required' });
        return;
      }
      where.employeeId = authEmpId;
    } else if (queryEmpId) {
      where.employeeId = String(queryEmpId);
    }

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
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, color: true, department: true } },
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

// GET /api/timeoff/requests/:id
router.get('/requests/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);

    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
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
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        timeOffType: true,
      },
    });

    if (!request) {
      res.status(404).json({ message: 'Leave request not found' });
      return;
    }

    if (userRole === 'EMPLOYEE' && request.employeeId !== authEmpId) {
      res.status(403).json({ message: 'Forbidden: Cannot access another employee\'s leave request' });
      return;
    }

    res.json(request);
  } catch (err) {
    console.error('Fetch request detail error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/timeoff/requests - Submit a leave request
router.post('/requests', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);

    const { employeeId: targetEmpId, timeOffTypeId, startDate, endDate, daysRequested, reason } = req.body;

    let employeeId = targetEmpId;
    if (userRole === 'EMPLOYEE' || !employeeId) {
      if (!authEmpId) {
        res.status(400).json({ message: 'Employee record required to submit request' });
        return;
      }
      employeeId = authEmpId;
    }

    const timeOffType = await prisma.timeOffType.findUnique({ where: { id: timeOffTypeId } });
    if (!timeOffType) {
      res.status(404).json({ message: 'Selected time off type not found' });
      return;
    }

    // Auto-calculate days requested including Sandwich Leave rules if applicable
    const calculatedDays = daysRequested
      ? parseFloat(daysRequested)
      : calculateLeaveDays(new Date(startDate), new Date(endDate), timeOffType.isSandwichLeave);

    const request = await prisma.timeOffRequest.create({
      data: {
        employeeId,
        timeOffTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        daysRequested: calculatedDays,
        reason,
        status: 'CONFIRMED', // Submitted pending approval
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
    });

    // Send notification to HR / Manager users
    const empName = `${request.employee.firstName} ${request.employee.lastName}`;
    await createRoleNotification(
      ['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN'],
      {
        title: 'New Leave Request',
        message: `${empName} submitted a leave request for ${calculatedDays} day(s) (${timeOffType.name}).`,
        type: 'TIME_OFF',
        relatedEntityId: request.id,
      }
    );

    res.status(201).json(request);
  } catch (err: any) {
    console.error('Create timeoff request error:', err);
    res.status(400).json({ message: err.message || 'Error submitting leave request' });
  }
});

// POST /api/timeoff/requests/:id/approve - Approve leave request
router.post(
  '/requests/:id/approve',
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requestId = String(req.params.id);

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

        const type = reqToApprove.timeOffType;
        let updatedAllocation = null;

        if (type.isEarnedThroughWork || type.code === 'COMP_OFF') {
          // Comp-Off deduction from available credits
          const credits = await tx.compOffCredit.findMany({
            where: {
              employeeId: reqToApprove.employeeId,
              status: 'APPROVED',
              remainingDays: { gt: 0 },
            },
            orderBy: { dateEarned: 'asc' },
          });

          let needed = reqToApprove.daysRequested;
          for (const credit of credits) {
            if (needed <= 0) break;
            const deduct = Math.min(credit.remainingDays, needed);
            await tx.compOffCredit.update({
              where: { id: credit.id },
              data: {
                usedDays: credit.usedDays + deduct,
                remainingDays: credit.remainingDays - deduct,
              },
            });
            needed -= deduct;
          }
        } else if (type.requiresAllocation) {
          const year = new Date(reqToApprove.startDate).getFullYear();
          const allocation = await tx.timeOffAllocation.findFirst({
            where: {
              employeeId: reqToApprove.employeeId,
              timeOffTypeId: reqToApprove.timeOffTypeId,
              year,
            },
          });

          if (!allocation) {
            throw new Error(`No leave allocation record found for year ${year}`);
          }

          if (allocation.remaining < reqToApprove.daysRequested) {
            throw new Error(`Insufficient leave balance. Remaining: ${allocation.remaining}, Requested: ${reqToApprove.daysRequested}`);
          }

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

        // Audit Ledger Logging
        await logTimeOffLedger(
          reqToApprove.employeeId,
          reqToApprove.timeOffTypeId,
          'LEAVE_TAKEN',
          -reqToApprove.daysRequested,
          reqToApprove.id,
          `Approved leave request #${reqToApprove.id.slice(-6)} (${reqToApprove.daysRequested} ${type.unit})`,
          req.user?.userId || null,
          tx
        );

        return [approvedRequest, updatedAllocation];
      });

      // Send notification to employee
      const empUser = await prisma.employee.findUnique({
        where: { id: (updatedReq as any).employeeId },
        select: { userId: true },
      });
      if (empUser?.userId) {
        await createNotification({
          userId: empUser.userId,
          title: 'Leave Request Approved',
          message: `Your leave request for ${(updatedReq as any).timeOffType?.name || 'Leave'} (${new Date((updatedReq as any).startDate).toISOString().slice(0, 10)} to ${new Date((updatedReq as any).endDate).toISOString().slice(0, 10)}) has been approved.`,
          type: 'TIME_OFF',
          relatedEntityId: (updatedReq as any).id,
        });
      }

      res.json({
        message: 'Leave request approved successfully',
        request: updatedReq,
        allocation: updatedAlloc,
      });
    } catch (err: any) {
      console.error('Approve timeoff request error:', err);
      res.status(400).json({ message: err.message || 'Failed to approve leave request' });
    }
  }
);

// POST /api/timeoff/requests/:id/refuse - Refuse leave request
router.post(
  '/requests/:id/refuse',
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requestId = String(req.params.id);
      const { refusalReason } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.timeOffRequest.findUnique({
          where: { id: requestId },
          include: { timeOffType: true },
        });

        if (!existing) {
          throw new Error('Time off request not found');
        }

        const type = existing.timeOffType;

        // If previously approved, reverse the deduction
        if (existing.status === 'APPROVED') {
          if (type.requiresAllocation && !type.isEarnedThroughWork) {
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

          // Log restoration ledger entry
          await logTimeOffLedger(
            existing.employeeId,
            existing.timeOffTypeId,
            'LEAVE_RESTORED',
            existing.daysRequested,
            existing.id,
            `Restored ${existing.daysRequested} days from refused request #${existing.id.slice(-6)}`,
            req.user?.userId || null,
            tx
          );
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

      // Send notification to employee
      const empUser = await prisma.employee.findUnique({
        where: { id: result.employeeId },
        select: { userId: true },
      });
      if (empUser?.userId) {
        await createNotification({
          userId: empUser.userId,
          title: 'Leave Request Refused',
          message: `Your leave request for ${result.timeOffType?.name || 'Leave'} was refused. Reason: ${refusalReason || 'Refused by HR/Manager'}`,
          type: 'TIME_OFF',
          relatedEntityId: result.id,
        });
      }

      res.json({
        message: 'Leave request refused',
        request: result,
      });
    } catch (err: any) {
      console.error('Refuse timeoff request error:', err);
      res.status(400).json({ message: err.message || 'Failed to refuse leave request' });
    }
  }
);
// POST /api/timeoff/requests/:id/cancel - Employee cancels own pending leave request
router.post('/requests/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestId = String(req.params.id);
    const authEmpId = await getAuthEmployeeId(req);

    if (!authEmpId) {
      res.status(403).json({ message: 'Employee record required to cancel request' });
      return;
    }

    const existingReq = await prisma.timeOffRequest.findUnique({
      where: { id: requestId },
      include: { timeOffType: true },
    });

    if (!existingReq) {
      res.status(404).json({ message: 'Time off request not found' });
      return;
    }

    // 1. Verify ownership: must belong to the logged in employee
    if (existingReq.employeeId !== authEmpId) {
      res.status(403).json({ message: 'Forbidden: You can only cancel your own leave requests' });
      return;
    }

    // 2. Status verification: Must NOT be APPROVED, CANCELLED, or REFUSED
    if (existingReq.status === 'APPROVED') {
      res.status(400).json({ message: 'Approved leave requests cannot be cancelled' });
      return;
    }

    if (existingReq.status === 'CANCELLED') {
      res.status(400).json({ message: 'Request is already cancelled' });
      return;
    }

    if (existingReq.status === 'REFUSED') {
      res.status(400).json({ message: 'Refused requests cannot be cancelled' });
      return;
    }

    // Update status to CANCELLED without consuming leave allocation
    const cancelledReq = await prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: true,
      },
    });

    // Notify HR / Manager users
    const empName = `${cancelledReq.employee.firstName} ${cancelledReq.employee.lastName}`;
    await createRoleNotification(
      ['ADMIN', 'HR_MANAGER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN'],
      {
        title: 'Leave Request Cancelled',
        message: `${empName} cancelled their pending leave request for ${cancelledReq.timeOffType.name}.`,
        type: 'TIME_OFF',
        relatedEntityId: cancelledReq.id,
      }
    );

    res.json({
      message: 'Leave request cancelled successfully',
      request: cancelledReq,
    });
  } catch (err: any) {
    console.error('Cancel timeoff request error:', err);
    res.status(500).json({ message: err.message || 'Failed to cancel leave request' });
  }
});

// ==================== COMP-OFF CREDITS ====================

// GET /api/timeoff/compoff
router.get('/compoff', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);
    const { employeeId: queryEmpId } = req.query;

    const where: any = {};

    if (userRole === 'EMPLOYEE') {
      if (!authEmpId) {
        res.status(403).json({ message: 'Employee record required' });
        return;
      }
      where.employeeId = authEmpId;
    } else if (queryEmpId) {
      where.employeeId = String(queryEmpId);
    }

    const credits = await prisma.compOffCredit.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, department: true } },
        attendance: { select: { id: true, date: true, checkIn: true, checkOut: true, overtimeHours: true } },
      },
      orderBy: { dateEarned: 'desc' },
    });

    res.json(credits);
  } catch (err) {
    console.error('Fetch comp-off credits error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/timeoff/compoff/credit - Award Comp-Off Credit (HR only)
router.post(
  '/compoff/credit',
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, dateEarned, daysEarned, hoursWorked, reason, attendanceId, expiryDays } = req.body;

      const daysNum = parseFloat(daysEarned);
      const dateObj = new Date(dateEarned);

      let expiryDate: Date | null = null;
      if (expiryDays) {
        expiryDate = new Date(dateObj);
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays, 10));
      }

      // Find or get Comp-Off TimeOffType
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

      const credit = await prisma.$transaction(async (tx) => {
        const cr = await tx.compOffCredit.create({
          data: {
            employeeId,
            attendanceId: attendanceId || null,
            dateEarned: dateObj,
            daysEarned: daysNum,
            hoursWorked: hoursWorked ? parseFloat(hoursWorked) : null,
            reason: reason || 'Earned via extra work/overtime',
            status: 'APPROVED',
            approvedById: req.user?.userId,
            expiryDate,
            usedDays: 0,
            remainingDays: daysNum,
          },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          },
        });

        // Audit ledger entry
        await logTimeOffLedger(
          employeeId,
          compOffType.id,
          'COMP_OFF_EARNED',
          daysNum,
          cr.id,
          `Awarded ${daysNum} day(s) Comp-Off for additional work on ${dateObj.toISOString().slice(0, 10)}`,
          req.user?.userId || null,
          tx
        );

        return cr;
      });

      res.status(201).json(credit);
    } catch (err: any) {
      console.error('Credit Comp-Off error:', err);
      res.status(400).json({ message: err.message || 'Error crediting Comp-Off' });
    }
  }
);

// ==================== TIME OFF LEDGER / AUDIT TRAIL ====================

// GET /api/timeoff/ledger
router.get('/ledger', async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const authEmpId = await getAuthEmployeeId(req);
    const { employeeId: queryEmpId, timeOffTypeId } = req.query;

    const where: any = {};

    if (userRole === 'EMPLOYEE') {
      if (!authEmpId) {
        res.status(403).json({ message: 'Employee record required' });
        return;
      }
      where.employeeId = authEmpId;
    } else if (queryEmpId) {
      where.employeeId = String(queryEmpId);
    }

    if (timeOffTypeId) where.timeOffTypeId = String(timeOffTypeId);

    const ledgers = await prisma.timeOffLedger.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        timeOffType: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(ledgers);
  } catch (err) {
    console.error('Fetch timeoff ledger error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
