# TruPRM (formerly PeoplePay360)

An integrated Human Resource and Payroll Operations Platform designed to manage the full employee lifecycle—from master data and time tracking to complex payroll calculation and reporting.

## 🚀 Features

### 1. Unified HR Flow
Centralized employee records act as the operational hub, providing seamless navigation to related Contracts, Attendance, and Time Off entries.

### 2. Contract Management
Maintains historical contract records (Full-Time, Part-Time, Contractor, Intern) and ensures the payroll computation engine strictly uses the contract active during the requested pay period.

### 3. Operational Tracking
- **Working Schedules**: Configure standard and flexible weekly patterns to automatically compute expected hours.
- **Attendance**: Capture daily check-ins, check-outs, worked hours, and exceptions, with manual correction support for HR Managers.
- **Time Off**: Automates leave management, including custom Time Off Types, Allocations, and Requests. Approved requests dynamically deduct from available allocation balances.

### 4. Payroll Engine & Processing
- **Salary Configuration**: Highly flexible Salary Structures and Rules. Supports Basic, Allowance, Deduction, and Employer Contribution categories with fixed, percentage, and conditional formula calculation methods.
- **Payrun Wizard**: A robust batch processing system for selecting eligible employees based on active contracts and evaluating all salary rules in sequence.
- **Validation**: Surfaces warnings for missing bank details, missing rules, or incomplete data prior to finalizing a Payrun.
- **Payslip Distribution**: Generates dynamic PDF payslips on-demand and supports bulk email distribution directly from finalized Payruns.

### 5. Reporting Dashboard
Live, dynamic HR and Payroll metrics summarizing costs, attendance health, time-off balances, and headcount by department, completely driven by real-time system data.

## 👥 Role-Based Access Control

The platform enforces strict role-based data and module access:
- **`EMPLOYEE`**: Read-only access to own profile, attendance, and leave. Can create check-ins and time-off requests.
- **`HR_MANAGER`**: Full administrative access to HR modules (Employees, Attendance, Contracts, Schedules, Time Off). No access to payroll data or processing.
- **`HR_PAYROLL_USER`**: Inherits `HR_MANAGER` permissions plus read/write access to Payruns and Payslips. Read-only access to Salary Configuration.
- **`HR_PAYROLL_ADMIN`**: Full administrative access to Payroll processing and Salary Configuration.
- **`ADMIN`**: Superuser with complete system access, including User Management.

## 🛠️ Technology Stack
- **Frontend**: React (Vite), TypeScript, Tailwind CSS, React Router, Recharts, html2pdf.js
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Security**: JWT Authentication, Role-based Middleware Authorization

## 🏗️ Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### Installation

1. **Clone the repository**
2. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
3. **Configure Environment**
   Create a `.env` file in the `server` directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/truprm"
   JWT_SECRET="your_jwt_secret"
   PORT=5000
   ```
4. **Initialize Database**
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   # Optional: Seed the database
   npm run seed
   ```
5. **Start Application**
   ```bash
   # Terminal 1 - Start Server
   cd server && npm run dev
   
   # Terminal 2 - Start Client
   cd client && npm run dev
   ```

## 🧪 Test Accounts

The following test accounts are created by `server/prisma/qa-seed.ts`:

| Email | Password | Role |
|---|---|---|
| `admin@truprm.test` | `Admin@1234` | `ADMIN` |
| `hr.manager@truprm.test` | `HrManager@1234` | `HR_MANAGER` |
| `payroll.user@truprm.test` | `PayrollUser@1234` | `HR_PAYROLL_USER` |
| `payroll.admin@truprm.test` | `PayrollAdmin@1234` | `HR_PAYROLL_ADMIN` |
| `employee@truprm.test` | `Employee@1234` | `EMPLOYEE` |

> ⚠️ These are test-only credentials using clearly fake passwords. Do not use in production.

## 📋 Progress Log

- **2026-09-06** — Full QA and data-integrity pass completed. 43 tests run (42 PASS, 1 FAIL). See [QA_REPORT.md](./QA_REPORT.md) for full results, 1 confirmed bug (attendance toggle unique constraint 500), and 4 observations.
