import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// GET /api/contracts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        workingSchedule: { select: { id: true, name: true } }
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(contracts);
  } catch (err) {
    console.error('Fetch contracts error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/contracts/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        workingSchedule: { select: { id: true, name: true } },
        salaryStructure: { select: { id: true, name: true } }
      },
    });

    if (!contract) {
      res.status(404).json({ message: 'Contract not found' });
      return;
    }
    res.json(contract);
  } catch (err) {
    console.error('Fetch contract error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/contracts
router.post('/', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      employeeId,
      contractType,
      status,
      startDate,
      endDate,
      wageCurrency,
      wageAmount,
      workingScheduleId,
      salaryStructureId,
      notes
    } = req.body;

    if (!employeeId || !startDate || wageAmount === undefined || wageAmount === '') {
      res.status(400).json({ message: 'Employee, start date, and wage amount are required' });
      return;
    }

    const start = new Date(startDate);
    const end = endDate && endDate.trim() !== '' ? new Date(endDate) : null;
    const contractStatus = status || 'ACTIVE';
    const schedId = workingScheduleId && workingScheduleId.trim() !== '' ? workingScheduleId : null;
    const structId = salaryStructureId && salaryStructureId.trim() !== '' ? salaryStructureId : null;

    const newContract = await prisma.$transaction(async (tx) => {
      if (contractStatus === 'ACTIVE') {
        const overlapping = await tx.contract.findFirst({
          where: {
            employeeId,
            status: 'ACTIVE',
            OR: [
              { endDate: null },
              { endDate: { gte: start } }
            ],
            ...(end && { startDate: { lte: end } })
          }
        });

        if (overlapping) {
          throw new Error('Employee already has an overlapping active contract');
        }
      }

      const data: any = {
        employeeId,
        contractType: contractType || 'FULL_TIME',
        status: contractStatus,
        startDate: start,
        endDate: end,
        wageCurrency: wageCurrency || 'USD',
        wageAmount,
        notes: notes || null
      };

      if (schedId) data.workingScheduleId = schedId;
      if (structId) data.salaryStructureId = structId;

      return await tx.contract.create({
        data
      });
    });

    res.status(201).json(newContract);
  } catch (err: any) {
    console.error('Create contract error:', err);
    res.status(400).json({ message: err.message || 'Failed to create contract' });
  }
});

// PUT /api/contracts/:id
router.put('/:id', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const {
      employeeId,
      contractType,
      status,
      startDate,
      endDate,
      wageCurrency,
      wageAmount,
      workingScheduleId,
      salaryStructureId,
      notes
    } = req.body;

    const currentContract = await prisma.contract.findUnique({ where: { id } });
    if (!currentContract) {
      res.status(404).json({ message: 'Contract not found' });
      return;
    }

    const start = startDate ? new Date(startDate) : currentContract.startDate;
    const end = endDate !== undefined ? (endDate && endDate.trim() !== '' ? new Date(endDate) : null) : currentContract.endDate;
    const contractStatus = status || currentContract.status;
    const empId = employeeId || currentContract.employeeId;
    const schedId = workingScheduleId !== undefined ? (workingScheduleId && workingScheduleId.trim() !== '' ? workingScheduleId : null) : undefined;
    const structId = salaryStructureId !== undefined ? (salaryStructureId && salaryStructureId.trim() !== '' ? salaryStructureId : null) : undefined;

    const updatedContract = await prisma.$transaction(async (tx) => {
      if (contractStatus === 'ACTIVE') {
        const overlapping = await tx.contract.findFirst({
          where: {
            id: { not: id as string },
            employeeId: empId,
            status: 'ACTIVE',
            OR: [
              { endDate: null },
              { endDate: { gte: start } }
            ],
            ...(end && { startDate: { lte: end } })
          }
        });

        if (overlapping) {
          throw new Error('Employee already has an overlapping active contract');
        }
      }

      const data: any = {};
      if (employeeId) data.employeeId = employeeId;
      if (contractType) data.contractType = contractType;
      if (status) data.status = status;
      if (startDate) data.startDate = start;
      if (endDate !== undefined) data.endDate = end;
      if (wageCurrency) data.wageCurrency = wageCurrency;
      if (wageAmount !== undefined) data.wageAmount = wageAmount;
      if (notes !== undefined) data.notes = notes;
      
      if (schedId !== undefined) {
        if (schedId === null) data.workingSchedule = { disconnect: true };
        else data.workingSchedule = { connect: { id: schedId } };
      }
      if (structId !== undefined) {
        if (structId === null) data.salaryStructure = { disconnect: true };
        else data.salaryStructure = { connect: { id: structId } };
      }

      return await tx.contract.update({
        where: { id: id as string },
        data
      });
    });

    res.json(updatedContract);
  } catch (err: any) {
    console.error('Update contract error:', err);
    res.status(400).json({ message: err.message || 'Failed to update contract' });
  }
});

export default router;
