import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    authApi.me()
      .then(({ data }) => {
        if (active) setUser(data);
      })
      .catch(error => {
        if (active && error.response?.status !== 401) {
          setAuthError('Could not verify your session. Check the API connection and reload.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const login = async (email, password, portal) => {
    const { data } = await authApi.login(email, password, portal);
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const registerCustomer = async (details) => {
    const { data } = await authApi.registerCustomer(details);
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const registerSeller = async (details) => {
    const { data } = await authApi.registerSeller(details);
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const registerAdmin = async (details) => {
    const { data } = await authApi.registerAdmin(details);
    setUser(data.user);
    setAuthError('');
    return data.user;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setAuthError('');
  };

  const can = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, registerCustomer, registerSeller, registerAdmin, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
