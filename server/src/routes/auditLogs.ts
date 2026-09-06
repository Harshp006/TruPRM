import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

// GET /api/audit-logs
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '10', search = '' } = req.query;
    
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;
    
    const searchFilter = search ? {
      OR: [
        { action: { contains: search as string, mode: 'insensitive' as const } },
        { userEmail: { contains: search as string, mode: 'insensitive' as const } },
        { model: { contains: search as string, mode: 'insensitive' as const } },
        { details: { contains: search as string, mode: 'insensitive' as const } }
      ]
    } : {};

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: searchFilter,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({
        where: searchFilter
      })
    ]);

    res.json({
      data: logs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;
