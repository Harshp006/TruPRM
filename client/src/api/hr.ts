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

export const fetchEmployees = () => api.get<Employee[]>('/api/employees').then(r => r.data);
export const fetchEmployee = (id: string) => api.get<Employee>(`/api/employees/${id}`).then(r => r.data);
export const createEmployee = (data: Partial<Employee>) => api.post<Employee>('/api/employees', data).then(r => r.data);
export const updateEmployee = (id: string, data: Partial<Employee>) => api.put<Employee>(`/api/employees/${id}`, data).then(r => r.data);

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
