import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import authRouter from './routes/auth';
import { authenticate } from './middleware/authenticate';
import { authorize } from './middleware/authorize';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ── Public routes ──────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);

// ── Protected test routes ──────────────────────────────────────────────────
// Any authenticated user
app.get('/api/protected', authenticate, (_req: Request, res: Response) => {
  res.json({ message: 'Authenticated successfully', user: _req.user });
});

// Only ADMIN
app.get(
  '/api/admin-only',
  authenticate,
  authorize('ADMIN'),
  (_req: Request, res: Response) => {
    res.json({ message: 'Welcome, Admin!' });
  }
);

// Only HR roles (not EMPLOYEE)
app.get(
  '/api/hr-only',
  authenticate,
  authorize('HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_ADMIN', 'ADMIN'),
  (_req: Request, res: Response) => {
    res.json({ message: 'Welcome, HR team!' });
  }
);

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
