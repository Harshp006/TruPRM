# TruPRM

TruPRM is a platform for pull request monitoring, management, and process automation.

## Phase Checklist
- [x] Phase 0: Monorepo & Core Setup
- [x] Phase 1: Authentication & User Management
- [ ] Phase 2: Core Data Models & APIs
- [ ] Phase 3: Elasticsearch Integration & Search Features
- [ ] Phase 4: Frontend UI & Integration

## Progress Log
- Phase 0 complete: Monorepo initialized with /client (React + Vite + Tailwind CSS) and /server (Node + Express + Prisma, TypeScript), GET /health returns {status: "ok"}, and client dev server loaded with Tailwind CSS.
- Phase 1 complete: Full Prisma schema (15 models: User, Employee, Contract, WorkingSchedule, ScheduleLine, Attendance, TimeOffType, TimeOffAllocation, TimeOffRequest, SalaryStructure, SalaryRule, Payrun, Payslip, PayslipLine) with 5 hardcoded roles (EMPLOYEE, HR_MANAGER, HR_PAYROLL_USER, HR_PAYROLL_ADMIN, ADMIN). Implemented POST /auth/login (bcrypt + JWT, 8h expiry), authenticate middleware, authorize() factory, hardcoded permission map (src/lib/permissions.ts), seed script seeding admin from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD. React: AuthContext (JWT in memory), axios interceptor, login page, ProtectedRoute with role filtering. Verified: ADMIN login returns 200, EMPLOYEE on admin-only route returns 403. Decision: JWT stored in memory (not localStorage) for XSS safety.

## Docker Setup
To set up and run the application using Docker, follow these steps:

1. Start the Docker containers in detached mode:
   ```bash
   docker compose up -d
   ```

2. Run Prisma migrations to set up the database schema:
   ```bash
   npx prisma migrate dev
   ```

3. Seed the database with initial data:
   ```bash
   npx prisma db seed
   ```
