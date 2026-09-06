import { PrismaClient, Role, ContractType, ContractStatus, TimeOffStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const firstNames = ['Amit', 'Priya', 'Sneha', 'Ravi', 'Arjun', 'Neha', 'Vikas', 'Anjali', 'Karthik', 'Pooja', 'Manish', 'Ritu', 'Suresh', 'Kavita', 'Ajay', 'Swati', 'Rajesh', 'Divya', 'Sandeep', 'Nidhi', 'Rohan', 'Meera', 'Kiran', 'Anita', 'Tarun', 'Deepa', 'Gaurav', 'Sunita', 'Rahul', 'Jyoti'];
const lastNames = ['Patel', 'Singh', 'Reddy', 'Kumar', 'Das', 'Gupta', 'Joshi', 'Mehta', 'Nair', 'Rao', 'Verma', 'Chauhan', 'Iyer', 'Menon', 'Bansal', 'Deshmukh', 'Pillai', 'Tiwari', 'Bose', 'Agarwal', 'Sharma', 'Yadav', 'Mishra', 'Pandey', 'Saxena', 'Kapoor', 'Malhotra', 'Jain', 'Bhat', 'Dutta'];
const depts = ['IT', 'HR', 'Engineering', 'Product', 'Design', 'Data', 'Marketing', 'Sales', 'Support', 'Finance'];
const roles = [Role.EMPLOYEE, Role.HR_MANAGER, Role.HR_PAYROLL_ADMIN, Role.HR_PAYROLL_USER, Role.ADMIN];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const structure = await prisma.salaryStructure.findUnique({
    where: { code: 'SE-MONTHLY' },
  });
  if (!structure) throw new Error('Salary structure SE-MONTHLY not found. Run standard seed first.');

  let vacationType = await prisma.timeOffType.findFirst({ where: { code: 'VAC' } });
  if (!vacationType) {
    vacationType = await prisma.timeOffType.create({
      data: { name: 'Vacation', code: 'VAC', unit: 'DAYS' }
    });
  }

  let empCount = 100;
  
  for (let i = 0; i < 70; i++) {
    const first = getRandomElement(firstNames);
    const last = getRandomElement(lastNames);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@truprm.com`;
    const role = getRandomElement(roles);
    const dept = getRandomElement(depts);
    const wage = getRandomInt(60000, 200000);

    // Create User
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    });

    // Create Employee
    const empNum = "EMP" + empCount.toString().padStart(3, "0");
    const emp = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeNumber: empNum,
        firstName: first,
        lastName: last,
        hireDate: new Date('2024-01-01'),
        jobTitle: `${dept} Specialist`,
        department: dept,
      },
    });

    // Create Contract
    await prisma.contract.create({
      data: {
        employeeId: emp.id,
        contractType: ContractType.FULL_TIME,
        status: ContractStatus.ACTIVE,
        startDate: new Date('2024-01-01'),
        wageCurrency: 'INR',
        wageAmount: wage,
        salaryStructureId: structure.id,
      },
    });

    // Allocate some Time Off
    const allocation = await prisma.timeOffAllocation.create({
      data: {
        employeeId: emp.id,
        timeOffTypeId: vacationType.id,
        year: 2025,
        daysAllocated: 20,
        daysUsed: 5,
        remaining: 15,
        validityFrom: new Date('2025-01-01'),
        validityTo: new Date('2025-12-31'),
      }
    });

    // Create some Time Off Requests
    const hasRequest = Math.random() > 0.5;
    if (hasRequest) {
      const statuses = [TimeOffStatus.APPROVED, TimeOffStatus.REFUSED, TimeOffStatus.DRAFT, TimeOffStatus.CONFIRMED];
      const reqStatus = getRandomElement(statuses);
      const reqStart = new Date();
      reqStart.setDate(reqStart.getDate() + getRandomInt(1, 30));
      const reqEnd = new Date(reqStart);
      reqEnd.setDate(reqEnd.getDate() + getRandomInt(1, 5));

      await prisma.timeOffRequest.create({
        data: {
          employeeId: emp.id,
          timeOffTypeId: vacationType.id,
          startDate: reqStart,
          endDate: reqEnd,
          daysRequested: getRandomInt(1, 5),
          status: reqStatus as TimeOffStatus,
          reason: 'Taking some time off',
        }
      });

      // Create a Notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Time Off Request',
          message: `Your time off request is currently ${reqStatus}.`,
        }
      });
    }

    console.log(`✓ Added ${first} ${last} (${email}) as ${role}`);
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
