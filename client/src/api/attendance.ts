import api from './axios';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workedHours?: number | null;
  overtimeHours?: number | null;
  status: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    jobTitle?: string;
    color?: string;
    manager?: {
      id: string;
      firstName: string;
      lastName: string;
    };
    contracts?: Array<{
      id: string;
      workingSchedule?: {
        name?: string;
        hoursPerWeek?: number;
      };
    }>;
  };
}

export interface AttendanceStatusResponse {
  isCheckedIn: boolean;
  activeAttendance: AttendanceRecord | null;
  todayWorkedHours?: number;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    jobTitle?: string;
    color?: string;
  } | null;
}

export const fetchAttendanceStatus = () =>
  api.get<AttendanceStatusResponse>('/api/attendance/status').then((r) => r.data);

export const checkIn = () =>
  api.post<{ message: string; isCheckedIn: boolean; attendance: AttendanceRecord }>('/api/attendance/check-in').then((r) => r.data);

export const checkOut = () =>
  api.post<{ message: string; isCheckedIn: boolean; attendance: AttendanceRecord }>('/api/attendance/check-out').then((r) => r.data);

export const toggleAttendance = () =>
  api.post<{ message: string; isCheckedIn: boolean; attendance: AttendanceRecord }>('/api/attendance/toggle').then((r) => r.data);

export const checkInAttendance = checkIn;
export const checkOutAttendance = checkOut;

export const fetchAttendances = (params?: {
  employeeId?: string;
  search?: string;
  status?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
}) => api.get<AttendanceRecord[]>('/api/attendance', { params }).then((r) => r.data);

export const fetchAttendanceDetail = (id: string) =>
  api.get<AttendanceRecord>(`/api/attendance/${id}`).then((r) => r.data);

export const createAttendance = (data: {
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string;
  notes?: string | null;
  overtimeHours?: number;
}) => api.post<AttendanceRecord>('/api/attendance', data).then((r) => r.data);

export const updateAttendance = (
  id: string,
  data: {
    checkIn?: string | null;
    checkOut?: string | null;
    status?: string;
    notes?: string | null;
    overtimeHours?: number;
  }
) => api.put<AttendanceRecord>(`/api/attendance/${id}`, data).then((r) => r.data);

export const deleteAttendance = (id: string) =>
  api.delete(`/api/attendance/${id}`).then((r) => r.data);
