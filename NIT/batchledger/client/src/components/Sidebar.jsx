import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, Factory, BarChart3, CreditCard, BookOpen, Settings,
  LogOut, ChevronDown, AlertTriangle, Boxes,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const navGroups = [
  {
    label: 'Main',
    items: [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR'] },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/app/customers', icon: Users, label: 'Customers', roles: ['ADMIN', 'SALESMAN'] },
      { to: '/app/suppliers', icon: Truck, label: 'Suppliers', roles: ['ADMIN'] },
      { to: '/app/products', icon: Package, label: 'Products', roles: ['ADMIN'] },
      { to: '/app/materials', icon: Boxes, label: 'Materials', roles: ['ADMIN', 'PRODUCTION_SUPERVISOR'] },
      { to: '/app/boms', icon: BookOpen, label: 'Bill of Materials', roles: ['ADMIN', 'PRODUCTION_SUPERVISOR'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/app/purchases', icon: ShoppingCart, label: 'Purchases', roles: ['ADMIN'] },
      { to: '/app/production', icon: Factory, label: 'Production', roles: ['ADMIN', 'PRODUCTION_SUPERVISOR'] },
      { to: '/app/orders', icon: FileText, label: 'Sales Orders', roles: ['ADMIN', 'SALESMAN'] },
      { to: '/app/invoices', icon: FileText, label: 'GST Invoices', roles: ['ADMIN', 'SALESMAN'] },
      { to: '/app/dispatch', icon: Truck, label: 'Dispatch', roles: ['ADMIN', 'SALESMAN'] },
      { to: '/app/payments', icon: CreditCard, label: 'Payments', roles: ['ADMIN', 'SALESMAN'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/app/stock', icon: BarChart3, label: 'Stock Ledger', roles: ['ADMIN', 'AUDITOR', 'PRODUCTION_SUPERVISOR'] },
      { to: '/app/reports', icon: BarChart3, label: 'Reports', roles: ['ADMIN', 'AUDITOR'] },
      { to: '/app/audit', icon: AlertTriangle, label: 'Audit Log', roles: ['ADMIN', 'AUDITOR'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/app/users', icon: Settings, label: 'User Management', roles: ['ADMIN'] },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not sign out. Please try again.');
    }
  };

  const roleColors = {
    ADMIN: 'bg-teal-500',
    SALESMAN: 'bg-blue-500',
    PRODUCTION_SUPERVISOR: 'bg-orange-500',
    AUDITOR: 'bg-purple-500',
  };
  const roleLabels = {
    ADMIN: 'Admin',
    SALESMAN: 'Salesman',
    PRODUCTION_SUPERVISOR: 'Production',
    AUDITOR: 'Auditor',
  };

  return (
    <div className="sidebar">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">BatchLedger</div>
            <div className="text-slate-400 text-xs">From Recipe to Reconciliation</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <ArrowLeft size={17} />
          <span>Back to landing</span>
        </NavLink>
        {navGroups.map((group) => {
          const visible = group.items.filter(i => i.roles.includes(user?.role));
          if (!visible.length) return null;
          return (
            <div key={group.label}>
              <div className="px-6 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.label}</div>
              {visible.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${roleColors[user?.role]}`}>
            {user?.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-slate-400 text-xs">{roleLabels[user?.role]}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20">
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );
}
