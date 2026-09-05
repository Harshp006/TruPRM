import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { setToken } from '../api/axios';

export type Role =
  | 'EMPLOYEE'
  | 'HR_MANAGER'
  | 'HR_PAYROLL_USER'
  | 'HR_PAYROLL_ADMIN'
  | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);

  const logout = useCallback(() => {
    setUser(null);
    setTokenState(null);
    setToken(null);
  }, []);

  // Listen for auto-logout triggered by 401 interceptor
  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message ?? 'Login failed');
    }

    const data: { token: string; user: AuthUser } = await res.json();
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, refreshUser, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
