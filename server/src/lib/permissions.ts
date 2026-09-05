import { Role } from '@prisma/client';

// Permission map: role -> Set of "resource:action" strings
// Roles are hardcoded — no roles table or role-editing UI.
export const PERMISSIONS: Record<Role, Set<string>> = {
  ADMIN: new Set([
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'employee:read',
    'employee:create',
    'employee:update',
    'employee:delete',
    'contract:read',
    'contract:create',
    'contract:update',
    'contract:delete',
    'attendance:read',
    'attendance:create',
    'attendance:update',
    'attendance:delete',
    'timeoff:read',
    'timeoff:create',
    'timeoff:update',
    'timeoff:delete',
    'timeoff:approve',
    'payroll:read',
    'payroll:create',
    'payroll:update',
    'payroll:delete',
    'payroll:confirm',
    'salary_structure:read',
    'salary_structure:create',
    'salary_structure:update',
    'salary_structure:delete',
  ]),

  HR_PAYROLL_ADMIN: new Set([
    'employee:read',
    'employee:create',
    'employee:update',
    'contract:read',
    'contract:create',
    'contract:update',
    'attendance:read',
    'attendance:create',
    'attendance:update',
    'timeoff:read',
    'timeoff:approve',
    'timeoff:update',
    'payroll:read',
    'payroll:create',
    'payroll:update',
    'payroll:confirm',
    'salary_structure:read',
    'salary_structure:create',
    'salary_structure:update',
  ]),

  HR_PAYROLL_USER: new Set([
    'employee:read',
    'contract:read',
    'attendance:read',
    'attendance:create',
    'attendance:update',
    'timeoff:read',
    'payroll:read',
    'salary_structure:read',
  ]),

  HR_MANAGER: new Set([
    'employee:read',
    'employee:create',
    'employee:update',
    'contract:read',
    'contract:create',
    'contract:update',
    'attendance:read',
    'timeoff:read',
    'timeoff:approve',
    'timeoff:update',
  ]),

  EMPLOYEE: new Set([
    'attendance:read',
    'timeoff:read',
    'timeoff:create',
  ]),
};

export function hasPermission(role: Role, permission: string): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false;
}
