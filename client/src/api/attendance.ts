import api from './axios';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    color?: string;
  };
}

export const fetchAttendances = (params?: {
  employeeId?: string;
  status?: string;
  date?: string;
  from?: string;
  to?: string;
}) => api.get<AttendanceRecord[]>('/api/attendance', { params }).then((r) => r.data);

export const createAttendance = (data: {
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string;
  notes?: string | null;
}) => api.post<AttendanceRecord>('/api/attendance', data).then((r) => r.data);

export const updateAttendance = (
  id: string,
  data: {
    checkIn?: string | null;
    checkOut?: string | null;
    status?: string;
    notes?: string | null;
  }
) => api.put<AttendanceRecord>(`/api/attendance/${id}`, data).then((r) => r.data);

export const deleteAttendance = (id: string) =>
  api.delete(`/api/attendance/${id}`).then((r) => r.data);
