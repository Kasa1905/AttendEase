import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { saveTokens, clearTokens, getAccessToken, getRefreshToken } from '../utils/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children, value }) {
  // In tests, allow overriding the context to avoid network calls and complex bootstrapping
  if (value) {
    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
  }
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = getAccessToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await api.get('/auth/profile');
        setUser(res.data.data || res.data || null);
      } catch (err) {
        clearTokens();
      } finally { setLoading(false); }
    }
    bootstrap();
    const handler = () => { clearTokens(); setUser(null); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = async (email, password, remember = true) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = res.data;
    saveTokens({ accessToken, refreshToken }, remember);
    setUser(userData);
    return userData;
  };

  const register = async (payload) => {
    const res = await api.post('/auth/register', payload);
    return res.data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (e) { /* ignore */ }
    clearTokens();
    setUser(null);
  };

  const hasRole = (r) => user && user.role === r;
  const isStudent = () => hasRole('student');
  const isCoreTeam = () => hasRole('core_team');
  const isTeacher = () => hasRole('teacher');

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole, isStudent, isCoreTeam, isTeacher }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
