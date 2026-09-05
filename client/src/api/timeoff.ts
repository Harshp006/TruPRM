import api from './axios';

export interface TimeOffType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  maxDaysPerYear?: number | null;
  requiresApproval: boolean;
  _count?: { allocations: number; requests: number };
}

export interface TimeOffAllocation {
  id: string;
  employeeId: string;
  timeOffTypeId: string;
  year: number;
  daysAllocated: number;
  daysUsed: number;
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
  status: 'DRAFT' | 'CONFIRMED' | 'VALIDATED' | 'REFUSED';
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

export const fetchTimeOffTypes = () =>
  api.get<TimeOffType[]>('/api/time-off/types').then((r) => r.data);

export const fetchTimeOffAllocations = (params?: { employeeId?: string; year?: number }) =>
  api.get<TimeOffAllocation[]>('/api/time-off/allocations', { params }).then((r) => r.data);

export const fetchTimeOffRequests = (params?: { employeeId?: string; status?: string }) =>
  api.get<TimeOffRequest[]>('/api/time-off/requests', { params }).then((r) => r.data);

export const createTimeOffRequest = (data: {
  employeeId: string;
  timeOffTypeId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason?: string;
}) => api.post<TimeOffRequest>('/api/time-off/requests', data).then((r) => r.data);

export const approveTimeOffRequest = (id: string) =>
  api.patch<TimeOffRequest>(`/api/time-off/requests/${id}/approve`).then((r) => r.data);

export const refuseTimeOffRequest = (id: string, refusalReason?: string) =>
  api.patch<TimeOffRequest>(`/api/time-off/requests/${id}/refuse`, { refusalReason }).then((r) => r.data);
