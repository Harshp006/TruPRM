import { PrismaClient, Role, StructureStatus, RuleStatus, RuleCalculationType, SalaryRuleCategory, ContractType, ContractStatus } from '@prisma/client';
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

  // Ensure Employee profile & Contract
  let emp = await prisma.employee.findUnique({ where: { userId: employeeUser.id } });
  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        userId: employeeUser.id,
        employeeNumber: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        hireDate: new Date('2025-01-15'),
        jobTitle: 'Software Engineer',
        department: 'Engineering',
      },
    });

    await prisma.contract.create({
      data: {
        employeeId: emp.id,
        contractType: ContractType.FULL_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2025-01-15'),
        wageAmount: 50000,
        salaryStructureId: structure.id,
      },
    });
    console.log(`✓ Sample employee John Doe (EMP001) contract created.`);
  }

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

  for (const t of defaultTypes) {
    await prisma.timeOffType.upsert({
      where: { code: t.code },
      update: t,
      create: t,
    });
  }
  console.log('✓ Configurable Time Off Types seeded.');

  // Create sample allocations for employees
  const allEmployees = await prisma.employee.findMany();
  const allTypes = await prisma.timeOffType.findMany({ where: { requiresAllocation: true } });

  const currentYear = new Date().getFullYear();
  for (const employee of allEmployees) {
    for (const type of allTypes) {
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
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
