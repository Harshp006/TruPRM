import { PrismaClient, Role, ContractType, ContractStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const profiles = [
  { first: 'Amit', last: 'Patel', email: 'amit.patel@truprm.com', role: Role.ADMIN, title: 'Systems Administrator', dept: 'IT', wage: 180000 },
  { first: 'Priya', last: 'Singh', email: 'priya.singh@truprm.com', role: Role.HR_MANAGER, title: 'HR Manager', dept: 'HR', wage: 160000 },
  { first: 'Sneha', last: 'Reddy', email: 'sneha.reddy@truprm.com', role: Role.HR_PAYROLL_ADMIN, title: 'Payroll Admin', dept: 'HR', wage: 155000 },
  { first: 'Ravi', last: 'Kumar', email: 'ravi.kumar@truprm.com', role: Role.HR_PAYROLL_USER, title: 'Payroll Specialist', dept: 'HR', wage: 90000 },
  { first: 'Arjun', last: 'Das', email: 'arjun.das@truprm.com', role: Role.EMPLOYEE, title: 'Software Engineer', dept: 'Engineering', wage: 120000 },
  { first: 'Neha', last: 'Gupta', email: 'neha.gupta@truprm.com', role: Role.EMPLOYEE, title: 'QA Engineer', dept: 'Engineering', wage: 95000 },
  { first: 'Vikas', last: 'Joshi', email: 'vikas.joshi@truprm.com', role: Role.EMPLOYEE, title: 'Frontend Developer', dept: 'Engineering', wage: 130000 },
  { first: 'Anjali', last: 'Mehta', email: 'anjali.mehta@truprm.com', role: Role.EMPLOYEE, title: 'Product Manager', dept: 'Product', wage: 175000 },
  { first: 'Karthik', last: 'Nair', email: 'karthik.nair@truprm.com', role: Role.EMPLOYEE, title: 'DevOps Engineer', dept: 'Engineering', wage: 140000 },
  { first: 'Pooja', last: 'Rao', email: 'pooja.rao@truprm.com', role: Role.EMPLOYEE, title: 'UX Designer', dept: 'Design', wage: 110000 },
  { first: 'Manish', last: 'Verma', email: 'manish.verma@truprm.com', role: Role.EMPLOYEE, title: 'Backend Developer', dept: 'Engineering', wage: 135000 },
  { first: 'Ritu', last: 'Chauhan', email: 'ritu.chauhan@truprm.com', role: Role.EMPLOYEE, title: 'Business Analyst', dept: 'Product', wage: 105000 },
  { first: 'Suresh', last: 'Iyer', email: 'suresh.iyer@truprm.com', role: Role.EMPLOYEE, title: 'Data Scientist', dept: 'Data', wage: 165000 },
  { first: 'Kavita', last: 'Menon', email: 'kavita.menon@truprm.com', role: Role.EMPLOYEE, title: 'Marketing Specialist', dept: 'Marketing', wage: 85000 },
  { first: 'Ajay', last: 'Bansal', email: 'ajay.bansal@truprm.com', role: Role.EMPLOYEE, title: 'Sales Executive', dept: 'Sales', wage: 80000 },
  { first: 'Swati', last: 'Deshmukh', email: 'swati.deshmukh@truprm.com', role: Role.EMPLOYEE, title: 'Customer Support', dept: 'Support', wage: 60000 },
  { first: 'Rajesh', last: 'Pillai', email: 'rajesh.pillai@truprm.com', role: Role.EMPLOYEE, title: 'Accountant', dept: 'Finance', wage: 95000 },
  { first: 'Divya', last: 'Tiwari', email: 'divya.tiwari@truprm.com', role: Role.EMPLOYEE, title: 'Content Writer', dept: 'Marketing', wage: 75000 },
  { first: 'Sandeep', last: 'Bose', email: 'sandeep.bose@truprm.com', role: Role.EMPLOYEE, title: 'Mobile Developer', dept: 'Engineering', wage: 125000 },
  { first: 'Nidhi', last: 'Agarwal', email: 'nidhi.agarwal@truprm.com', role: Role.EMPLOYEE, title: 'HR Generalist', dept: 'HR', wage: 85000 },
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const structure = await prisma.salaryStructure.findUnique({
    where: { code: 'SE-MONTHLY' },
  });
  if (!structure) throw new Error('Salary structure SE-MONTHLY not found. Run standard seed first.');

  let empCount = 3;
  for (const p of profiles) {
    let user = await prisma.user.findUnique({ where: { email: p.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: p.email,
          passwordHash,
          role: p.role,
        },
      });
    }

    let emp = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (!emp) {
      const empNum = "EMP" + empCount.toString().padStart(3, "0");
      emp = await prisma.employee.create({
        data: {
          userId: user.id,
          employeeNumber: empNum,
          firstName: p.first,
          lastName: p.last,
          hireDate: new Date('2025-03-01'),
          jobTitle: p.title,
          department: p.dept,
        },
      });

      await prisma.contract.create({
        data: {
          employeeId: emp.id,
          contractType: ContractType.FULL_TIME,
          status: ContractStatus.ACTIVE,
          startDate: new Date('2025-03-01'),
          wageCurrency: 'INR',
          wageAmount: p.wage,
          salaryStructureId: structure.id,
        },
      });
      console.log("✓ Added " + p.first + " " + p.last + " (" + user.email + ") as " + p.role);
    }
    empCount++;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
