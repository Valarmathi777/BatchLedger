import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const QUICK_LOGINS = [
  { label: 'Admin', email: 'admin@batchledger.com', password: 'Admin@123', color: 'bg-teal-600' },
  { label: 'Salesman', email: 'salesman@batchledger.com', password: 'Sales@123', color: 'bg-blue-600' },
  { label: 'Production', email: 'supervisor@batchledger.com', password: 'Prod@123', color: 'bg-orange-500' },
  { label: 'Auditor', email: 'auditor@batchledger.com', password: 'Audit@123', color: 'bg-purple-600' },
];

const STATES = [
  ['Andhra Pradesh', '37'], ['Arunachal Pradesh', '12'], ['Assam', '18'], ['Bihar', '10'],
  ['Chhattisgarh', '22'], ['Goa', '30'], ['Gujarat', '24'], ['Haryana', '06'],
  ['Himachal Pradesh', '02'], ['Jharkhand', '20'], ['Karnataka', '29'], ['Kerala', '32'],
  ['Madhya Pradesh', '23'], ['Maharashtra', '27'], ['Manipur', '14'], ['Meghalaya', '17'],
  ['Mizoram', '15'], ['Nagaland', '13'], ['Odisha', '21'], ['Punjab', '03'],
  ['Rajasthan', '08'], ['Sikkim', '11'], ['Tamil Nadu', '33'], ['Telangana', '36'],
  ['Tripura', '16'], ['Uttar Pradesh', '09'], ['Uttarakhand', '05'], ['West Bengal', '19'],
  ['Andaman and Nicobar Islands', '35'], ['Chandigarh', '04'], ['Dadra and Nagar Haveli and Daman and Diu', '26'],
  ['Delhi', '07'], ['Jammu and Kashmir', '01'], ['Ladakh', '38'], ['Lakshadweep', '31'],
  ['Puducherry', '34'],
];

export default function Login() {
  const { login, registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isCustomerPortal = searchParams.get('portal') === 'customer';
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState('Tamil Nadu|33');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isRegistering
        ? await registerCustomer({
          name,
          email,
          password,
          state: state.split('|')[0],
          stateCode: state.split('|')[1],
          phone,
          address,
        })
        : await login(email, password);
      toast.success(isRegistering ? 'Customer account created!' : 'Welcome back!');
      navigate(user.role === 'CUSTOMER' ? '/customer' : '/app/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Login failed. Check your details.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (ql) => {
    setError('');
    setLoading(true);
    try {
      const user = await login(ql.email, ql.password);
      toast.success(`Logged in as ${ql.label}`);
      navigate(user.role === 'CUSTOMER' ? '/customer' : '/app/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-navy-800 flex">
      {/* Left branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center p-12 text-white">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-2xl font-bold font-display">BatchLedger</div>
            <div className="text-slate-400 text-sm">From Recipe to Reconciliation</div>
          </div>
        </div>
        <div className="max-w-sm text-center">
          <h1 className="text-3xl font-bold mb-4 font-display">Order-to-Audit ERP</h1>
          <p className="text-slate-400 leading-relaxed">Complete manufacturing intelligence for small South Indian food makers – batches, BOM, GST invoicing and production variance, all in one place.</p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-sm text-sm">
          {[
            ['Batch DNA', 'Trace every batch from recipe to shelf'],
            ['Variance Intelligence', 'Flag material overuse instantly'],
            ['GST Ready', 'CGST, SGST, IGST, PDF invoices'],
            ['Audit Trail', 'Every change logged with timestamp'],
          ].map(([title, desc]) => (
            <div key={title} className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="font-semibold text-teal-400 mb-1">{title}</div>
              <div className="text-slate-400 text-xs">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors mb-4">
            <ArrowLeft size={16} />
            Back to landing
          </Link>
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{isRegistering ? 'Create customer account' : 'Sign in'}</h2>
            <p className="text-gray-500 text-sm mb-6">
              {isCustomerPortal ? 'Customer portal · order directly from the producer' : 'BatchLedger ERP – Local Instance'}
            </p>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="label" htmlFor="customer-name">Customer or business name</label>
                  <input id="customer-name" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@batchledger.com" required />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <input id="password" type={showPw ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={isRegistering ? 8 : undefined} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {isRegistering && (
                <>
                  <div>
                    <label className="label" htmlFor="customer-state">State</label>
                    <select id="customer-state" className="input" value={state} onChange={e => setState(e.target.value)} required>
                      {STATES.map(([stateName, stateCode]) => (
                        <option key={stateCode} value={`${stateName}|${stateCode}`}>{stateName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="customer-phone">Phone (optional)</label>
                    <input id="customer-phone" type="tel" className="input" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} />
                  </div>
                  <div>
                    <label className="label" htmlFor="customer-address">Address (optional)</label>
                    <textarea id="customer-address" className="input" value={address} onChange={e => setAddress(e.target.value)} maxLength={300} rows={2} />
                  </div>
                </>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-sm font-semibold disabled:opacity-60">
                {loading ? (isRegistering ? 'Creating account…' : 'Signing in…') : (isRegistering ? 'Create account' : 'Sign in')}
              </button>
            </form>

            {isCustomerPortal && (
              <p className="mt-5 text-center text-sm text-gray-500">
                {isRegistering ? 'Already have an account?' : 'New customer?'}{' '}
                <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="font-semibold text-teal-700 hover:text-teal-600">
                  {isRegistering ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            )}

            {!isCustomerPortal && (
            <div className="mt-6">
              <div className="text-xs text-gray-400 text-center mb-3">— Quick access (demo) —</div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_LOGINS.map(ql => (
                  <button key={ql.label} onClick={() => quickLogin(ql)} disabled={loading}
                    className={`${ql.color} text-white text-xs font-medium py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60`}>
                    {ql.label}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
