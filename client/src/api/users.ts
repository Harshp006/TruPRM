import api from './axios';

export interface User {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  createdAt: string;
  employee?: { id: string; firstName: string; lastName: string } | null;
}

export const fetchUsers = () => api.get<User[]>('/api/users').then(r => r.data);

export const createUser = (data: { email: string; role: string; employeeId?: string }) =>
  api.post<{ user: User; tempPassword: string }>('/api/users', data).then(r => r.data);

export const updateUser = (id: string, data: { role?: string; employeeId?: string | null }) =>
  api.put<User>(`/api/users/${id}`, data).then(r => r.data);

export const resetPassword = (id: string) =>
  api.post<{ message: string; tempPassword: string }>(`/api/users/${id}/reset-password`).then(r => r.data);
