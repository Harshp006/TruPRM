import api from './axios';

export interface Payrun {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  state: 'DRAFT' | 'DONE' | 'CANCELLED';
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
  employeeCount: number;
  totalBasic?: number;
  totalGross?: number;
  totalDeductions?: number;
  totalNet: number;
  warnings?: PayrollWarning[];
  payslips?: PayslipSummary[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollWarning {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  employeeId?: string;
  employeeName?: string;
}

export interface PayslipSummary {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    jobTitle?: string;
    color?: string;
  };
  salaryStructure: string;
  salaryStructureId?: string;
  workedDays: number;
  basicWage: number;
  grossWage: number;
  netWage: number;
  linesCount: number;
  warnings: PayrollWarning[];
}

export interface PayslipLine {
  id: string;
  payslipId: string;
  name: string;
  code: string;
  category: 'BASIC' | 'ALLOWANCE' | 'DEDUCTION' | 'GROSS' | 'NET';
  quantity: number;
  rate: number | string;
  amount: number | string;
}

export interface PayslipDetail {
  id: string;
  payrunId: string;
  payrunName: string;
  periodStart: string;
  periodEnd: string;
  workedDays: number;
  basicWage: number;
  grossWage: number;
  totalDeductions: number;
  netWage: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department?: string;
    jobTitle?: string;
    hireDate?: string;
    contract?: any;
  };
  salaryStructure: string;
  lines: PayslipLine[];
  allowances: PayslipLine[];
  deductions: PayslipLine[];
  createdAt: string;
}

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  description?: string;
  rules?: SalaryRule[];
  _count?: { contracts: number; rules: number };
}

export interface SalaryRule {
  id: string;
  salaryStructureId: string;
  name: string;
  code: string;
  category: 'BASIC' | 'ALLOWANCE' | 'DEDUCTION' | 'GROSS' | 'NET';
  sequence: number;
  amountFixed?: string | number | null;
  amountPercentage?: string | number | null;
  baseCode?: string | null;
  appears_on_payslip: boolean;
  salaryStructure?: { id: string; name: string; code: string };
}

export interface PreviewEmployee {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  color?: string;
  contract: {
    id: string;
    wageAmount: string | number;
    wageCurrency: string;
    salaryStructure: string;
    salaryStructureId?: string;
    workingSchedule: string;
  } | null;
  hasActiveContract: boolean;
  warnings: PayrollWarning[];
  isEligible: boolean;
}

export interface PreviewResult {
  periodStart: string;
  periodEnd: string;
  salaryStructureId: string | null;
  employees: PreviewEmployee[];
}

export interface DashboardStats {
  totalEmployees: number;
  activeContractsCount: number;
  pendingTimeOffCount: number;
  totalNetPaid: number;
  attendanceRate: number;
  departmentBreakdown: Record<string, number>;
  recentPayruns: Array<{
    id: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    employeeCount: number;
    totalNet: number;
  }>;
  recentAttendances: any[];
}

// Payruns APIs
export const fetchPayruns = () => api.get<Payrun[]>('/api/payruns').then((r) => r.data);
export const fetchPayrun = (id: string) => api.get<Payrun>(`/api/payruns/${id}`).then((r) => r.data);
export const previewPayrunEmployees = (data: {
  salaryStructureId?: string;
  periodStart: string;
  periodEnd: string;
  department?: string;
}) => api.post<PreviewResult>('/api/payruns/preview-employees', data).then((r) => r.data);

export const createPayrun = (data: {
  name: string;
  salaryStructureId?: string;
  periodStart: string;
  periodEnd: string;
  employeeIds: string[];
  notes?: string;
}) => api.post<Payrun>('/api/payruns', data).then((r) => r.data);

export const computePayrun = (id: string) => api.post(`/api/payruns/${id}/compute`).then((r) => r.data);
export const validatePayrun = (id: string) => api.post(`/api/payruns/${id}/validate`).then((r) => r.data);
export const markPayrunPaid = (id: string) => api.post(`/api/payruns/${id}/mark-paid`).then((r) => r.data);
export const sendPayslips = (id: string) => api.post(`/api/payruns/${id}/send-payslips`).then((r) => r.data);

// Payslips APIs
export const fetchPayslips = (params?: { payrunId?: string; employeeId?: string }) =>
  api.get<any[]>('/api/payslips', { params }).then((r) => r.data);
export const fetchPayslip = (id: string) => api.get<PayslipDetail>(`/api/payslips/${id}`).then((r) => r.data);
export const getPayslipPdfUrl = (id: string) => `${api.defaults.baseURL}/api/payslips/${id}/pdf`;

// Salary Structures APIs
export const fetchSalaryStructures = () => api.get<SalaryStructure[]>('/api/salary-structures').then((r) => r.data);
export const fetchSalaryStructure = (id: string) => api.get<SalaryStructure>(`/api/salary-structures/${id}`).then((r) => r.data);
export const createSalaryStructure = (data: Partial<SalaryStructure>) => api.post<SalaryStructure>('/api/salary-structures', data).then((r) => r.data);
export const updateSalaryStructure = (id: string, data: Partial<SalaryStructure>) => api.put<SalaryStructure>(`/api/salary-structures/${id}`, data).then((r) => r.data);
export const deleteSalaryStructure = (id: string) => api.delete(`/api/salary-structures/${id}`).then((r) => r.data);

// Salary Rules APIs
export const fetchSalaryRules = (salaryStructureId?: string) =>
  api.get<SalaryRule[]>('/api/salary-rules', { params: { salaryStructureId } }).then((r) => r.data);
export const fetchSalaryRule = (id: string) => api.get<SalaryRule>(`/api/salary-rules/${id}`).then((r) => r.data);
export const createSalaryRule = (data: Partial<SalaryRule>) => api.post<SalaryRule>('/api/salary-rules', data).then((r) => r.data);
export const updateSalaryRule = (id: string, data: Partial<SalaryRule>) => api.put<SalaryRule>(`/api/salary-rules/${id}`, data).then((r) => r.data);
export const deleteSalaryRule = (id: string) => api.delete(`/api/salary-rules/${id}`).then((r) => r.data);

// Dashboard API
export const fetchDashboardStats = () => api.get<DashboardStats>('/api/dashboard/stats').then((r) => r.data);
