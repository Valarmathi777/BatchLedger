import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/app/Dashboard';
import Customers from './pages/app/Customers';
import Suppliers from './pages/app/Suppliers';
import Products from './pages/app/Products';
import Materials from './pages/app/Materials';
import Boms from './pages/app/Boms';
import Purchases from './pages/app/Purchases';
import Production from './pages/app/Production';
import Orders from './pages/app/Orders';
import Invoices from './pages/app/Invoices';
import Dispatch from './pages/app/Dispatch';
import Payments from './pages/app/Payments';
import StockLedger from './pages/app/StockLedger';
import Reports from './pages/app/Reports';
import AuditLog from './pages/app/AuditLog';
import UserManagement from './pages/app/UserManagement';
import CustomerPortal from './pages/CustomerPortal';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: '10px', fontSize: '14px' } }} />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/customer" element={
            <ProtectedRoute roles={['CUSTOMER']}>
              <CustomerPortal />
            </ProtectedRoute>
          } />

          <Route path="/app" element={
            <ProtectedRoute roles={['ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR']}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Master data */}
            <Route path="customers" element={<ProtectedRoute roles={['ADMIN','SALESMAN']}><Customers /></ProtectedRoute>} />
            <Route path="suppliers" element={<ProtectedRoute roles={['ADMIN']}><Suppliers /></ProtectedRoute>} />
            <Route path="products" element={<ProtectedRoute roles={['ADMIN']}><Products /></ProtectedRoute>} />
            <Route path="materials" element={<ProtectedRoute roles={['ADMIN','PRODUCTION_SUPERVISOR']}><Materials /></ProtectedRoute>} />
            <Route path="boms" element={<ProtectedRoute roles={['ADMIN','PRODUCTION_SUPERVISOR']}><Boms /></ProtectedRoute>} />

            {/* Operations */}
            <Route path="purchases" element={<ProtectedRoute roles={['ADMIN']}><Purchases /></ProtectedRoute>} />
            <Route path="production" element={<ProtectedRoute roles={['ADMIN','PRODUCTION_SUPERVISOR']}><Production /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute roles={['ADMIN','SALESMAN']}><Orders /></ProtectedRoute>} />
            <Route path="invoices" element={<ProtectedRoute roles={['ADMIN','SALESMAN']}><Invoices /></ProtectedRoute>} />
            <Route path="dispatch" element={<ProtectedRoute roles={['ADMIN','SALESMAN']}><Dispatch /></ProtectedRoute>} />
            <Route path="payments" element={<ProtectedRoute roles={['ADMIN','SALESMAN']}><Payments /></ProtectedRoute>} />

            {/* Analytics */}
            <Route path="stock" element={<StockLedger />} />
            <Route path="reports" element={<ProtectedRoute roles={['ADMIN','AUDITOR']}><Reports /></ProtectedRoute>} />
            <Route path="audit" element={<ProtectedRoute roles={['ADMIN','AUDITOR']}><AuditLog /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="users" element={<ProtectedRoute roles={['ADMIN']}><UserManagement /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
