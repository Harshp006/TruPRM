import { PrismaClient, Role, StructureStatus, RuleStatus, RuleCalculationType, SalaryRuleCategory, ContractType, ContractStatus, TimeOffStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = 'password123';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const adminPasswordHash = await bcrypt.hash('adminpassword', 12);

  // 1. ADMIN USER
  let admin = await prisma.user.findUnique({ where: { email: 'admin@truprm.com' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@truprm.com',
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
      },
    });
    console.log(`✓ Admin user created: admin@truprm.com / adminpassword`);
  }

  // 2. HR PAYROLL MANAGER USER
  let payrollManager = await prisma.user.findUnique({ where: { email: 'payroll.manager@truprm.com' } });
  if (!payrollManager) {
    payrollManager = await prisma.user.create({
      data: {
        email: 'payroll.manager@truprm.com',
        passwordHash,
        role: Role.HR_PAYROLL_ADMIN,
      },
    });
    console.log(`✓ HR Payroll Manager created: payroll.manager@truprm.com / password123`);
  }

  // 3. HR PAYROLL USER
  let payrollUser = await prisma.user.findUnique({ where: { email: 'payroll.user@truprm.com' } });
  if (!payrollUser) {
    payrollUser = await prisma.user.create({
      data: {
        email: 'payroll.user@truprm.com',
        passwordHash,
        role: Role.HR_PAYROLL_USER,
      },
    });
    console.log(`✓ HR Payroll User created: payroll.user@truprm.com / password123`);
  }

  // 4. HR MANAGER USER
  let hrManager = await prisma.user.findUnique({ where: { email: 'hr.manager@truprm.com' } });
  if (!hrManager) {
    hrManager = await prisma.user.create({
      data: {
        email: 'hr.manager@truprm.com',
        passwordHash,
        role: Role.HR_MANAGER,
      },
    });
    console.log(`✓ HR Manager created: hr.manager@truprm.com / password123`);
  }

  // 5. EMPLOYEE USER
  let employeeUser = await prisma.user.findUnique({ where: { email: 'john.doe@truprm.com' } });
  if (!employeeUser) {
    employeeUser = await prisma.user.create({
      data: {
        email: 'john.doe@truprm.com',
        passwordHash,
        role: Role.EMPLOYEE,
      },
    });
  } else {
    await prisma.user.update({
      where: { email: 'john.doe@truprm.com' },
      data: { passwordHash },
    });
  }
  console.log(`✓ Employee ready: john.doe@truprm.com / password123`);

  // Ensure Salary Structure
  let structure = await prisma.salaryStructure.findUnique({
    where: { code: 'SE-MONTHLY' },
  });

  if (!structure) {
    structure = await prisma.salaryStructure.create({
      data: {
        name: 'Software Engineer - Monthly',
        code: 'SE-MONTHLY',
        description: 'Standard monthly salary structure for Software Engineering department',
        status: StructureStatus.ACTIVE,
        effectiveFrom: new Date('2026-01-01'),
        rules: {
          create: [
            {
              name: 'Basic Salary',
              code: 'BASIC',
              category: SalaryRuleCategory.EARNING,
              sequence: 1,
              calculationType: RuleCalculationType.EMPLOYEE_BASIC,
              fixedAmount: null,
              amountFixed: null,
              status: RuleStatus.ACTIVE,
            },
            {
              name: 'House Rent Allowance',
              code: 'HRA',
              category: SalaryRuleCategory.EARNING,
              sequence: 2,
              calculationType: RuleCalculationType.PERCENTAGE,
              percentage: 0.40,
              amountPercentage: 0.40,
              baseCode: 'BASIC',
              status: RuleStatus.ACTIVE,
            },
            {
              name: 'Transport Allowance',
              code: 'TRANSPORT',
              category: SalaryRuleCategory.EARNING,
              sequence: 3,
              calculationType: RuleCalculationType.FIXED_AMOUNT,
              fixedAmount: 3000,
              amountFixed: 3000,
              status: RuleStatus.ACTIVE,
            },
            {
              name: 'Medical Allowance',
              code: 'MEDICAL',
              category: SalaryRuleCategory.EARNING,
              sequence: 4,
              calculationType: RuleCalculationType.FIXED_AMOUNT,
              fixedAmount: 2500,
              amountFixed: 2500,
              status: RuleStatus.ACTIVE,
            },
            {
              name: 'Provident Fund (Employee)',
              code: 'PF',
              category: SalaryRuleCategory.DEDUCTION,
              sequence: 5,
              calculationType: RuleCalculationType.PERCENTAGE,
              percentage: 0.12,
              amountPercentage: 0.12,
              baseCode: 'BASIC',
              status: RuleStatus.ACTIVE,
            },
            {
              name: 'Professional Tax',
              code: 'PT',
              category: SalaryRuleCategory.DEDUCTION,
              sequence: 6,
              calculationType: RuleCalculationType.FIXED_AMOUNT,
              fixedAmount: 200,
              amountFixed: 200,
              status: RuleStatus.ACTIVE,
            },
            {
              name: 'Employer PF Contribution',
              code: 'EMPLOYER_PF',
              category: SalaryRuleCategory.EMPLOYER_CONTRIBUTION,
              sequence: 7,
              calculationType: RuleCalculationType.PERCENTAGE,
              percentage: 0.12,
              amountPercentage: 0.12,
              baseCode: 'BASIC',
              status: RuleStatus.ACTIVE,
            },
          ],
        },
      },
    });
    console.log(`✓ Salary structure created: ${structure.name} (${structure.code})`);
  }

  // Ensure Employee profile for HR Payroll Manager
  let pmEmp = await prisma.employee.findUnique({ where: { userId: payrollManager.id } });
  if (!pmEmp) {
    pmEmp = await prisma.employee.create({
      data: {
        userId: payrollManager.id,
        employeeNumber: 'MGR001',
        firstName: 'Sarah',
        lastName: 'Conner',
        jobTitle: 'HR Payroll Manager',
        department: 'Payroll & HR Operations',
        hireDate: new Date('2024-01-01'),
        color: '#4f46e5',
      },
    });
    console.log(`✓ HR Payroll Manager employee profile created.`);
  }

  // 5. 20 REALISTIC DEMO EMPLOYEES & USERS WITH PRE-CHECK TEST CASES
  const demoUsersData = [
    { email: 'john.doe@truprm.com', empNum: 'EMP001', first: 'John', last: 'Doe', title: 'Software Engineer', dept: 'Engineering', color: '#6366f1', wage: 60000, bankAccount: '501004829104', bankName: 'HDFC Bank', bankIfsc: 'HDFC0001234', hasStructure: true, hasActiveContract: true },
    { email: 'aarav.mehta@truprm.com', empNum: 'EMP002', first: 'Aarav', last: 'Mehta', title: 'Senior Software Engineer', dept: 'Engineering', color: '#059669', wage: 75000, bankAccount: '000401582910', bankName: 'ICICI Bank', bankIfsc: 'ICIC0000004', hasStructure: true, hasActiveContract: true },
    { email: 'sara.khan@truprm.com', empNum: 'EMP003', first: 'Sara', last: 'Khan', title: 'Product Designer', dept: 'Product & UX', color: '#d97706', wage: 65000, bankAccount: null, bankName: null, bankIfsc: null, hasStructure: true, hasActiveContract: true }, // FAIL: Missing Bank Details
    { email: 'john.dsouza@truprm.com', empNum: 'EMP004', first: 'John', last: 'Dsouza', title: 'QA Lead Specialist', dept: 'Quality Assurance', color: '#2563eb', wage: 58000, bankAccount: '918010029481', bankName: 'Axis Bank', bankIfsc: 'UTIB0000123', hasStructure: true, hasActiveContract: true },
    { email: 'meha.patel@truprm.com', empNum: 'EMP005', first: 'Meha', last: 'Patel', title: 'HR Operations Associate', dept: 'Human Resources', color: '#7c3aed', wage: 52000, bankAccount: '30491829104', bankName: 'SBI', bankIfsc: 'SBIN0000456', hasStructure: false, hasActiveContract: true }, // FAIL: Missing Salary Structure
    { email: 'priya.sharma@truprm.com', empNum: 'EMP006', first: 'Priya', last: 'Sharma', title: 'Frontend Developer', dept: 'Engineering', color: '#ec4899', wage: 62000, bankAccount: '30491829105', bankName: 'SBI', bankIfsc: 'SBIN0000456', hasStructure: true, hasActiveContract: true },
    { email: 'rohan.gupta@truprm.com', empNum: 'EMP007', first: 'Rohan', last: 'Gupta', title: 'Backend Architect', dept: 'Engineering', color: '#10b981', wage: 90000, bankAccount: '6019284019', bankName: 'Kotak Bank', bankIfsc: 'KKBK0000789', hasStructure: true, hasActiveContract: true },
    { email: 'rohan.sharma@truprm.com', empNum: 'EMP008', first: 'Rohan', last: 'Sharma', title: 'DevOps Engineer', dept: 'Infrastructure', color: '#ef4444', wage: 70000, bankAccount: '501002233441', bankName: 'HDFC Bank', bankIfsc: 'HDFC0001234', hasStructure: true, hasActiveContract: false }, // FAIL: Missing Active Contract
    { email: 'kavya.reddy@truprm.com', empNum: 'EMP009', first: 'Kavya', last: 'Reddy', title: 'UI/UX Researcher', dept: 'Product & UX', color: '#8b5cf6', wage: 55000, bankAccount: '501009988776', bankName: 'HDFC Bank', bankIfsc: 'HDFC0001234', hasStructure: true, hasActiveContract: true },
    { email: 'anish.kumar@truprm.com', empNum: 'EMP010', first: 'Anish', last: 'Kumar', title: 'Systems Administrator', dept: 'IT Operations', color: '#f59e0b', wage: 50000, bankAccount: '000408877665', bankName: 'ICICI Bank', bankIfsc: 'ICIC0000004', hasStructure: true, hasActiveContract: true },
    { email: 'ananya.verma@truprm.com', empNum: 'EMP011', first: 'Ananya', last: 'Verma', title: 'Data Analyst', dept: 'Analytics', color: '#14b8a6', wage: 0, bankAccount: '918010055443', bankName: 'Axis Bank', bankIfsc: 'UTIB0000123', hasStructure: true, hasActiveContract: true }, // FAIL: Invalid 0 Wage
    { email: 'karan.malhotra@truprm.com', empNum: 'EMP012', first: 'Karan', last: 'Malhotra', title: 'Full Stack Developer', dept: 'Engineering', color: '#3b82f6', wage: 68000, bankAccount: '30491822334', bankName: 'SBI', bankIfsc: 'SBIN0000456', hasStructure: true, hasActiveContract: true },
    { email: 'neha.joshi@truprm.com', empNum: 'EMP013', first: 'Neha', last: 'Joshi', title: 'Marketing Manager', dept: 'Marketing', color: '#06b6d4', wage: 72000, bankAccount: '501002233445', bankName: 'HDFC Bank', bankIfsc: 'HDFC0001234', hasStructure: true, hasActiveContract: true },
    { email: 'rahul.nair@truprm.com', empNum: 'EMP014', first: 'Rahul', last: 'Nair', title: 'Technical Writer', dept: 'Operations', color: '#64748b', wage: 48000, bankAccount: '60192776655', bankName: 'Kotak Bank', bankIfsc: 'KKBK0000789', hasStructure: true, hasActiveContract: true },
    { email: 'vikram.malhotra@truprm.com', empNum: 'EMP015', first: 'Vikram', last: 'Malhotra', title: 'Security Specialist', dept: 'Security', color: '#dc2626', wage: 80000, bankAccount: null, bankName: null, bankIfsc: null, hasStructure: true, hasActiveContract: true }, // FAIL: Missing Bank Details
    { email: 'tanvi.kapoor@truprm.com', empNum: 'EMP016', first: 'Tanvi', last: 'Kapoor', title: 'Scrum Master', dept: 'Engineering', color: '#9333ea', wage: 74000, bankAccount: '000403344556', bankName: 'ICICI Bank', bankIfsc: 'ICIC0000004', hasStructure: true, hasActiveContract: true },
    { email: 'aditya.rao@truprm.com', empNum: 'EMP017', first: 'Aditya', last: 'Rao', title: 'Business Analyst', dept: 'Product & UX', color: '#0284c7', wage: 60000, bankAccount: '918010011223', bankName: 'Axis Bank', bankIfsc: 'UTIB0000123', hasStructure: true, hasActiveContract: true },
    { email: 'neha.kapoor@truprm.com', empNum: 'EMP018', first: 'Neha', last: 'Kapoor', title: 'Content Specialist', dept: 'Marketing', color: '#e11d48', wage: 45000, bankAccount: null, bankName: null, bankIfsc: null, hasStructure: false, hasActiveContract: true }, // FAIL: Multiple failures (Bank & Salary structure)
    { email: 'siddharth.roy@truprm.com', empNum: 'EMP019', first: 'Siddharth', last: 'Roy', title: 'Database Administrator', dept: 'Infrastructure', color: '#15803d', wage: 78000, bankAccount: '501007788990', bankName: 'HDFC Bank', bankIfsc: 'HDFC0001234', hasStructure: true, hasActiveContract: true },
    { email: 'ishita.banerjee@truprm.com', empNum: 'EMP020', first: 'Ishita', last: 'Banerjee', title: 'Talent Acquisition Lead', dept: 'Human Resources', color: '#b91c1c', wage: 64000, bankAccount: '30491855667', bankName: 'SBI', bankIfsc: 'SBIN0000456', hasStructure: true, hasActiveContract: true },
  ];

  const seededEmployees: Record<string, any> = {};

  for (const uData of demoUsersData) {
    let u = await prisma.user.findUnique({ where: { email: uData.email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: uData.email,
          passwordHash,
          role: Role.EMPLOYEE,
        },
      });
    }

    let empRecord = await prisma.employee.findUnique({ where: { userId: u.id } });
    if (!empRecord) {
      empRecord = await prisma.employee.create({
        data: {
          userId: u.id,
          employeeNumber: uData.empNum,
          firstName: uData.first,
          lastName: uData.last,
          hireDate: new Date('2025-01-15'),
          jobTitle: uData.title,
          department: uData.dept,
          bankAccount: uData.bankAccount,
          bankName: uData.bankName,
          bankIfsc: uData.bankIfsc,
          color: uData.color,
        },
      });
    } else {
      empRecord = await prisma.employee.update({
        where: { id: empRecord.id },
        data: {
          bankAccount: uData.bankAccount,
          bankName: uData.bankName,
          bankIfsc: uData.bankIfsc,
        },
      });
    }

    const existingContract = await prisma.contract.findFirst({ where: { employeeId: empRecord.id } });
    if (!existingContract) {
      await prisma.contract.create({
        data: {
          employeeId: empRecord.id,
          contractType: ContractType.FULL_TIME,
          status: uData.hasActiveContract ? ContractStatus.ACTIVE : ContractStatus.TERMINATED,
          startDate: new Date('2025-01-15'),
          wageAmount: uData.wage,
          salaryStructureId: uData.hasStructure ? structure.id : null,
        },
      });
    }

    seededEmployees[uData.first] = empRecord;
  }
  console.log(`✓ Seeded ${Object.keys(seededEmployees).length} demo employees with contracts.`);

  // 6. Ensure Configurable Time Off Types
  const defaultTypes = [
    {
      name: 'Sick Leave',
      code: 'SICK',
      description: 'Leave taken due to illness or medical appointment',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: true,
      allocationAmount: 10,
      requiresApproval: true,
      isSandwichLeave: false,
    },
    {
      name: 'Flexi Leave',
      code: 'FLEXI',
      description: 'Flexible leave for personal obligations',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: true,
      allocationAmount: 6,
      requiresApproval: true,
      isSandwichLeave: false,
    },
    {
      name: 'Compensatory Leave',
      code: 'COMP_OFF',
      description: 'Leave earned from extra hours worked / overtime',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: false,
      isEarnedThroughWork: true,
      requiresApproval: true,
    },
    {
      name: 'Sandwich Leave',
      code: 'SANDWICH',
      description: 'Leave spanning weekends where weekend days are included',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: true,
      allocationAmount: 5,
      requiresApproval: true,
      isSandwichLeave: true,
    },
    {
      name: 'Paid Annual Leave',
      code: 'ANNUAL',
      description: 'Annual vacation leave',
      unit: 'DAYS',
      isPaid: true,
      requiresAllocation: true,
      allocationAmount: 15,
      requiresApproval: true,
    },
  ];

  const seededTypes: Record<string, any> = {};
  for (const t of defaultTypes) {
    const typeObj = await prisma.timeOffType.upsert({
      where: { code: t.code },
      update: t,
      create: t,
    });
    seededTypes[t.code] = typeObj;
  }
  console.log('✓ Configurable Time Off Types seeded.');

  // Create sample allocations for employees
  const allEmployees = await prisma.employee.findMany();
  const allAllocTypes = await prisma.timeOffType.findMany({ where: { requiresAllocation: true } });

  const currentYear = new Date().getFullYear();
  for (const employee of allEmployees) {
    for (const type of allAllocTypes) {
      const existingAlloc = await prisma.timeOffAllocation.findFirst({
        where: { employeeId: employee.id, timeOffTypeId: type.id, year: currentYear },
      });
      if (!existingAlloc) {
        const allocated = type.allocationAmount || 10;
        await prisma.timeOffAllocation.create({
          data: {
            employeeId: employee.id,
            timeOffTypeId: type.id,
            year: currentYear,
            daysAllocated: allocated,
            daysUsed: 0,
            remaining: allocated,
          },
        });
      }
    }
  }
  console.log('✓ Employee leave allocations initialized.');

  // Seed Comp-Off credits
  const johnDsouza = seededEmployees['John'] || allEmployees.find(e => e.firstName === 'John' && e.lastName === 'Dsouza');
  const aaravMehta = seededEmployees['Aarav'] || allEmployees.find(e => e.firstName === 'Aarav');

  if (johnDsouza) {
    const existingComp = await prisma.compOffCredit.findFirst({ where: { employeeId: johnDsouza.id } });
    if (!existingComp) {
      await prisma.compOffCredit.create({
        data: {
          employeeId: johnDsouza.id,
          dateEarned: new Date('2026-09-01'),
          daysEarned: 3,
          hoursWorked: 12,
          reason: 'Comp-off for Sunday overtime project launch',
          status: 'APPROVED',
          usedDays: 0,
          remainingDays: 3,
        },
      });
    }
  }

  if (aaravMehta) {
    const existingComp = await prisma.compOffCredit.findFirst({ where: { employeeId: aaravMehta.id } });
    if (!existingComp) {
      await prisma.compOffCredit.create({
        data: {
          employeeId: aaravMehta.id,
          dateEarned: new Date('2026-08-15'),
          daysEarned: 2,
          hoursWorked: 16,
          reason: 'Emergency server patch support',
          status: 'APPROVED',
          usedDays: 0,
          remainingDays: 2,
        },
      });
    }
  }
  console.log('✓ Comp-Off credits seeded.');

  // Seed realistic Time Off Requests
  const requestsToSeed = [
    {
      empName: 'Aarav',
      typeCode: 'SICK',
      startDate: new Date('2026-09-12'),
      endDate: new Date('2026-09-14'),
      daysRequested: 3,
      status: TimeOffStatus.APPROVED,
      reason: 'Medical rest following fever and doctor advice',
    },
    {
      empName: 'Sara',
      typeCode: 'FLEXI',
      startDate: new Date('2026-09-18'),
      endDate: new Date('2026-09-18'),
      daysRequested: 1,
      status: TimeOffStatus.CONFIRMED,
      reason: 'Personal family milestone event',
    },
    {
      empName: 'John', // John Dsouza
      typeCode: 'COMP_OFF',
      startDate: new Date('2026-09-27'),
      endDate: new Date('2026-09-27'),
      daysRequested: 1,
      status: TimeOffStatus.CONFIRMED,
      reason: 'Availing earned comp-off for overtime worked on launch day',
    },
    {
      empName: 'Meha',
      typeCode: 'SICK',
      startDate: new Date('2026-09-02'),
      endDate: new Date('2026-09-03'),
      daysRequested: 2,
      status: TimeOffStatus.REFUSED,
      reason: 'Dental procedure rest',
      refusalReason: 'High HR audit workload on target dates',
    },
    {
      empName: 'Aarav',
      typeCode: 'FLEXI',
      startDate: new Date('2026-09-25'),
      endDate: new Date('2026-09-25'),
      daysRequested: 1,
      status: TimeOffStatus.CONFIRMED,
      reason: 'Relocation assistance and home setup',
    },
  ];

  for (const r of requestsToSeed) {
    const empMatch = allEmployees.find(e => e.firstName === r.empName) || Object.values(seededEmployees).find(e => e.firstName === r.empName);
    const typeMatch = seededTypes[r.typeCode];

    if (empMatch && typeMatch) {
      const existingReq = await prisma.timeOffRequest.findFirst({
        where: {
          employeeId: empMatch.id,
          timeOffTypeId: typeMatch.id,
          startDate: r.startDate,
        },
      });

      if (!existingReq) {
        const createdReq = await prisma.timeOffRequest.create({
          data: {
            employeeId: empMatch.id,
            timeOffTypeId: typeMatch.id,
            startDate: r.startDate,
            endDate: r.endDate,
            daysRequested: r.daysRequested,
            status: r.status,
            reason: r.reason,
            refusalReason: r.refusalReason || null,
            approvedAt: r.status === TimeOffStatus.APPROVED ? new Date() : null,
          },
        });

        // If approved, update allocation accordingly
        if (r.status === TimeOffStatus.APPROVED && typeMatch.requiresAllocation) {
          const alloc = await prisma.timeOffAllocation.findFirst({
            where: { employeeId: empMatch.id, timeOffTypeId: typeMatch.id, year: currentYear },
          });
          if (alloc) {
            await prisma.timeOffAllocation.update({
              where: { id: alloc.id },
              data: {
                daysUsed: alloc.daysUsed + r.daysRequested,
                remaining: Math.max(0, alloc.daysAllocated - (alloc.daysUsed + r.daysRequested)),
              },
            });
          }
        }
      }
    }
  }
  console.log('✓ Realistic Time Off Requests seeded.');

  // 7. Purge & Seed Demo Pay Run & Generated Payslips (Pre-Check Filtered)
  const failingUsers = demoUsersData.filter(
    (u) => !u.hasStructure || !u.hasActiveContract || !u.bankAccount || u.wage <= 0
  );
  const failingEmpNums = failingUsers.map((u) => u.empNum);

  const failingEmps = await prisma.employee.findMany({
    where: { employeeNumber: { in: failingEmpNums } },
  });

  const failingEmpIds = failingEmps.map((e) => e.id);

  if (failingEmpIds.length > 0) {
    await prisma.payslipLine.deleteMany({
      where: { payslip: { employeeId: { in: failingEmpIds } } },
    });
    await prisma.payslip.deleteMany({
      where: { employeeId: { in: failingEmpIds } },
    });
    console.log(`✓ Purged legacy payslip records for ${failingEmpIds.length} pre-check failing employees.`);
  }

  // Purge any legacy zero-net pay / invalid payslips
  await prisma.payslipLine.deleteMany({
    where: { payslip: { OR: [{ netWage: { lte: 0 } }, { grossWage: { lte: 0 } }] } },
  });
  await prisma.payslip.deleteMany({
    where: { OR: [{ netWage: { lte: 0 } }, { grossWage: { lte: 0 } }] },
  });

  let marchPayrun = await prisma.payrun.findFirst({ where: { name: 'March 2026 Regular Payroll' } });
  if (!marchPayrun) {
    marchPayrun = await prisma.payrun.create({
      data: {
        name: 'March 2026 Regular Payroll',
        periodStart: new Date('2026-03-01'),
        periodEnd: new Date('2026-03-31'),
        notes: 'Monthly regular payroll cycle for March 2026',
        state: 'COMPUTED',
      },
    });
  }

  let febAuditPayrun = await prisma.payrun.findFirst({ where: { name: 'February 2026 Audit Payroll' } });
  if (!febAuditPayrun) {
    febAuditPayrun = await prisma.payrun.create({
      data: {
        name: 'February 2026 Audit Payroll',
        periodStart: new Date('2026-02-01'),
        periodEnd: new Date('2026-02-28'),
        notes: 'Pre-computation check failed: Selected employees contain invalid bank/contract configurations.',
        state: 'VALIDATION_ERROR',
      },
    });
  }

  for (const uData of demoUsersData) {
    // STRICT PRE-CHECK HARD GATE FILTER IN SEED
    if (!uData.hasStructure || !uData.hasActiveContract || !uData.bankAccount || uData.wage <= 0) {
      // FAILS PRECHECK: STRICTLY DO NOT GENERATE PAYSLIP RECORD
      continue;
    }

    const emp = await prisma.employee.findFirst({ where: { employeeNumber: uData.empNum } });
    if (!emp) continue;

    const existingPayslip = await prisma.payslip.findFirst({
      where: { payrunId: marchPayrun.id, employeeId: emp.id },
    });

    if (!existingPayslip) {
      const basic = uData.wage;
      const hra = Math.round(basic * 0.40);
      const transport = 3000;
      const medical = 2500;
      const gross = basic + hra + transport + medical;
      const pf = Math.round(basic * 0.12);
      const pt = 200;
      const totalDed = pf + pt;
      const net = gross - totalDed;
      const employerPf = pf;

      await prisma.payslip.create({
        data: {
          payrunId: marchPayrun.id,
          employeeId: emp.id,
          salaryStructureId: structure.id,
          periodStart: new Date('2026-03-01'),
          periodEnd: new Date('2026-03-31'),
          basicWage: basic,
          grossWage: gross,
          totalDeductions: totalDed,
          netWage: net,
          state: 'COMPUTED',
          status: 'COMPUTED',
          lines: {
            create: [
              { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.EARNING, quantity: 1, rate: basic, amount: basic },
              { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.EARNING, quantity: 1, rate: hra, amount: hra },
              { name: 'Transport Allowance', code: 'TRANSPORT', category: SalaryRuleCategory.EARNING, quantity: 1, rate: transport, amount: transport },
              { name: 'Medical Allowance', code: 'MEDICAL', category: SalaryRuleCategory.EARNING, quantity: 1, rate: medical, amount: medical },
              { name: 'Provident Fund (Employee)', code: 'PF', category: SalaryRuleCategory.DEDUCTION, quantity: 1, rate: pf, amount: pf },
              { name: 'Professional Tax', code: 'PT', category: SalaryRuleCategory.DEDUCTION, quantity: 1, rate: pt, amount: pt },
              { name: 'Employer PF Contribution', code: 'EMPLOYER_PF', category: SalaryRuleCategory.EMPLOYER_CONTRIBUTION, quantity: 1, rate: employerPf, amount: employerPf },
            ],
          },
        },
      });
    }
  }
  console.log('✓ March 2026 Pay Run and Payslips seeded for eligible pre-check passing employees.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
