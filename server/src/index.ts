import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import employeesRouter from './routes/employees';
import workingSchedulesRouter from './routes/working-schedules';
import contractsRouter from './routes/contracts';
import attendanceRouter from './routes/attendance';
import timeoffRouter from './routes/timeoff';
import timeOffRouter from './routes/time-off';
import salaryStructuresRouter from './routes/salary-structures';
import salaryRulesRouter from './routes/salary-rules';
import payrunsRouter from './routes/payruns';
import payslipsRouter from './routes/payslips';
import dashboardRouter from './routes/dashboard';
import { authenticate } from './middleware/authenticate';
import { authorize } from './middleware/authorize';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// ── Public routes ──────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/working-schedules', workingSchedulesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/timeoff', timeoffRouter);
app.use('/api/time-off', timeOffRouter);
app.use('/api/salary-structures', salaryStructuresRouter);
app.use('/api/salary-rules', salaryRulesRouter);
app.use('/api/payruns', payrunsRouter);
app.use('/api/payslips', payslipsRouter);
app.use('/api/dashboard', dashboardRouter);

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
