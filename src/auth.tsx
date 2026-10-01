import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setUnauthorizedHandler } from './api/client';

export interface AdminUser { id: number; name: string | null; email: string; role: string }

interface AuthState {
  admin: AdminUser | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [booting, setBooting] = useState(() => !!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    qc.clear();
  }, [qc]);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  useEffect(() => {
    if (!getToken()) return;
    api.get<{ user: AdminUser & { type: string } }>('/auth/session')
      .then(({ user }) => {
        if (user.type !== 'admin') logout();
        else setAdmin(user);
      })
      .catch(() => logout())
      .finally(() => setBooting(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.post<{ token: string; user: AdminUser }>('/auth/admin/login', { email, password });
    setToken(token);
    setAdmin(user);
  }, []);

  return <AuthContext.Provider value={{ admin, booting, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
