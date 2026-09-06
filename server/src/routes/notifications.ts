import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

// GET /api/notifications — Fetch current user's notifications
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { limit, unreadOnly } = req.query;
    const take = limit ? Math.min(parseInt(String(limit), 10), 100) : 50;

    const where: any = { userId };
    if (unreadOnly === 'true') {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json(notifications);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/notifications/unread-count — Fetch unread count
router.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const count = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Fetch unread count error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/notifications/read-all — Mark all as read
router.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/notifications/:id/read — Mark single notification as read
router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const id = String(req.params.id);

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const existing = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
