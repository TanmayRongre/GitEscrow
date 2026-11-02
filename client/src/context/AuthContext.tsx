import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiRequest, ApiError } from '../api/client';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  avatarUrl?: string;
  paypalEmail?: string;
  lastLoginAt?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Check existing session on application boot
  const refreshUser = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ user: User }>('/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setUser(res.user);
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Login failed. Please check your network.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, username: string, email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, username, email, password })
      });
      setUser(res.user);
    } catch (err: any) {
      let msg = err instanceof ApiError ? err.message : 'Registration failed.';
      if (err instanceof ApiError && err.details && err.details.length > 0) {
        msg = err.details.map((d) => d.message).join('. ');
      }
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (err: any) {
      console.warn('Logout API error:', err.message);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        clearError,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
