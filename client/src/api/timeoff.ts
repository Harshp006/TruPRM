import api from './axios';

export interface TimeOffType {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  unit: string;
  isPaid: boolean;
  requiresAllocation: boolean;
  maxDaysPerYear?: number | null;
  requiresApproval: boolean;
  allowEmployeeRequest?: boolean;
  isEarnedThroughWork?: boolean;
  allowPartialDays?: boolean;
  isSandwichLeave?: boolean;
  allocationMethod?: string;
  allocationAmount?: number | null;
  carryForwardDays?: number | null;
  expiryDays?: number | null;
  isActive?: boolean;
  _count?: { allocations: number; requests: number };
}

export interface TimeOffAllocation {
  id: string;
  employeeId: string;
  timeOffTypeId: string;
  year: number;
  daysAllocated: number;
  daysUsed: number;
  remaining: number;
  validityFrom?: string | null;
  validityTo?: string | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
  };
  timeOffType?: TimeOffType;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  timeOffTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: 'DRAFT' | 'CONFIRMED' | 'APPROVED' | 'VALIDATED' | 'REFUSED';
  reason?: string | null;
  refusalReason?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    color?: string;
  };
  timeOffType?: TimeOffType;
}

export interface LeaveBalanceItem {
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

export interface SingleEmployeeBalanceResponse {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    jobTitle?: string;
  };
  year: number;
  balances: LeaveBalanceItem[];
}

export interface MatrixBalanceResponse {
  year: number;
  matrix: Array<{
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNumber: string;
      department?: string;
      jobTitle?: string;
      color?: string;
    };
    balances: LeaveBalanceItem[];
  }>;
}

export interface CompOffCreditRecord {
  id: string;
  employeeId: string;
  attendanceId?: string | null;
  dateEarned: string;
  daysEarned: number;
  hoursWorked?: number | null;
  reason?: string | null;
  status: string;
  expiryDate?: string | null;
  usedDays: number;
  remainingDays: number;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
  };
  attendance?: {
    id: string;
    date: string;
    checkIn?: string | null;
    checkOut?: string | null;
    overtimeHours?: number | null;
  };
}

export interface TimeOffLedgerRecord {
  id: string;
  employeeId: string;
  timeOffTypeId: string;
  type: string;
  amount: number;
  balanceAfter?: number | null;
  referenceId?: string | null;
  description: string;
  createdById?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  };
  timeOffType?: {
    id: string;
    name: string;
    code: string;
  };
}

// APIs
export const fetchTimeOffTypes = () =>
  api.get<TimeOffType[]>('/api/timeoff/types').then((r) => r.data);

export const createTimeOffType = (data: Partial<TimeOffType>) =>
  api.post<TimeOffType>('/api/timeoff/types', data).then((r) => r.data);

export const updateTimeOffType = (id: string, data: Partial<TimeOffType>) =>
  api.put<TimeOffType>(`/api/timeoff/types/${id}`, data).then((r) => r.data);

export const fetchTimeOffAllocations = (params?: { employeeId?: string; year?: number }) =>
  api.get<TimeOffAllocation[]>('/api/timeoff/allocations', { params }).then((r) => r.data);

export const createTimeOffAllocation = (data: {
  employeeId: string;
  timeOffTypeId: string;
  year: number;
  daysAllocated: number;
  validityFrom?: string;
  validityTo?: string;
}) => api.post<TimeOffAllocation>('/api/timeoff/allocations', data).then((r) => r.data);

export const fetchLeaveBalances = (params?: { employeeId?: string; year?: number }) =>
  api.get<SingleEmployeeBalanceResponse | MatrixBalanceResponse>('/api/timeoff/balances', { params }).then((r) => r.data);

export const fetchTimeOffRequests = (params?: { employeeId?: string; status?: string; search?: string }) =>
  api.get<TimeOffRequest[]>('/api/timeoff/requests', { params }).then((r) => r.data);

export const createTimeOffRequest = (data: {
  employeeId?: string;
  timeOffTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested?: number;
  reason?: string;
}) => api.post<TimeOffRequest>('/api/timeoff/requests', data).then((r) => r.data);

export const approveTimeOffRequest = (id: string) =>
  api.post<{ message: string; request: TimeOffRequest }>(`/api/timeoff/requests/${id}/approve`).then((r) => r.data);

export const refuseTimeOffRequest = (id: string, refusalReason?: string) =>
  api.post<{ message: string; request: TimeOffRequest }>(`/api/timeoff/requests/${id}/refuse`, { refusalReason }).then((r) => r.data);

export const fetchCompOffCredits = (params?: { employeeId?: string }) =>
  api.get<CompOffCreditRecord[]>('/api/timeoff/compoff', { params }).then((r) => r.data);

export const creditCompOff = (data: {
  employeeId: string;
  dateEarned: string;
  daysEarned: number;
  hoursWorked?: number;
  reason?: string;
  expiryDays?: number;
}) => api.post<CompOffCreditRecord>('/api/timeoff/compoff/credit', data).then((r) => r.data);

export const fetchTimeOffLedger = (params?: { employeeId?: string; timeOffTypeId?: string }) =>
  api.get<TimeOffLedgerRecord[]>('/api/timeoff/ledger', { params }).then((r) => r.data);

export const fetchTimeOffTypeDetail = (id: string) =>
  api.get<TimeOffType>(`/api/timeoff/types/${id}`).then((r) => r.data);

export const fetchTimeOffAllocationDetail = (id: string) =>
  api.get<TimeOffAllocation>(`/api/timeoff/allocations/${id}`).then((r) => r.data);

export const fetchTimeOffRequestDetail = (id: string) =>
  api.get<TimeOffRequest>(`/api/timeoff/requests/${id}`).then((r) => r.data);
