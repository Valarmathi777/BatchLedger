import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('bl_user');
    const token = localStorage.getItem('bl_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('bl_token', data.token);
    localStorage.setItem('bl_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const registerCustomer = async (details) => {
    const { data } = await authApi.registerCustomer(details);
    localStorage.setItem('bl_token', data.token);
    localStorage.setItem('bl_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('bl_token');
    localStorage.removeItem('bl_user');
    setUser(null);
  };

  const can = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, registerCustomer, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
