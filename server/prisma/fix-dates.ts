import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addOneDay() {
  const ONE_DAY = 24 * 60 * 60 * 1000;

  console.log("Fixing Attendance dates...");
  const attendances = await prisma.attendance.findMany();
  for (const a of attendances) {
    await prisma.attendance.update({
      where: { id: a.id },
      data: { date: new Date(a.date.getTime() + ONE_DAY) }
    });
  }

  console.log("Fixing Payrun dates...");
  const payruns = await prisma.payrun.findMany();
  for (const p of payruns) {
    await prisma.payrun.update({
      where: { id: p.id },
      data: {
        periodStart: new Date(p.periodStart.getTime() + ONE_DAY),
        periodEnd: new Date(p.periodEnd.getTime() + ONE_DAY)
      }
    });
  }

  console.log("Fixing Payslip dates...");
  const payslips = await prisma.payslip.findMany();
  for (const p of payslips) {
    await prisma.payslip.update({
      where: { id: p.id },
      data: {
        periodStart: new Date(p.periodStart.getTime() + ONE_DAY),
        periodEnd: new Date(p.periodEnd.getTime() + ONE_DAY)
      }
    });
  }

  console.log("Fixing TimeOffRequest dates...");
  const requests = await prisma.timeOffRequest.findMany();
  for (const r of requests) {
    await prisma.timeOffRequest.update({
      where: { id: r.id },
      data: {
        startDate: new Date(r.startDate.getTime() + ONE_DAY),
        endDate: new Date(r.endDate.getTime() + ONE_DAY)
      }
    });
  }

  console.log("Fixing TimeOffAllocation dates...");
  const allocations = await prisma.timeOffAllocation.findMany();
  for (const a of allocations) {
    if (a.validityFrom && a.validityTo) {
      await prisma.timeOffAllocation.update({
        where: { id: a.id },
        data: {
          validityFrom: new Date(a.validityFrom.getTime() + ONE_DAY),
          validityTo: new Date(a.validityTo.getTime() + ONE_DAY)
        }
      });
    }
  }

  console.log("Done!");
}

addOneDay().catch(console.error).finally(() => prisma.$disconnect());
