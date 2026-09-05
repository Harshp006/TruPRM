import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

router.use(authenticate);

// Helper function to calculate hours per week from lines
const calculateHoursPerWeek = (lines: { timeFrom: string; timeTo: string }[]) => {
  let totalHours = 0;
  for (const line of lines) {
    const [fromH, fromM] = line.timeFrom.split(':').map(Number);
    const [toH, toM] = line.timeTo.split(':').map(Number);
    
    // Simple decimal hours calculation
    const fromDecimal = fromH + fromM / 60;
    const toDecimal = toH + toM / 60;
    
    let hours = toDecimal - fromDecimal;
    if (hours < 0) hours += 24; // Handle overnight shifts if any
    
    totalHours += hours;
  }
  return totalHours;
};

// GET /api/working-schedules
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const schedules = await prisma.workingSchedule.findMany({
      include: {
        _count: { select: { scheduleLines: true, contracts: true } }
      },
      orderBy: { name: 'asc' },
    });
    res.json(schedules);
  } catch (err) {
    console.error('Fetch schedules error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/working-schedules/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const schedule = await prisma.workingSchedule.findUnique({
      where: { id },
      include: {
        scheduleLines: true,
      },
    });

    if (!schedule) {
      res.status(404).json({ message: 'Schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (err) {
    console.error('Fetch schedule error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/working-schedules
router.post('/', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, flexibleHours, scheduleLines } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    const hoursPerWeek = scheduleLines ? calculateHoursPerWeek(scheduleLines) : 0;

    const schedule = await prisma.workingSchedule.create({
      data: {
        name,
        flexibleHours: flexibleHours || false,
        hoursPerWeek,
        scheduleLines: {
          create: scheduleLines || [],
        },
      },
      include: { scheduleLines: true }
    });
    res.status(201).json(schedule);
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/working-schedules/:id
router.put('/:id', authorize('HR_MANAGER', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, flexibleHours, scheduleLines } = req.body;

    const hoursPerWeek = scheduleLines ? calculateHoursPerWeek(scheduleLines) : undefined;

    // Use a transaction to replace lines and update the parent
    const schedule = await prisma.$transaction(async (tx) => {
      // If lines are provided, delete old ones and create new ones
      if (scheduleLines) {
        await tx.scheduleLine.deleteMany({ where: { workingScheduleId: id } });
      }
      
      return await tx.workingSchedule.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(flexibleHours !== undefined && { flexibleHours }),
          ...(hoursPerWeek !== undefined && { hoursPerWeek }),
          ...(scheduleLines && {
            scheduleLines: {
              create: scheduleLines,
            },
          }),
        },
        include: { scheduleLines: true }
      });
    });

    res.json(schedule);
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
