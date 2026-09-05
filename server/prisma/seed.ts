import { PrismaClient, Role, ContractType, ContractStatus, DayOfWeek, AttendanceStatus, TimeOffStatus, SalaryRuleCategory, PayrunState } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with representative HR & Payroll data...');

  const defaultPassword = 'Password@1234';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@truprm.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const standardHash = await bcrypt.hash(defaultPassword, 12);

  // 1. Seed Users
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: Role.ADMIN },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      role: Role.ADMIN,
      mustChangePassword: false,
    },
  });
  console.log(`✓ Admin user: ${adminUser.email}`);

  const payrollUser = await prisma.user.upsert({
    where: { email: 'payroll_user@truprm.com' },
    update: { passwordHash: standardHash, role: Role.HR_PAYROLL_USER },
    create: {
      email: 'payroll_user@truprm.com',
      passwordHash: standardHash,
      role: Role.HR_PAYROLL_USER,
      mustChangePassword: false,
    },
  });
  console.log(`✓ HR Payroll User: ${payrollUser.email}`);

  const hrManager = await prisma.user.upsert({
    where: { email: 'hr_manager@truprm.com' },
    update: { passwordHash: standardHash, role: Role.HR_MANAGER },
    create: {
      email: 'hr_manager@truprm.com',
      passwordHash: standardHash,
      role: Role.HR_MANAGER,
      mustChangePassword: false,
    },
  });
  console.log(`✓ HR Manager: ${hrManager.email}`);

  const empUsers = await Promise.all([
    prisma.user.upsert({
      where: { email: 'john.doe@truprm.com' },
      update: { passwordHash: standardHash, role: Role.EMPLOYEE },
      create: { email: 'john.doe@truprm.com', passwordHash: standardHash, role: Role.EMPLOYEE },
    }),
    prisma.user.upsert({
      where: { email: 'jane.smith@truprm.com' },
      update: { passwordHash: standardHash, role: Role.EMPLOYEE },
      create: { email: 'jane.smith@truprm.com', passwordHash: standardHash, role: Role.EMPLOYEE },
    }),
    prisma.user.upsert({
      where: { email: 'mark.johnson@truprm.com' },
      update: { passwordHash: standardHash, role: Role.EMPLOYEE },
      create: { email: 'mark.johnson@truprm.com', passwordHash: standardHash, role: Role.EMPLOYEE },
    }),
    prisma.user.upsert({
      where: { email: 'sarah.williams@truprm.com' },
      update: { passwordHash: standardHash, role: Role.EMPLOYEE },
      create: { email: 'sarah.williams@truprm.com', passwordHash: standardHash, role: Role.EMPLOYEE },
    }),
    prisma.user.upsert({
      where: { email: 'michael.brown@truprm.com' },
      update: { passwordHash: standardHash, role: Role.EMPLOYEE },
      create: { email: 'michael.brown@truprm.com', passwordHash: standardHash, role: Role.EMPLOYEE },
    }),
  ]);

  // 2. Working Schedules
  const standardSchedule = await prisma.workingSchedule.upsert({
    where: { name: 'Standard 40 Hours' },
    update: {},
    create: {
      name: 'Standard 40 Hours',
      hoursPerWeek: 40,
      flexibleHours: false,
      scheduleLines: {
        create: [
          { dayOfWeek: DayOfWeek.MONDAY, timeFrom: '09:00', timeTo: '18:00' },
          { dayOfWeek: DayOfWeek.TUESDAY, timeFrom: '09:00', timeTo: '18:00' },
          { dayOfWeek: DayOfWeek.WEDNESDAY, timeFrom: '09:00', timeTo: '18:00' },
          { dayOfWeek: DayOfWeek.THURSDAY, timeFrom: '09:00', timeTo: '18:00' },
          { dayOfWeek: DayOfWeek.FRIDAY, timeFrom: '09:00', timeTo: '18:00' },
        ],
      },
    },
  });

  const partTimeSchedule = await prisma.workingSchedule.upsert({
    where: { name: 'Part-Time 20 Hours' },
    update: {},
    create: {
      name: 'Part-Time 20 Hours',
      hoursPerWeek: 20,
      flexibleHours: true,
      scheduleLines: {
        create: [
          { dayOfWeek: DayOfWeek.MONDAY, timeFrom: '09:00', timeTo: '16:00' },
          { dayOfWeek: DayOfWeek.TUESDAY, timeFrom: '09:00', timeTo: '16:00' },
          { dayOfWeek: DayOfWeek.WEDNESDAY, timeFrom: '09:00', timeTo: '16:00' },
        ],
      },
    },
  });
  console.log('✓ Working schedules seeded');

  // 3. Salary Structures & Rules
  const regularStructure = await prisma.salaryStructure.upsert({
    where: { code: 'REG_SALARY' },
    update: {},
    create: {
      name: 'Regular Salary Structure',
      code: 'REG_SALARY',
      description: 'Standard corporate structure with Basic, Allowances, PF, and Taxes',
      rules: {
        create: [
          { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, sequence: 10, amountPercentage: new Decimal(0.50), appears_on_payslip: true },
          { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, sequence: 20, amountPercentage: new Decimal(0.40), baseCode: 'BASIC', appears_on_payslip: true },
          { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, sequence: 30, amountFixed: new Decimal(1200.00), appears_on_payslip: true },
          { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, sequence: 50, appears_on_payslip: true },
          { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, sequence: 60, amountPercentage: new Decimal(0.12), baseCode: 'BASIC', appears_on_payslip: true },
          { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, sequence: 70, amountFixed: new Decimal(200.00), appears_on_payslip: true },
          { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, sequence: 100, appears_on_payslip: true },
        ],
      },
    },
  });

  const execStructure = await prisma.salaryStructure.upsert({
    where: { code: 'EXEC_SALARY' },
    update: {},
    create: {
      name: 'Executive Salary Structure',
      code: 'EXEC_SALARY',
      description: 'Executive structure with performance allowance',
      rules: {
        create: [
          { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, sequence: 10, amountPercentage: new Decimal(0.55), appears_on_payslip: true },
          { name: 'Executive Allowance', code: 'EXEC_ALLOW', category: SalaryRuleCategory.ALLOWANCE, sequence: 20, amountFixed: new Decimal(2500.00), appears_on_payslip: true },
          { name: 'HRA Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, sequence: 30, amountPercentage: new Decimal(0.35), baseCode: 'BASIC', appears_on_payslip: true },
          { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, sequence: 50, appears_on_payslip: true },
          { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, sequence: 60, amountPercentage: new Decimal(0.12), baseCode: 'BASIC', appears_on_payslip: true },
          { name: 'Income Tax Deductions', code: 'IT_DEDUCT', category: SalaryRuleCategory.DEDUCTION, sequence: 70, amountFixed: new Decimal(500.00), appears_on_payslip: true },
          { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, sequence: 100, appears_on_payslip: true },
        ],
      },
    },
  });
  console.log('✓ Salary structures and rules seeded');

  // 4. Employees
  const emp1 = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP001' },
    update: {},
    create: {
      userId: empUsers[0].id,
      employeeNumber: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'Senior Software Engineer',
      department: 'IT',
      hireDate: new Date('2023-01-15'),
      color: '#6366f1',
    },
  });

  const emp2 = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP002' },
    update: {},
    create: {
      userId: empUsers[1].id,
      employeeNumber: 'EMP002',
      firstName: 'Jane',
      lastName: 'Smith',
      jobTitle: 'Sales Executive',
      department: 'Sales',
      hireDate: new Date('2023-03-01'),
      color: '#ec4899',
    },
  });

  const emp3 = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP003' },
    update: {},
    create: {
      userId: empUsers[2].id,
      employeeNumber: 'EMP003',
      firstName: 'Mark',
      lastName: 'Johnson',
      jobTitle: 'HR Specialist',
      department: 'HR',
      hireDate: new Date('2023-05-10'),
      color: '#10b981',
    },
  });

  const emp4 = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP004' },
    update: {},
    create: {
      userId: empUsers[3].id,
      employeeNumber: 'EMP004',
      firstName: 'Sarah',
      lastName: 'Williams',
      jobTitle: 'Financial Analyst',
      department: 'Finance',
      hireDate: new Date('2023-08-01'),
      color: '#f59e0b',
    },
  });

  const emp5 = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP005' },
    update: {},
    create: {
      userId: empUsers[4].id,
      employeeNumber: 'EMP005',
      firstName: 'Michael',
      lastName: 'Brown',
      jobTitle: 'Junior Developer',
      department: 'IT',
      hireDate: new Date('2024-02-15'),
      color: '#8b5cf6',
    },
  });
  console.log('✓ Employees seeded');

  // 5. Contracts
  // Delete existing demo contracts for clean re-seed
  await prisma.contract.deleteMany({
    where: { employeeId: { in: [emp1.id, emp2.id, emp3.id, emp4.id, emp5.id] } },
  });

  await prisma.contract.createMany({
    data: [
      {
        employeeId: emp1.id,
        contractType: ContractType.FULL_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2023-01-15'),
        wageCurrency: 'USD',
        wageAmount: new Decimal(8000.00),
        workingScheduleId: standardSchedule.id,
        salaryStructureId: regularStructure.id,
        notes: 'Verified Bank: Chase Bank #987654321',
      },
      {
        employeeId: emp2.id,
        contractType: ContractType.FULL_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2023-03-01'),
        wageCurrency: 'USD',
        wageAmount: new Decimal(6000.00),
        workingScheduleId: standardSchedule.id,
        salaryStructureId: regularStructure.id,
        notes: 'Verified Bank: Wells Fargo #123456789',
      },
      {
        employeeId: emp3.id,
        contractType: ContractType.FULL_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2023-05-10'),
        wageCurrency: 'USD',
        wageAmount: new Decimal(5500.00),
        workingScheduleId: standardSchedule.id,
        salaryStructureId: regularStructure.id,
        notes: 'Verified Bank: Bank of America #456123789',
      },
      {
        employeeId: emp4.id,
        contractType: ContractType.FULL_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2023-08-01'),
        wageCurrency: 'USD',
        wageAmount: new Decimal(7000.00),
        workingScheduleId: standardSchedule.id,
        salaryStructureId: regularStructure.id,
        notes: 'Pending bank verification', // Triggers missing bank warning in payrun
      },
      {
        employeeId: emp5.id,
        contractType: ContractType.PART_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2024-02-15'),
        wageCurrency: 'USD',
        wageAmount: new Decimal(4500.00),
        workingScheduleId: partTimeSchedule.id,
        salaryStructureId: regularStructure.id,
        notes: 'Verified Bank: Citibank #654987321',
      },
    ],
  });
  console.log('✓ Contracts seeded');

  // 6. Time Off Types & Requests
  const pto = await prisma.timeOffType.upsert({
    where: { code: 'PTO' },
    update: {},
    create: {
      name: 'Paid Time Off',
      code: 'PTO',
      isPaid: true,
      maxDaysPerYear: 20,
      requiresApproval: true,
    },
  });

  const sickLeave = await prisma.timeOffType.upsert({
    where: { code: 'SICK' },
    update: {},
    create: {
      name: 'Sick Leave',
      code: 'SICK',
      isPaid: true,
      maxDaysPerYear: 10,
      requiresApproval: true,
    },
  });

  // Time off allocations
  await prisma.timeOffAllocation.upsert({
    where: {
      employeeId_timeOffTypeId_year: {
        employeeId: emp1.id,
        timeOffTypeId: pto.id,
        year: 2026,
      },
    },
    update: {},
    create: {
      employeeId: emp1.id,
      timeOffTypeId: pto.id,
      year: 2026,
      daysAllocated: 20,
      daysUsed: 3,
    },
  });

  // Sample time off requests
  await prisma.timeOffRequest.deleteMany({
    where: { employeeId: { in: [emp1.id, emp2.id, emp3.id] } },
  });

  await prisma.timeOffRequest.createMany({
    data: [
      {
        employeeId: emp1.id,
        timeOffTypeId: pto.id,
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-12'),
        daysRequested: 3,
        status: TimeOffStatus.VALIDATED,
        reason: 'Family vacation',
        approvedById: hrManager.id,
        approvedAt: new Date(),
      },
      {
        employeeId: emp2.id,
        timeOffTypeId: sickLeave.id,
        startDate: new Date('2026-09-15'),
        endDate: new Date('2026-09-16'),
        daysRequested: 2,
        status: TimeOffStatus.DRAFT,
        reason: 'Medical checkup and recovery',
      },
      {
        employeeId: emp3.id,
        timeOffTypeId: pto.id,
        startDate: new Date('2026-08-20'),
        endDate: new Date('2026-08-22'),
        daysRequested: 3,
        status: TimeOffStatus.REFUSED,
        reason: 'Personal leave',
        refusalReason: 'Staffing shortage in HR department during audit week',
      },
    ],
  });
  console.log('✓ Time off types and requests seeded');

  // 7. Attendances
  await prisma.attendance.deleteMany({
    where: { employeeId: { in: [emp1.id, emp2.id, emp3.id, emp4.id, emp5.id] } },
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await prisma.attendance.createMany({
    data: [
      {
        employeeId: emp1.id,
        date: today,
        checkIn: new Date(today.setHours(9, 2, 0)),
        checkOut: new Date(today.setHours(18, 5, 0)),
        status: AttendanceStatus.PRESENT,
        notes: 'Regular on-time attendance',
      },
      {
        employeeId: emp2.id,
        date: today,
        checkIn: new Date(today.setHours(9, 35, 0)),
        checkOut: new Date(today.setHours(18, 15, 0)),
        status: AttendanceStatus.LATE,
        notes: 'Traffic delay on highway',
      },
      {
        employeeId: emp3.id,
        date: today,
        checkIn: new Date(today.setHours(9, 0, 0)),
        checkOut: new Date(today.setHours(13, 0, 0)),
        status: AttendanceStatus.HALF_DAY,
        notes: 'Doctor appointment in afternoon (approved)',
      },
      {
        employeeId: emp4.id,
        date: today,
        checkIn: null,
        checkOut: null,
        status: AttendanceStatus.ABSENT,
        notes: 'Unplanned absence',
      },
      {
        employeeId: emp5.id,
        date: today,
        checkIn: new Date(today.setHours(9, 10, 0)),
        checkOut: new Date(today.setHours(16, 0, 0)),
        status: AttendanceStatus.PRESENT,
        notes: 'Part-time schedule shift',
      },
    ],
  });
  console.log('✓ Attendances seeded');

  // 8. Payruns & Payslips
  await prisma.payrun.deleteMany({});

  // Past Paid Payrun (August 2026)
  const paidPayrun = await prisma.payrun.create({
    data: {
      name: 'August 2026 Regular Payrun',
      periodStart: new Date('2026-08-01'),
      periodEnd: new Date('2026-08-31'),
      state: PayrunState.DONE,
      notes: JSON.stringify({ status: 'PAID', paidAt: new Date('2026-08-31') }),
      payslips: {
        create: [
          {
            employeeId: emp1.id,
            salaryStructureId: regularStructure.id,
            periodStart: new Date('2026-08-01'),
            periodEnd: new Date('2026-08-31'),
            basicWage: new Decimal(4000.00),
            grossWage: new Decimal(6800.00),
            netWage: new Decimal(6120.00),
            lines: {
              create: [
                { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, rate: new Decimal(4000.00), amount: new Decimal(4000.00) },
                { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1600.00), amount: new Decimal(1600.00) },
                { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, rate: new Decimal(6800.00), amount: new Decimal(6800.00) },
                { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(480.00), amount: new Decimal(480.00) },
                { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(200.00), amount: new Decimal(200.00) },
                { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, rate: new Decimal(6120.00), amount: new Decimal(6120.00) },
              ],
            },
          },
          {
            employeeId: emp2.id,
            salaryStructureId: regularStructure.id,
            periodStart: new Date('2026-08-01'),
            periodEnd: new Date('2026-08-31'),
            basicWage: new Decimal(3000.00),
            grossWage: new Decimal(5400.00),
            netWage: new Decimal(4840.00),
            lines: {
              create: [
                { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, rate: new Decimal(3000.00), amount: new Decimal(3000.00) },
                { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, rate: new Decimal(5400.00), amount: new Decimal(5400.00) },
                { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(360.00), amount: new Decimal(360.00) },
                { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(200.00), amount: new Decimal(200.00) },
                { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, rate: new Decimal(4840.00), amount: new Decimal(4840.00) },
              ],
            },
          },
        ],
      },
    },
  });

  // Current Month Draft/Computed Payrun (September 2026)
  const currentPayrun = await prisma.payrun.create({
    data: {
      name: 'September 2026 Monthly Payrun',
      periodStart: new Date('2026-09-01'),
      periodEnd: new Date('2026-09-30'),
      state: PayrunState.DRAFT,
      notes: JSON.stringify({ status: 'COMPUTED' }),
      payslips: {
        create: [
          {
            employeeId: emp1.id,
            salaryStructureId: regularStructure.id,
            periodStart: new Date('2026-09-01'),
            periodEnd: new Date('2026-09-30'),
            basicWage: new Decimal(4000.00),
            grossWage: new Decimal(6800.00),
            netWage: new Decimal(6120.00),
            lines: {
              create: [
                { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, rate: new Decimal(4000.00), amount: new Decimal(4000.00) },
                { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1600.00), amount: new Decimal(1600.00) },
                { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, rate: new Decimal(6800.00), amount: new Decimal(6800.00) },
                { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(480.00), amount: new Decimal(480.00) },
                { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(200.00), amount: new Decimal(200.00) },
                { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, rate: new Decimal(6120.00), amount: new Decimal(6120.00) },
              ],
            },
          },
          {
            employeeId: emp2.id,
            salaryStructureId: regularStructure.id,
            periodStart: new Date('2026-09-01'),
            periodEnd: new Date('2026-09-30'),
            basicWage: new Decimal(3000.00),
            grossWage: new Decimal(5400.00),
            netWage: new Decimal(4840.00),
            lines: {
              create: [
                { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, rate: new Decimal(3000.00), amount: new Decimal(3000.00) },
                { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, rate: new Decimal(5400.00), amount: new Decimal(5400.00) },
                { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(360.00), amount: new Decimal(360.00) },
                { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(200.00), amount: new Decimal(200.00) },
                { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, rate: new Decimal(4840.00), amount: new Decimal(4840.00) },
              ],
            },
          },
          {
            employeeId: emp3.id,
            salaryStructureId: regularStructure.id,
            periodStart: new Date('2026-09-01'),
            periodEnd: new Date('2026-09-30'),
            basicWage: new Decimal(2750.00),
            grossWage: new Decimal(5050.00),
            netWage: new Decimal(4520.00),
            lines: {
              create: [
                { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, rate: new Decimal(2750.00), amount: new Decimal(2750.00) },
                { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1100.00), amount: new Decimal(1100.00) },
                { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, rate: new Decimal(5050.00), amount: new Decimal(5050.00) },
                { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(330.00), amount: new Decimal(330.00) },
                { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(200.00), amount: new Decimal(200.00) },
                { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, rate: new Decimal(4520.00), amount: new Decimal(4520.00) },
              ],
            },
          },
          {
            employeeId: emp4.id,
            salaryStructureId: regularStructure.id,
            periodStart: new Date('2026-09-01'),
            periodEnd: new Date('2026-09-30'),
            basicWage: new Decimal(3500.00),
            grossWage: new Decimal(6100.00),
            netWage: new Decimal(5480.00),
            lines: {
              create: [
                { name: 'Basic Salary', code: 'BASIC', category: SalaryRuleCategory.BASIC, rate: new Decimal(3500.00), amount: new Decimal(3500.00) },
                { name: 'House Rent Allowance', code: 'HRA', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1400.00), amount: new Decimal(1400.00) },
                { name: 'Standard Allowance', code: 'STD_ALLOW', category: SalaryRuleCategory.ALLOWANCE, rate: new Decimal(1200.00), amount: new Decimal(1200.00) },
                { name: 'Gross Salary', code: 'GROSS', category: SalaryRuleCategory.GROSS, rate: new Decimal(6100.00), amount: new Decimal(6100.00) },
                { name: 'Provident Fund', code: 'PF', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(420.00), amount: new Decimal(420.00) },
                { name: 'Professional Tax', code: 'PROF_TAX', category: SalaryRuleCategory.DEDUCTION, rate: new Decimal(200.00), amount: new Decimal(200.00) },
                { name: 'Net Salary', code: 'NET', category: SalaryRuleCategory.NET, rate: new Decimal(5480.00), amount: new Decimal(5480.00) },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`✓ Payruns seeded (${paidPayrun.name}, ${currentPayrun.name})`);
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
