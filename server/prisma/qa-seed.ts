/**
 * TruPRM QA Seed Script
 * Creates realistic data for a full QA pass per the QA checklist.
 * Run: npx ts-node --transpile-only prisma/qa-seed.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateSalary } from '../src/services/payrollCalculator';

const prisma = new PrismaClient();

const HASH = (pw: string) => bcrypt.hashSync(pw, 10);

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateOf(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d);
}

async function main() {
  console.log('🌱 Starting QA seed …');

  // ── 0. CLEAN existing data in dependency order ────────────────────────────
  await prisma.payslipLine.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrun.deleteMany();
  await prisma.timeOffRequest.deleteMany();
  await prisma.timeOffAllocation.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.scheduleLine.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.salaryRule.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.workingSchedule.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  console.log('  ✔ Cleaned existing data');

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ROLE USERS (5 test accounts with known credentials)
  // ══════════════════════════════════════════════════════════════════════════
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@truprm.test',
      passwordHash: HASH('Admin@1234'),
      role: 'ADMIN',
      mustChangePassword: false,
    },
  });

  const hrManagerUser = await prisma.user.create({
    data: {
      email: 'hr.manager@truprm.test',
      passwordHash: HASH('HrManager@1234'),
      role: 'HR_MANAGER',
      mustChangePassword: false,
    },
  });

  const hrPayrollUserU = await prisma.user.create({
    data: {
      email: 'payroll.user@truprm.test',
      passwordHash: HASH('PayrollUser@1234'),
      role: 'HR_PAYROLL_USER',
      mustChangePassword: false,
    },
  });

  const hrPayrollAdminU = await prisma.user.create({
    data: {
      email: 'payroll.admin@truprm.test',
      passwordHash: HASH('PayrollAdmin@1234'),
      role: 'HR_PAYROLL_ADMIN',
      mustChangePassword: false,
    },
  });

  const employeeUser = await prisma.user.create({
    data: {
      email: 'employee@truprm.test',
      passwordHash: HASH('Employee@1234'),
      role: 'EMPLOYEE',
      mustChangePassword: false,
    },
  });

  console.log('  ✔ Created 5 role-based users');

  // ══════════════════════════════════════════════════════════════════════════
  // 2. WORKING SCHEDULES (4 distinct schedules)
  // ══════════════════════════════════════════════════════════════════════════
  const sched40 = await prisma.workingSchedule.create({
    data: {
      name: 'Standard 40h / Week',
      flexibleHours: false,
      hoursPerWeek: 40,
      scheduleLines: {
        create: [
          { dayOfWeek: 'MONDAY', timeFrom: '09:00', timeTo: '17:00' },
          { dayOfWeek: 'TUESDAY', timeFrom: '09:00', timeTo: '17:00' },
          { dayOfWeek: 'WEDNESDAY', timeFrom: '09:00', timeTo: '17:00' },
          { dayOfWeek: 'THURSDAY', timeFrom: '09:00', timeTo: '17:00' },
          { dayOfWeek: 'FRIDAY', timeFrom: '09:00', timeTo: '17:00' },
        ],
      },
    },
  });

  const sched45 = await prisma.workingSchedule.create({
    data: {
      name: 'Extended 45h / Week',
      flexibleHours: false,
      hoursPerWeek: 45,
      scheduleLines: {
        create: [
          { dayOfWeek: 'MONDAY', timeFrom: '08:00', timeTo: '17:00' },
          { dayOfWeek: 'TUESDAY', timeFrom: '08:00', timeTo: '17:00' },
          { dayOfWeek: 'WEDNESDAY', timeFrom: '08:00', timeTo: '17:00' },
          { dayOfWeek: 'THURSDAY', timeFrom: '08:00', timeTo: '17:00' },
          { dayOfWeek: 'FRIDAY', timeFrom: '08:00', timeTo: '17:00' },
          { dayOfWeek: 'SATURDAY', timeFrom: '09:00', timeTo: '14:00' },
        ],
      },
    },
  });

  const schedFlexible = await prisma.workingSchedule.create({
    data: {
      name: 'Flexible Hours',
      flexibleHours: true,
      hoursPerWeek: 40,
      scheduleLines: {
        create: [
          { dayOfWeek: 'MONDAY', timeFrom: '10:00', timeTo: '18:00' },
          { dayOfWeek: 'TUESDAY', timeFrom: '10:00', timeTo: '18:00' },
          { dayOfWeek: 'WEDNESDAY', timeFrom: '10:00', timeTo: '18:00' },
          { dayOfWeek: 'THURSDAY', timeFrom: '10:00', timeTo: '18:00' },
          { dayOfWeek: 'FRIDAY', timeFrom: '10:00', timeTo: '18:00' },
        ],
      },
    },
  });

  const schedPartTime = await prisma.workingSchedule.create({
    data: {
      name: 'Part-Time 20h / Week',
      flexibleHours: false,
      hoursPerWeek: 20,
      scheduleLines: {
        create: [
          { dayOfWeek: 'MONDAY', timeFrom: '09:00', timeTo: '13:00' },
          { dayOfWeek: 'TUESDAY', timeFrom: '09:00', timeTo: '13:00' },
          { dayOfWeek: 'WEDNESDAY', timeFrom: '09:00', timeTo: '13:00' },
          { dayOfWeek: 'THURSDAY', timeFrom: '09:00', timeTo: '13:00' },
          { dayOfWeek: 'FRIDAY', timeFrom: '09:00', timeTo: '13:00' },
        ],
      },
    },
  });

  console.log('  ✔ Created 4 working schedules');

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SALARY STRUCTURES & RULES (3 structures with varied rule types)
  // ══════════════════════════════════════════════════════════════════════════

  // Structure A: Senior / Engineering (High wage, complex rules)
  const structA = await prisma.salaryStructure.create({
    data: {
      name: 'Senior Engineering Package',
      code: 'SENIOR_ENG',
      description: 'For senior engineers with PF, HRA, and performance bonus',
      status: 'ACTIVE',
      effectiveFrom: dateOf(2024, 1, 1),
      rules: {
        create: [
          // seq 10 — BASIC (FORMULA: reads contractWage from computed context)
          {
            name: 'Basic Salary',
            code: 'BASIC',
            category: 'BASIC',
            sequence: 10,
            calculationType: 'FORMULA',
            formula: 'contractWage',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          // seq 20 — HRA = 40% of BASIC
          {
            name: 'House Rent Allowance',
            code: 'HRA',
            category: 'ALLOWANCE',
            sequence: 20,
            calculationType: 'PERCENTAGE',
            percentage: 0.40,
            baseCode: 'BASIC',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          // seq 30 — Transport = fixed 1500
          {
            name: 'Transport Allowance',
            code: 'TRANSPORT',
            category: 'ALLOWANCE',
            sequence: 30,
            calculationType: 'FIXED_AMOUNT',
            fixedAmount: 1500,
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          // seq 40 — PF Deduction = 12% of BASIC
          {
            name: 'Provident Fund',
            code: 'PF',
            category: 'DEDUCTION',
            sequence: 40,
            calculationType: 'PERCENTAGE',
            percentage: 0.12,
            baseCode: 'BASIC',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          // seq 50 — Professional Tax fixed 200
          {
            name: 'Professional Tax',
            code: 'PT',
            category: 'DEDUCTION',
            sequence: 50,
            calculationType: 'FIXED_AMOUNT',
            fixedAmount: 200,
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          // seq 60 — Employer PF Contribution = 12% of BASIC
          {
            name: 'Employer PF Contribution',
            code: 'EMP_PF',
            category: 'EMPLOYER_CONTRIBUTION',
            sequence: 60,
            calculationType: 'PERCENTAGE',
            percentage: 0.12,
            baseCode: 'BASIC',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
        ],
      },
    },
  });

  // Structure B: Standard / Mid-level
  const structB = await prisma.salaryStructure.create({
    data: {
      name: 'Standard Employee Package',
      code: 'STD_EMP',
      description: 'For regular employees with basic HRA and deductions',
      status: 'ACTIVE',
      effectiveFrom: dateOf(2024, 1, 1),
      rules: {
        create: [
          {
            name: 'Basic Salary',
            code: 'BASIC',
            category: 'BASIC',
            sequence: 10,
            calculationType: 'FORMULA',
            formula: 'contractWage',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          {
            name: 'House Rent Allowance',
            code: 'HRA',
            category: 'ALLOWANCE',
            sequence: 20,
            calculationType: 'PERCENTAGE',
            percentage: 0.30,
            baseCode: 'BASIC',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          {
            name: 'Medical Allowance',
            code: 'MEDICAL',
            category: 'ALLOWANCE',
            sequence: 25,
            calculationType: 'FIXED_AMOUNT',
            fixedAmount: 1250,
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          {
            name: 'Provident Fund',
            code: 'PF',
            category: 'DEDUCTION',
            sequence: 40,
            calculationType: 'PERCENTAGE',
            percentage: 0.12,
            baseCode: 'BASIC',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          {
            name: 'Income Tax',
            code: 'TDS',
            category: 'DEDUCTION',
            sequence: 50,
            // formula: 10% of (BASIC + HRA) if salary > 15000
            calculationType: 'FORMULA',
            formula: 'BASIC * 0.10',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
        ],
      },
    },
  });

  // Structure C: Contractor / Intern (simple, no deductions)
  const structC = await prisma.salaryStructure.create({
    data: {
      name: 'Contractor & Intern Package',
      code: 'CONTRACTOR',
      description: 'For contractors and interns - basic stipend only',
      status: 'ACTIVE',
      effectiveFrom: dateOf(2024, 1, 1),
      rules: {
        create: [
          {
            name: 'Basic Stipend',
            code: 'BASIC',
            category: 'BASIC',
            sequence: 10,
            calculationType: 'FORMULA',
            formula: 'contractWage',
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          {
            name: 'Meal Allowance',
            code: 'MEAL',
            category: 'ALLOWANCE',
            sequence: 20,
            calculationType: 'FIXED_AMOUNT',
            fixedAmount: 800,
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
          {
            name: 'Transport Reimbursement',
            code: 'TRANS_REIMB',
            category: 'ALLOWANCE',
            sequence: 30,
            calculationType: 'FIXED_AMOUNT',
            fixedAmount: 500,
            status: 'ACTIVE',
            appears_on_payslip: true,
          },
        ],
      },
    },
  });

  console.log('  ✔ Created 3 salary structures with rules');

  // ══════════════════════════════════════════════════════════════════════════
  // 4. EMPLOYEES (50 across 5 departments)
  // ══════════════════════════════════════════════════════════════════════════
  const departments = ['Engineering', 'Sales', 'HR', 'Finance', 'Operations'];

  const empData: Array<{
    firstName: string; lastName: string; jobTitle: string;
    department: string; wage: number; structId: string;
    schedId: string; contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN';
    color: string; inactive?: boolean;
    role?: 'EMPLOYEE' | 'HR_MANAGER' | 'HR_PAYROLL_USER' | 'HR_PAYROLL_ADMIN' | 'ADMIN';
  }> = [
    // Engineering (12) — Meera=HR_MANAGER, Vikram=HR_PAYROLL_USER
    { firstName: 'Arjun', lastName: 'Sharma', jobTitle: 'Senior Software Engineer', department: 'Engineering', wage: 80000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#3B82F6' },
    { firstName: 'Priya', lastName: 'Patel', jobTitle: 'Software Engineer', department: 'Engineering', wage: 60000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#8B5CF6' },
    { firstName: 'Rahul', lastName: 'Kumar', jobTitle: 'Lead Engineer', department: 'Engineering', wage: 95000, structId: structA.id, schedId: sched45.id, contractType: 'FULL_TIME', color: '#10B981' },
    { firstName: 'Sneha', lastName: 'Gupta', jobTitle: 'QA Engineer', department: 'Engineering', wage: 55000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#F59E0B' },
    { firstName: 'Vikram', lastName: 'Singh', jobTitle: 'DevOps Engineer', department: 'Engineering', wage: 72000, structId: structA.id, schedId: schedFlexible.id, contractType: 'FULL_TIME', color: '#EF4444', role: 'HR_PAYROLL_USER' },
    { firstName: 'Anita', lastName: 'Reddy', jobTitle: 'Frontend Developer', department: 'Engineering', wage: 58000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#6366F1' },
    { firstName: 'Deepak', lastName: 'Nair', jobTitle: 'Backend Developer', department: 'Engineering', wage: 62000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#14B8A6' },
    { firstName: 'Kavya', lastName: 'Menon', jobTitle: 'Junior Developer', department: 'Engineering', wage: 35000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#F97316' },
    { firstName: 'Rohit', lastName: 'Joshi', jobTitle: 'Intern - Engineering', department: 'Engineering', wage: 15000, structId: structC.id, schedId: schedPartTime.id, contractType: 'INTERN', color: '#EC4899' },
    { firstName: 'Pooja', lastName: 'Iyer', jobTitle: 'Contractor - Security', department: 'Engineering', wage: 25000, structId: structC.id, schedId: schedFlexible.id, contractType: 'CONTRACTOR', color: '#0EA5E9' },
    { firstName: 'Aditya', lastName: 'Bose', jobTitle: 'Software Engineer', department: 'Engineering', wage: 61000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#84CC16', inactive: true },
    { firstName: 'Meera', lastName: 'Verma', jobTitle: 'Tech Lead', department: 'Engineering', wage: 90000, structId: structA.id, schedId: sched45.id, contractType: 'FULL_TIME', color: '#A855F7', role: 'HR_MANAGER' },
    // Sales (10)
    { firstName: 'Sanjay', lastName: 'Mehta', jobTitle: 'Sales Manager', department: 'Sales', wage: 75000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#22C55E', role: 'HR_PAYROLL_ADMIN' },
    { firstName: 'Riya', lastName: 'Shah', jobTitle: 'Sales Executive', department: 'Sales', wage: 45000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#EAB308' },
    { firstName: 'Akash', lastName: 'Tiwari', jobTitle: 'Business Development', department: 'Sales', wage: 50000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#F43F5E' },
    { firstName: 'Shreya', lastName: 'Pillai', jobTitle: 'Sales Coordinator', department: 'Sales', wage: 38000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#06B6D4' },
    { firstName: 'Nikhil', lastName: 'Chopra', jobTitle: 'Account Manager', department: 'Sales', wage: 55000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#7C3AED' },
    { firstName: 'Neha', lastName: 'Agarwal', jobTitle: 'Sales Executive', department: 'Sales', wage: 42000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#D946EF', inactive: true },
    { firstName: 'Kiran', lastName: 'Rao', jobTitle: 'Regional Sales Head', department: 'Sales', wage: 88000, structId: structA.id, schedId: sched45.id, contractType: 'FULL_TIME', color: '#2563EB', role: 'ADMIN' },
    { firstName: 'Priyanka', lastName: 'Das', jobTitle: 'Intern - Sales', department: 'Sales', wage: 12000, structId: structC.id, schedId: schedPartTime.id, contractType: 'INTERN', color: '#059669' },
    { firstName: 'Gaurav', lastName: 'Mishra', jobTitle: 'Contractor - Presales', department: 'Sales', wage: 30000, structId: structC.id, schedId: schedFlexible.id, contractType: 'CONTRACTOR', color: '#DC2626' },
    { firstName: 'Swati', lastName: 'Pandey', jobTitle: 'Sales Analyst', department: 'Sales', wage: 48000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#9333EA' },
    // HR (10) — Lakshmi=HR_MANAGER, Yash=HR_PAYROLL_USER
    { firstName: 'Lakshmi', lastName: 'Krishnan', jobTitle: 'HR Manager', department: 'HR', wage: 70000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#0D9488', role: 'HR_MANAGER' },
    { firstName: 'Amitabh', lastName: 'Chatterjee', jobTitle: 'Recruitment Lead', department: 'HR', wage: 60000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#B45309' },
    { firstName: 'Divya', lastName: 'Kapoor', jobTitle: 'HR Generalist', department: 'HR', wage: 45000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#4F46E5' },
    { firstName: 'Yash', lastName: 'Malhotra', jobTitle: 'Payroll Specialist', department: 'HR', wage: 52000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#DB2777', role: 'HR_PAYROLL_USER' },
    { firstName: 'Tanvi', lastName: 'Saxena', jobTitle: 'L&D Specialist', department: 'HR', wage: 47000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#16A34A' },
    { firstName: 'Harish', lastName: 'Naidu', jobTitle: 'HR Executive', department: 'HR', wage: 35000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#CA8A04', inactive: true },
    { firstName: 'Sonali', lastName: 'Bhatt', jobTitle: 'Talent Acquisition', department: 'HR', wage: 50000, structId: structB.id, schedId: schedFlexible.id, contractType: 'FULL_TIME', color: '#7C3AED' },
    { firstName: 'Mahesh', lastName: 'Deshpande', jobTitle: 'HR Business Partner', department: 'HR', wage: 65000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#0284C7', role: 'HR_PAYROLL_ADMIN' },
    { firstName: 'Archana', lastName: 'Sinha', jobTitle: 'Intern - HR', department: 'HR', wage: 10000, structId: structC.id, schedId: schedPartTime.id, contractType: 'INTERN', color: '#65A30D' },
    { firstName: 'Sameer', lastName: 'Qureshi', jobTitle: 'Contractor - Recruiter', department: 'HR', wage: 28000, structId: structC.id, schedId: schedFlexible.id, contractType: 'CONTRACTOR', color: '#BE185D' },
    // Finance (9)
    { firstName: 'Vikrant', lastName: 'Jain', jobTitle: 'Finance Manager', department: 'Finance', wage: 82000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#1D4ED8' },
    { firstName: 'Smita', lastName: 'Gokhale', jobTitle: 'Senior Accountant', department: 'Finance', wage: 65000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#7E22CE' },
    { firstName: 'Pranav', lastName: 'Kulkarni', jobTitle: 'Financial Analyst', department: 'Finance', wage: 58000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#0F766E' },
    { firstName: 'Pallavi', lastName: 'Wagh', jobTitle: 'Accounts Executive', department: 'Finance', wage: 40000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#B91C1C' },
    { firstName: 'Suresh', lastName: 'Patil', jobTitle: 'CFO', department: 'Finance', wage: 150000, structId: structA.id, schedId: sched45.id, contractType: 'FULL_TIME', color: '#374151' },
    { firstName: 'Madhuri', lastName: 'Pawar', jobTitle: 'Tax Specialist', department: 'Finance', wage: 55000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#6D28D9' },
    { firstName: 'Kishore', lastName: 'Lakhani', jobTitle: 'Auditor', department: 'Finance', wage: 60000, structId: structA.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#047857', inactive: true },
    { firstName: 'Rupal', lastName: 'Thakkar', jobTitle: 'Finance Executive', department: 'Finance', wage: 38000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#9F1239' },
    { firstName: 'Nitin', lastName: 'Gawande', jobTitle: 'Intern - Finance', department: 'Finance', wage: 12000, structId: structC.id, schedId: schedPartTime.id, contractType: 'INTERN', color: '#1E3A5F' },
    // Operations (9)
    { firstName: 'Rajesh', lastName: 'Dubey', jobTitle: 'Operations Manager', department: 'Operations', wage: 78000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#78350F' },
    { firstName: 'Heena', lastName: 'Modhwadia', jobTitle: 'Operations Analyst', department: 'Operations', wage: 48000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#064E3B' },
    { firstName: 'Sandeep', lastName: 'Bhosale', jobTitle: 'Supply Chain Lead', department: 'Operations', wage: 62000, structId: structB.id, schedId: sched45.id, contractType: 'FULL_TIME', color: '#1E1B4B' },
    { firstName: 'Rashmi', lastName: 'Apte', jobTitle: 'Logistics Executive', department: 'Operations', wage: 40000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#7F1D1D' },
    { firstName: 'Omkar', lastName: 'Desai', jobTitle: 'Operations Executive', department: 'Operations', wage: 35000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#14532D' },
    { firstName: 'Varsha', lastName: 'Kale', jobTitle: 'Quality Control Specialist', department: 'Operations', wage: 44000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#312E81' },
    { firstName: 'Tejas', lastName: 'More', jobTitle: 'Contractor - Logistics', department: 'Operations', wage: 22000, structId: structC.id, schedId: schedFlexible.id, contractType: 'CONTRACTOR', color: '#134E4A' },
    { firstName: 'Aarti', lastName: 'Dixit', jobTitle: 'Process Executive', department: 'Operations', wage: 36000, structId: structB.id, schedId: sched40.id, contractType: 'FULL_TIME', color: '#4A1942' },
    { firstName: 'Sumit', lastName: 'Sathe', jobTitle: 'Intern - Operations', department: 'Operations', wage: 10000, structId: structC.id, schedId: schedPartTime.id, contractType: 'INTERN', color: '#083344' },
  ];

  const createdEmployees: any[] = [];

  for (let i = 0; i < empData.length; i++) {
    const emp = empData[i];
    const empNum = `EMP${String(i + 1).padStart(4, '0')}`;
    const email = `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@truprm.test`;

    // Create user for every employee — use role from empData if set, otherwise EMPLOYEE
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: HASH('Test@1234'),
        role: (emp.role as any) || 'EMPLOYEE',
        mustChangePassword: false,
      },
    });

    const e = await prisma.employee.create({
      data: {
        userId: u.id,
        employeeNumber: empNum,
        firstName: emp.firstName,
        lastName: emp.lastName,
        color: emp.color,
        jobTitle: emp.jobTitle,
        department: emp.department,
        hireDate: dateOf(2022, 1, 1),
      },
    });

    createdEmployees.push({ ...e, ...emp, userId: u.id });
  }

  console.log(`  ✔ Created ${createdEmployees.length} employees`);

  // Link the test employee user to the first employee (for attendance toggle QA)
  await prisma.employee.update({
    where: { id: createdEmployees[0].id },
    data: { userId: employeeUser.id },
  });
  // Also update the old user for employee 0 to remove conflict
  await prisma.user.update({
    where: { id: createdEmployees[0].userId },
    data: { email: `${createdEmployees[0].firstName.toLowerCase()}.${createdEmployees[0].lastName.toLowerCase()}.old@truprm.test` },
  });

  // Link HR Manager user to the HR Manager employee (emp index 22 = Lakshmi Krishnan)
  await prisma.employee.update({
    where: { id: createdEmployees[22].id },
    data: { userId: hrManagerUser.id },
  });
  await prisma.user.update({
    where: { id: createdEmployees[22].userId },
    data: { email: `${createdEmployees[22].firstName.toLowerCase()}.${createdEmployees[22].lastName.toLowerCase()}.old@truprm.test` },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CONTRACTS
  // Primary contracts for all employees.
  // 5 employees get historical contracts (multi-contract stress test).
  // ══════════════════════════════════════════════════════════════════════════

  // Employees with multi-contract history: indices 0, 1, 2, 13, 32
  const multiContractIdx = [0, 1, 2, 13, 32];

  for (let i = 0; i < createdEmployees.length; i++) {
    const emp = createdEmployees[i];

    if (multiContractIdx.includes(i)) {
      // Historical contract 1: 2022-01-01 → 2023-12-31 (EXPIRED), lower wage
      await prisma.contract.create({
        data: {
          employeeId: emp.id,
          contractType: emp.contractType,
          status: 'EXPIRED',
          startDate: dateOf(2022, 1, 1),
          endDate: dateOf(2023, 12, 31),
          wageAmount: emp.wage * 0.7,
          wageCurrency: 'INR',
          workingScheduleId: emp.schedId,
          salaryStructureId: emp.structId,
          notes: 'Historical contract (Phase 1)',
        },
      });

      // Historical contract 2: 2024-01-01 → 2024-12-31 (EXPIRED), mid wage
      await prisma.contract.create({
        data: {
          employeeId: emp.id,
          contractType: emp.contractType,
          status: 'EXPIRED',
          startDate: dateOf(2024, 1, 1),
          endDate: dateOf(2024, 12, 31),
          wageAmount: emp.wage * 0.85,
          wageCurrency: 'INR',
          workingScheduleId: emp.schedId,
          salaryStructureId: emp.structId,
          notes: 'Historical contract (Phase 2)',
        },
      });

      // Active contract: 2025-01-01 → null (no end date)
      await prisma.contract.create({
        data: {
          employeeId: emp.id,
          contractType: emp.contractType,
          status: 'ACTIVE',
          startDate: dateOf(2025, 1, 1),
          endDate: null,
          wageAmount: emp.wage,
          wageCurrency: 'INR',
          workingScheduleId: emp.schedId,
          salaryStructureId: emp.structId,
          notes: 'Current active contract',
        },
      });
    } else {
      // Single active contract
      await prisma.contract.create({
        data: {
          employeeId: emp.id,
          contractType: emp.contractType,
          status: emp.inactive ? 'TERMINATED' : 'ACTIVE',
          startDate: dateOf(2023, 1, 1),
          endDate: emp.inactive ? dateOf(2025, 6, 30) : null,
          wageAmount: emp.wage,
          wageCurrency: 'INR',
          workingScheduleId: emp.schedId,
          salaryStructureId: emp.structId,
        },
      });
    }
  }

  console.log('  ✔ Created contracts (5 employees with 3-contract history)');

  // ══════════════════════════════════════════════════════════════════════════
  // 6. ATTENDANCE — last 30 days for all employees
  // ══════════════════════════════════════════════════════════════════════════
  const now = new Date();
  const activeEmployees = createdEmployees.filter((_, i) => !empData[i].inactive);

  for (const emp of activeEmployees) {
    for (let d = 1; d <= 30; d++) {
      const date = daysAgo(d);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const isLate = d % 7 === 0;
      const isMissingCheckout = d % 11 === 0;
      const isAbsent = d % 15 === 0;
      const isManualCorrection = d === 5;

      if (isAbsent) {
        await prisma.attendance.create({
          data: {
            employeeId: emp.id,
            date,
            status: 'ABSENT',
            notes: 'Absent - no record',
          },
        });
      } else {
        const checkIn = new Date(date);
        checkIn.setHours(isLate ? 10 : 9, isLate ? 30 : 0, 0, 0);

        if (isMissingCheckout) {
          // Missing checkout — only checkIn
          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date,
              checkIn,
              status: 'PRESENT',
              notes: isManualCorrection ? 'Manual correction applied' : null,
            },
          });
        } else {
          const checkOut = new Date(date);
          checkOut.setHours(17, 30, 0, 0);
          const diffMs = checkOut.getTime() - checkIn.getTime();
          const workedHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date,
              checkIn,
              checkOut,
              workedHours,
              status: isLate ? 'LATE' : 'PRESENT',
              notes: isManualCorrection ? 'Manual correction applied' : null,
            },
          });
        }
      }
    }
  }

  console.log('  ✔ Created attendance records (last 30 days)');

  // ══════════════════════════════════════════════════════════════════════════
  // 7. TIME OFF TYPES
  // ══════════════════════════════════════════════════════════════════════════
  const annualLeave = await prisma.timeOffType.create({
    data: {
      name: 'Annual Leave',
      code: 'AL',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: true,
      maxDaysPerYear: 21,
      requiresApproval: true,
    },
  });

  const sickLeave = await prisma.timeOffType.create({
    data: {
      name: 'Sick Leave',
      code: 'SL',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: false,
      maxDaysPerYear: 12,
      requiresApproval: false,
    },
  });

  const unpaidLeave = await prisma.timeOffType.create({
    data: {
      name: 'Unpaid Leave',
      code: 'UL',
      unit: 'DAYS',
      isPaid: false,
      requiresAllocation: false,
      maxDaysPerYear: null,
      requiresApproval: true,
    },
  });

  const maternityLeave = await prisma.timeOffType.create({
    data: {
      name: 'Maternity Leave',
      code: 'ML',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: true,
      maxDaysPerYear: 90,
      requiresApproval: true,
    },
  });

  console.log('  ✔ Created 4 time off types');

  // ══════════════════════════════════════════════════════════════════════════
  // 8. ALLOCATIONS — all active employees get Annual Leave & Maternity Leave
  // ══════════════════════════════════════════════════════════════════════════
  const currentYear = new Date().getFullYear();

  for (const emp of activeEmployees) {
    await prisma.timeOffAllocation.create({
      data: {
        employeeId: emp.id,
        timeOffTypeId: annualLeave.id,
        year: currentYear,
        daysAllocated: 21,
        daysUsed: 0,
        remaining: 21,
        validityFrom: dateOf(currentYear, 1, 1),
        validityTo: dateOf(currentYear, 12, 31),
      },
    });

    // Maternity leave only for some employees
    if (['Priya', 'Sneha', 'Anita', 'Kavya', 'Riya', 'Neha', 'Sonali'].includes(emp.firstName)) {
      await prisma.timeOffAllocation.create({
        data: {
          employeeId: emp.id,
          timeOffTypeId: maternityLeave.id,
          year: currentYear,
          daysAllocated: 90,
          daysUsed: 0,
          remaining: 90,
          validityFrom: dateOf(currentYear, 1, 1),
          validityTo: dateOf(currentYear, 12, 31),
        },
      });
    }
  }

  console.log('  ✔ Created time off allocations');

  // ══════════════════════════════════════════════════════════════════════════
  // 9. TIME OFF REQUESTS — mix of statuses
  // ══════════════════════════════════════════════════════════════════════════
  // PENDING requests
  for (let i = 0; i < 8; i++) {
    const emp = activeEmployees[i * 5];
    await prisma.timeOffRequest.create({
      data: {
        employeeId: emp.id,
        timeOffTypeId: annualLeave.id,
        startDate: dateOf(currentYear, 10, 1 + i),
        endDate: dateOf(currentYear, 10, 2 + i),
        daysRequested: 2,
        status: 'CONFIRMED',
        reason: 'Family event',
      },
    });
  }

  // APPROVED requests (decrement allocation)
  for (let i = 0; i < 5; i++) {
    const emp = activeEmployees[i];
    const daysReq = 3;

    // Approve: update allocation
    await prisma.timeOffAllocation.updateMany({
      where: { employeeId: emp.id, timeOffTypeId: annualLeave.id, year: currentYear },
      data: { daysUsed: daysReq, remaining: 21 - daysReq },
    });

    await prisma.timeOffRequest.create({
      data: {
        employeeId: emp.id,
        timeOffTypeId: annualLeave.id,
        startDate: dateOf(currentYear, 8, 1),
        endDate: dateOf(currentYear, 8, 3),
        daysRequested: daysReq,
        status: 'APPROVED',
        reason: 'Vacation',
        approvedAt: new Date(),
        approvedById: adminUser.id,
      },
    });
  }

  // REFUSED requests
  for (let i = 10; i < 14; i++) {
    const emp = activeEmployees[i];
    await prisma.timeOffRequest.create({
      data: {
        employeeId: emp.id,
        timeOffTypeId: sickLeave.id,
        startDate: dateOf(currentYear, 7, 10),
        endDate: dateOf(currentYear, 7, 11),
        daysRequested: 2,
        status: 'REFUSED',
        reason: 'Not feeling well',
        refusalReason: 'Insufficient documentation',
      },
    });
  }

  // DRAFT requests
  for (let i = 20; i < 23; i++) {
    const emp = activeEmployees[i];
    await prisma.timeOffRequest.create({
      data: {
        employeeId: emp.id,
        timeOffTypeId: sickLeave.id,
        startDate: dateOf(currentYear, 11, 5),
        endDate: dateOf(currentYear, 11, 5),
        daysRequested: 1,
        status: 'DRAFT',
        reason: 'Medical appointment',
      },
    });
  }

  console.log('  ✔ Created time off requests (mix of CONFIRMED/APPROVED/REFUSED/DRAFT)');

  // ══════════════════════════════════════════════════════════════════════════
  // 10. PAYRUNS
  // Run A: August 2026 — PAID (full lifecycle completed)
  // Run B: September 2026 — DRAFT (awaiting processing)
  // ══════════════════════════════════════════════════════════════════════════

  // Select employees with ACTIVE contracts covering August 2026
  const augStart = dateOf(2026, 8, 1);
  const augEnd = dateOf(2026, 8, 31);
  const sepStart = dateOf(2026, 9, 1);
  const sepEnd = dateOf(2026, 9, 30);

  const activeContracts = await prisma.contract.findMany({
    where: {
      startDate: { lte: augStart },
      OR: [{ endDate: null }, { endDate: { gte: augEnd } }],
    },
    include: {
      employee: true,
      salaryStructure: { include: { rules: { orderBy: { sequence: 'asc' } } } },
    },
    orderBy: { startDate: 'desc' },
  });

  // Deduplicate
  const seenEmpIds = new Set<string>();
  const eligibleForAug: any[] = [];
  for (const c of activeContracts) {
    if (!seenEmpIds.has(c.employeeId)) {
      seenEmpIds.add(c.employeeId);
      eligibleForAug.push(c);
    }
  }

  // Payrun A — PAID
  const payrunA = await prisma.payrun.create({
    data: {
      name: 'August 2026 Payroll',
      periodStart: augStart,
      periodEnd: augEnd,
      state: 'PAID',
      notes: 'Completed payroll for August 2026',
    },
  });

  // Create paid payslips using the real calculateSalary engine
  for (const contract of eligibleForAug.slice(0, 30)) {
    if (!contract.salaryStructure) continue;
    const wage = Number(contract.wageAmount);

    const context = {
      contractWage: wage,
      BASIC: wage,
      dailySalary: wage > 0 ? wage / 30 : 0,
      unpaidLeaveDays: 0,
      overtimeHours: 0,
      overtimeRate: wage > 0 ? (wage / 160) * 1.5 : 0,
      isPfApplicable: true,
    };

    const calcResult = calculateSalary(contract.salaryStructure as any, context);

    const payslip = await prisma.payslip.create({
      data: {
        payrunId: payrunA.id,
        employeeId: contract.employeeId,
        salaryStructureId: contract.salaryStructureId,
        state: 'PAID',
        periodStart: augStart,
        periodEnd: augEnd,
        basicWage: wage,
        grossWage: Math.round(calcResult.grossSalary * 100) / 100,
        totalDeductions: Math.round(calcResult.totalDeductions * 100) / 100,
        netWage: Math.round(calcResult.netSalary * 100) / 100,
      },
    });

    for (const line of calcResult.lines) {
      await prisma.payslipLine.create({
        data: {
          payslipId: payslip.id,
          name: line.name,
          code: line.code,
          category: line.category as any,
          quantity: 1,
          rate: line.amount,
          amount: line.amount,
        },
      });
    }
  }

  // Payrun B — DRAFT for September
  const payrunB = await prisma.payrun.create({
    data: {
      name: 'September 2026 Payroll',
      periodStart: sepStart,
      periodEnd: sepEnd,
      state: 'DRAFT',
      notes: 'Draft payroll for September 2026',
    },
  });

  // Add a few draft payslips
  for (const contract of eligibleForAug.slice(0, 10)) {
    await prisma.payslip.create({
      data: {
        payrunId: payrunB.id,
        employeeId: contract.employeeId,
        salaryStructureId: contract.salaryStructureId,
        state: 'DRAFT',
        periodStart: sepStart,
        periodEnd: sepEnd,
        basicWage: Number(contract.wageAmount),
        grossWage: 0,
        totalDeductions: 0,
        netWage: 0,
      },
    });
  }

  console.log('  ✔ Created 2 payruns (1 PAID, 1 DRAFT) with payslips');

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL COUNT REPORT
  // ══════════════════════════════════════════════════════════════════════════
  const counts = {
    users: await prisma.user.count(),
    employees: await prisma.employee.count(),
    contracts: await prisma.contract.count(),
    workingSchedules: await prisma.workingSchedule.count(),
    scheduleLines: await prisma.scheduleLine.count(),
    salaryStructures: await prisma.salaryStructure.count(),
    salaryRules: await prisma.salaryRule.count(),
    attendances: await prisma.attendance.count(),
    timeOffTypes: await prisma.timeOffType.count(),
    timeOffAllocations: await prisma.timeOffAllocation.count(),
    timeOffRequests: await prisma.timeOffRequest.count(),
    payruns: await prisma.payrun.count(),
    payslips: await prisma.payslip.count(),
    payslipLines: await prisma.payslipLine.count(),
  };

  console.log('\n📊 Seed Row Counts:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`   ${table.padEnd(25)} : ${count}`);
  }

  console.log('\n🔑 Test Accounts:');
  console.log('   admin@truprm.test           : Admin@1234        (ADMIN)');
  console.log('   hr.manager@truprm.test      : HrManager@1234    (HR_MANAGER)');
  console.log('   payroll.user@truprm.test    : PayrollUser@1234  (HR_PAYROLL_USER)');
  console.log('   payroll.admin@truprm.test   : PayrollAdmin@1234 (HR_PAYROLL_ADMIN)');
  console.log('   employee@truprm.test        : Employee@1234     (EMPLOYEE)');
  console.log('\n✅ QA Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
