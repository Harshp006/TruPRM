import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const emp = await prisma.employee.findFirst({ where: { firstName: 'Arjun', lastName: 'Sharma' } });
  const payslip = await prisma.payslip.findFirst({
    where: { employeeId: emp!.id, state: 'PAID' },
    include: { lines: true },
  });
  console.log('Arjun Sharma (80k basic):');
  console.log('  basicWage:', payslip?.basicWage, '| grossWage:', payslip?.grossWage, '| netWage:', payslip?.netWage);
  payslip?.lines.forEach(l => console.log(`    ${l.code}: ${l.amount} (${l.category})`));

  const vjEmp = await prisma.employee.findFirst({ where: { firstName: 'Vikrant', lastName: 'Jain' } });
  const vjSlip = await prisma.payslip.findFirst({ where: { employeeId: vjEmp!.id, state: 'PAID' }, include: { lines: true } });
  console.log('\nVikrant Jain (82k basic):');
  console.log('  basicWage:', vjSlip?.basicWage, '| grossWage:', vjSlip?.grossWage, '| netWage:', vjSlip?.netWage);
  vjSlip?.lines.forEach(l => console.log(`    ${l.code}: ${l.amount} (${l.category})`));
  
  const roles = await prisma.user.groupBy({ by: ['role'], _count: true });
  console.log('\nRole distribution:', roles.map(r => `${r.role}=${r._count}`).join(', '));
}
main().catch(console.error).finally(() => prisma.$disconnect());
