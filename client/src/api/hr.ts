import api from './axios';

export interface Employee {
  id: string;
  userId?: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  color?: string;
  dateOfBirth?: string;
  hireDate: string;
  jobTitle: string;
  department?: string;
  managerId?: string;
  createdAt: string;
  updatedAt: string;
  manager?: { id: string; firstName: string; lastName: string } | null;
  contracts?: Contract[];
  _count?: { contracts: number; attendances: number; timeOffRequests: number };
  user?: { email: string; role: string };
}

export interface Contract {
  id: string;
  employeeId: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate?: string;
  wageCurrency: string;
  wageAmount: string;
  workingScheduleId?: string;
  salaryStructureId?: string;
  notes?: string;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string };
  workingSchedule?: { id: string; name: string };
}

export interface WorkingSchedule {
  id: string;
  name: string;
  hoursPerWeek: number;
  flexibleHours: boolean;
  createdAt: string;
  scheduleLines?: ScheduleLine[];
  _count?: { scheduleLines: number; contracts: number };
}

export interface ScheduleLine {
  id?: string;
  dayOfWeek: string;
  timeFrom: string;
  timeTo: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  workedHours?: number;
  status: string;
  notes?: string;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string; color?: string };
}

export interface TimeOffType {
  id: string;
  name: string;
  code: string;
  unit: string;
  isPaid: boolean;
  requiresAllocation: boolean;
  maxDaysPerYear?: number;
  requiresApproval: boolean;
}

export interface TimeOffAllocation {
  id: string;
  employeeId: string;
  timeOffTypeId: string;
  year: number;
  daysAllocated: number;
  daysUsed: number;
  remaining: number;
  validityFrom?: string;
  validityTo?: string;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string };
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
  reason?: string;
  refusalReason?: string;
  approvedById?: string;
  approvedAt?: string;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string; color?: string };
  timeOffType?: TimeOffType;
}

export const fetchEmployees = () => api.get<Employee[]>('/api/employees').then(r => r.data);
export const fetchEmployee = (id: string) => api.get<Employee>(`/api/employees/${id}`).then(r => r.data);
export const createEmployee = (data: Partial<Employee>) => api.post<Employee>('/api/employees', data).then(r => r.data);
export const updateEmployee = (id: string, data: Partial<Employee>) => api.put<Employee>(`/api/employees/${id}`, data).then(r => r.data);

export const fetchMyProfile = () => api.get<Employee>('/api/employees/me').then(r => r.data);
export const updateMyProfile = (data: Partial<Employee>) => api.put<Employee>('/api/employees/me', data).then(r => r.data);

export const fetchSchedules = () => api.get<WorkingSchedule[]>('/api/working-schedules').then(r => r.data);
export const fetchSchedule = (id: string) => api.get<WorkingSchedule>(`/api/working-schedules/${id}`).then(r => r.data);
export const createSchedule = (data: { name: string; flexibleHours?: boolean; scheduleLines: ScheduleLine[] }) =>
  api.post<WorkingSchedule>('/api/working-schedules', data).then(r => r.data);
export const updateSchedule = (id: string, data: { name?: string; flexibleHours?: boolean; scheduleLines?: ScheduleLine[] }) =>
  api.put<WorkingSchedule>(`/api/working-schedules/${id}`, data).then(r => r.data);

export const fetchContracts = () => api.get<Contract[]>('/api/contracts').then(r => r.data);
export const fetchContract = (id: string) => api.get<Contract>(`/api/contracts/${id}`).then(r => r.data);
export const createContract = (data: Partial<Contract>) => api.post<Contract>('/api/contracts', data).then(r => r.data);
export const updateContract = (id: string, data: Partial<Contract>) => api.put<Contract>(`/api/contracts/${id}`, data).then(r => r.data);

// Attendance APIs
export const fetchAttendanceStatus = () => api.get<{ isCheckedIn: boolean; activeAttendance: Attendance | null }>('/api/attendance/status').then(r => r.data);
export const toggleAttendance = () => api.post<{ message: string; isCheckedIn: boolean; attendance: Attendance }>('/api/attendance/toggle').then(r => r.data);
export const fetchAttendances = (params?: { employeeId?: string; search?: string }) => api.get<Attendance[]>('/api/attendance', { params }).then(r => r.data);
export const createAttendance = (data: Partial<Attendance>) => api.post<Attendance>('/api/attendance', data).then(r => r.data);
export const updateAttendance = (id: string, data: Partial<Attendance>) => api.put<Attendance>(`/api/attendance/${id}`, data).then(r => r.data);

// TimeOff APIs
export const fetchTimeOffTypes = () => api.get<TimeOffType[]>('/api/timeoff/types').then(r => r.data);
export const createTimeOffType = (data: Partial<TimeOffType>) => api.post<TimeOffType>('/api/timeoff/types', data).then(r => r.data);
export const fetchTimeOffAllocations = (params?: { employeeId?: string; year?: number }) => api.get<TimeOffAllocation[]>('/api/timeoff/allocations', { params }).then(r => r.data);
export const createTimeOffAllocation = (data: Partial<TimeOffAllocation>) => api.post<TimeOffAllocation>('/api/timeoff/allocations', data).then(r => r.data);
export const fetchTimeOffRequests = (params?: { employeeId?: string; status?: string; search?: string }) => api.get<TimeOffRequest[]>('/api/timeoff/requests', { params }).then(r => r.data);
export const createTimeOffRequest = (data: Partial<TimeOffRequest>) => api.post<TimeOffRequest>('/api/timeoff/requests', data).then(r => r.data);
export const approveTimeOffRequest = (id: string) => api.post<{ message: string; request: TimeOffRequest; allocation: TimeOffAllocation | null }>(`/api/timeoff/requests/${id}/approve`).then(r => r.data);
export const refuseTimeOffRequest = (id: string, refusalReason?: string) => api.post<{ message: string; request: TimeOffRequest }>(`/api/timeoff/requests/${id}/refuse`, { refusalReason }).then(r => r.data);

// ── Salary Structures & Rules ───────────────────────────────────────────────

export type SalaryRuleCategory =
  | 'EARNING'
  | 'DEDUCTION'
  | 'EMPLOYER_CONTRIBUTION'
  | 'BASIC'
  | 'ALLOWANCE'
  | 'GROSS'
  | 'NET';

export type RuleCalculationType = 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FORMULA';

export interface SalaryRule {
  id?: string;
  salaryStructureId?: string;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  calculationType: RuleCalculationType;
  fixedAmount?: number | string | null;
  amountFixed?: number | string | null;
  percentage?: number | string | null;
  amountPercentage?: number | string | null;
  baseCode?: string | null;
  formula?: string | null;
  condition?: string | null;
  conditionType?: string | null;
  conditionValue?: number | string | null;
  roundingRule?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  appears_on_payslip?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
  updatedAt: string;
  rules?: SalaryRule[];
  _count?: { contracts: number; payslips: number; rules: number };
}

export const fetchSalaryStructures = (params?: { status?: string; activeOnly?: boolean }) =>
  api.get<SalaryStructure[]>('/api/salary-structures', { params }).then(r => r.data);

export const fetchSalaryStructure = (id: string) =>
  api.get<SalaryStructure>(`/api/salary-structures/${id}`).then(r => r.data);

export const calculateSalaryStructure = (id: string, context?: Record<string, any>) =>
  api.post<any>(`/api/salary-structures/${id}/calculate`, context).then(r => r.data);

export const createSalaryStructure = (data: Partial<SalaryStructure>) =>
  api.post<SalaryStructure>('/api/salary-structures', data).then(r => r.data);

export const updateSalaryStructure = (id: string, data: Partial<SalaryStructure>) =>
  api.put<SalaryStructure>(`/api/salary-structures/${id}`, data).then(r => r.data);

export const deleteSalaryStructure = (id: string) =>
  api.delete(`/api/salary-structures/${id}`).then(r => r.data);

export const fetchSalaryRules = (params?: { structureId?: string }) =>
  api.get<SalaryRule[]>('/api/salary-rules', { params }).then(r => r.data);

export const createSalaryRule = (data: Partial<SalaryRule>) =>
  api.post<SalaryRule>('/api/salary-rules', data).then(r => r.data);

export const updateSalaryRule = (id: string, data: Partial<SalaryRule>) =>
  api.put<SalaryRule>(`/api/salary-rules/${id}`, data).then(r => r.data);

export const deleteSalaryRule = (id: string) =>
  api.delete(`/api/salary-rules/${id}`).then(r => r.data);

