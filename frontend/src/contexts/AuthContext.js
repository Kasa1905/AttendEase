import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { saveTokens, clearTokens, getAccessToken } from '../utils/auth';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAccessToken() || localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!token || !storedUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get('/auth/profile');
        const profile = res.data?.user || res.data?.data || res.data || null;
        setUser(profile);
        setIsAuthenticated(!!profile);
      } catch (err) {
        clearTokens();
        // Also clear legacy token key used in some tests
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
    const handler = () => { clearTokens(); setUser(null); setIsAuthenticated(false); };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const clearError = () => setError(null);

  const login = async (credentialsOrEmail, passwordArg, rememberArg = true) => {
    setError(null);
    setLoading(true);

    let identifier;
    let password;
    let remember = rememberArg;

    if (typeof credentialsOrEmail === 'object' && credentialsOrEmail !== null) {
      const { email, username, password: pwd, remember: rememberOption } = credentialsOrEmail;
      identifier = email || username;
      password = pwd;
      if (rememberOption !== undefined) remember = rememberOption;
    } else {
      identifier = credentialsOrEmail;
      password = passwordArg;
    }

    try {
      const payload = { password };
      if (identifier) {
        payload.email = identifier;
        payload.username = identifier;
      }

      const res = await api.post('/auth/login', payload);
      const data = res.data || {};
      const userData = data.user || data.data || null;
      const accessToken = data.accessToken || data.token || data.access_token;
      const refreshToken = data.refreshToken || data.refresh_token;

      saveTokens({ accessToken, refreshToken }, remember !== false);

      if (accessToken) {
        localStorage.setItem('token', accessToken);
      }

      if (remember) {
        localStorage.setItem('rememberUser', 'true');
      } else {
        localStorage.removeItem('rememberUser');
      }
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
      }

      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Network error. Please try again.';
      setError(message);
      setIsAuthenticated(false);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/register', payload);
      const data = res.data || {};
      const userData = data.user || data.data || data;
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Registration failed';
      setError(message);
      setIsAuthenticated(false);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.put('/auth/profile', updates);
      const updatedUser = res.data?.user || res.data?.data || { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || 'Update failed';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore logout errors
    } finally {
      clearTokens();
        localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberUser');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const hasRole = (r) => {
    if (!user?.role) return false;
    return user.role.toLowerCase() === r.toLowerCase();
  };
  const isStudent = () => hasRole('Student');
  const isCoreTeam = () => hasRole('core_team');
  const isTeacher = () => hasRole('Teacher');

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      loading,
      error,
      login,
      register,
      logout,
      updateProfile,
      clearError,
      hasRole,
      isStudent,
      isCoreTeam,
      isTeacher
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
