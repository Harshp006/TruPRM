import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const payruns = await prisma.payrun.findMany();
  console.log("Payruns:");
  payruns.forEach(p => console.log(p.name, p.periodStart, p.periodEnd));

  const requests = await prisma.timeOffRequest.findMany();
  console.log("\nTimeOffRequests:");
  requests.forEach(r => console.log(r.reason?.substring(0, 20), r.startDate, r.endDate));
}

check().catch(console.error).finally(() => prisma.$disconnect());
