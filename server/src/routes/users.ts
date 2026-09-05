import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();

// All routes here are ADMIN only
router.use(authenticate, authorize('ADMIN', 'HR_MANAGER', 'HR_PAYROLL_ADMIN'));

// GET /api/users
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        mustChangePassword: true,
        createdAt: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, role, employeeId } = req.body;
    
    if (!email || !role) {
      res.status(400).json({ message: 'Email and role are required' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: 'Email already exists' });
      return;
    }

    // Generate a secure temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const data: any = {
      email,
      role,
      passwordHash,
      mustChangePassword: true,
    };

    if (employeeId) {
      data.employee = { connect: { id: employeeId } };
    }

    const user = await prisma.user.create({
      data,
      select: { id: true, email: true, role: true, mustChangePassword: true },
    });

    res.status(201).json({ user, tempPassword });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { role, employeeId } = req.body;

    const data: any = {};
    if (role) data.role = role;
    if (employeeId !== undefined) {
      if (employeeId === null) {
        data.employee = { disconnect: true };
      } else {
        data.employee = { connect: { id: employeeId } };
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, mustChangePassword: true },
    });

    res.json(user);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    res.json({ message: 'Password reset successful', tempPassword });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
