import { prisma } from '../lib/prisma';

export interface LeaveBalanceSummary {
  timeOffTypeId: string;
  name: string;
  code: string;
  unit: string;
  isPaid: boolean;
  requiresAllocation: boolean;
  isEarnedThroughWork: boolean;
  isSandwichLeave: boolean;
  allocated: number;
  taken: number;
  pending: number;
  remaining: number;
}

/**
 * Calculates complete leave balances for an employee in a given year.
 */
export async function calculateEmployeeLeaveBalances(
  employeeId: string,
  year: number = new Date().getFullYear()
): Promise<LeaveBalanceSummary[]> {
  const types = await prisma.timeOffType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const allocations = await prisma.timeOffAllocation.findMany({
    where: { employeeId, year },
  });

  const requests = await prisma.timeOffRequest.findMany({
    where: { employeeId },
  });

  const compOffCredits = await prisma.compOffCredit.findMany({
    where: {
      employeeId,
      status: 'APPROVED',
      OR: [
        { expiryDate: null },
        { expiryDate: { gte: new Date() } },
      ],
    },
  });

  const summaries: LeaveBalanceSummary[] = [];

  for (const type of types) {
    let allocated = 0;

    if (type.isEarnedThroughWork || type.code === 'COMP_OFF') {
      // For Comp-Off, allocated days come from earned comp-off credits
      allocated = compOffCredits.reduce((sum, c) => sum + c.daysEarned, 0);
    } else if (type.requiresAllocation) {
      const allocRecord = allocations.find((a) => a.timeOffTypeId === type.id);
      allocated = allocRecord ? allocRecord.daysAllocated : type.allocationAmount || 0;
    } else {
      allocated = type.maxDaysPerYear || 365;
    }

    // Filter requests for this specific leave type
    const typeRequests = requests.filter((r) => r.timeOffTypeId === type.id);

    const taken = typeRequests
      .filter((r) => r.status === 'APPROVED' || r.status === 'VALIDATED')
      .reduce((sum, r) => sum + r.daysRequested, 0);

    const pending = typeRequests
      .filter((r) => r.status === 'DRAFT' || r.status === 'CONFIRMED')
      .reduce((sum, r) => sum + r.daysRequested, 0);

    const remaining = Math.max(0, allocated - taken);

    summaries.push({
      timeOffTypeId: type.id,
      name: type.name,
      code: type.code,
      unit: type.unit,
      isPaid: type.isPaid,
      requiresAllocation: type.requiresAllocation,
      isEarnedThroughWork: type.isEarnedThroughWork,
      isSandwichLeave: type.isSandwichLeave,
      allocated,
      taken,
      pending,
      remaining,
    });
  }

  return summaries;
}

/**
 * Calculates total leave days for a request, applying Sandwich Leave rules if applicable.
 * Sandwich Leave Rule: If a leave spans or borders a weekend/holiday, weekend days are included in the total.
 */
export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  isSandwichLeave: boolean = false
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) return 0;

  let totalDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isSandwichLeave) {
      // Sandwich rule: All days (including weekends) count towards leave
      totalDays += 1;
    } else {
      // Standard rule: Exclude weekends
      if (!isWeekend) {
        totalDays += 1;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return totalDays === 0 ? 1 : totalDays;
}

/**
 * Adds an audit ledger entry for balance traceability.
 */
export async function logTimeOffLedger(
  employeeId: string,
  timeOffTypeId: string,
  type: 'ALLOCATION' | 'LEAVE_TAKEN' | 'LEAVE_RESTORED' | 'COMP_OFF_EARNED' | 'COMP_OFF_USED' | 'ADJUSTMENT' | 'EXPIRED',
  amount: number,
  referenceId: string | null,
  description: string,
  createdById: string | null,
  tx?: any
) {
  const client = tx || prisma;

  // Compute balance after transaction
  const previousLedgers = await client.timeOffLedger.findMany({
    where: { employeeId, timeOffTypeId },
  });
  const currentBalance = previousLedgers.reduce((acc: number, l: any) => acc + l.amount, 0);
  const balanceAfter = currentBalance + amount;

  return await client.timeOffLedger.create({
    data: {
      employeeId,
      timeOffTypeId,
      type,
      amount,
      balanceAfter,
      referenceId,
      description,
      createdById,
    },
  });
}
