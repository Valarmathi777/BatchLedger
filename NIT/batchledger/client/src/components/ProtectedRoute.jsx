import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  if (!user) return <Navigate to={location.pathname === '/customer' ? '/login?portal=customer' : '/login'} state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'CUSTOMER' ? '/customer' : '/app/dashboard'} replace />;

  return children;
}
