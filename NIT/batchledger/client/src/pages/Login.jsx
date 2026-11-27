import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import { INDIAN_STATES } from '../constants/indianStates';
import toast from 'react-hot-toast';

const ROLE_HOME = {
  ADMIN: '/app/dashboard',
  SALESMAN: '/app/orders',
  PRODUCTION_SUPERVISOR: '/app/production',
  AUDITOR: '/app/reports',
  CUSTOMER: '/customer',
  SELLER: '/seller',
};

export default function Login() {
  const { login, registerCustomer, registerSeller, registerAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portal = searchParams.get('portal') || 'owner';
  const isCustomerPortal = portal === 'customer';
  const isProducerPortal = portal === 'producer';
  const isOwnerPortal = portal === 'owner';
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState('Tamil Nadu|33');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [producerProducts, setProducerProducts] = useState([
    { name: '', category: 'Snacks', unit: 'packet', sellingPrice: '' },
  ]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasAdmin, setHasAdmin] = useState(true);

  useEffect(() => {
    if (isOwnerPortal) {
      authApi.setupStatus()
        .then(({ data }) => setHasAdmin(data.hasAdmin))
        .catch(() => setHasAdmin(true));
    }
  }, [isOwnerPortal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = isRegistering
        ? isCustomerPortal
          ? await registerCustomer({
            name,
            email,
            password,
            state: state.split('|')[0],
            stateCode: state.split('|')[1],
            phone,
            address,
          })
          : isProducerPortal
            ? await registerSeller({
              name,
              email,
              password,
              businessState: state.split('|')[0],
              businessStateCode: state.split('|')[1],
              products: producerProducts.map(product => ({
                ...product,
                sellingPrice: Number(product.sellingPrice),
              })),
            })
            : await registerAdmin({ name, email, password })
        : await login(email, password, portal);
      toast.success(isRegistering ? 'Account created!' : 'Welcome back!');
      navigate(ROLE_HOME[user.role] || '/app/dashboard');
    } catch (err) {
      const fallback = !err.response
        ? 'Unable to reach the BatchLedger server. Check that the API is running.'
        : err.response.status >= 500
          ? 'The server could not complete the request. Please try again shortly.'
          : isRegistering
            ? 'Could not create your account. Check the details and try again.'
            : 'Login failed. Check your details.';
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || fallback);
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
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {isRegistering
                ? isCustomerPortal ? 'Create customer account'
                  : isProducerPortal ? 'Register producer account'
                    : 'Set up initial administrator'
                : 'Sign in'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {isCustomerPortal
                ? 'Customer portal · browse producers and track orders'
                : isProducerPortal
                  ? 'Producer portal · manage orders, stock, production and invoices'
                  : 'Administrator portal · configure the entire ERP'}
            </p>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="label" htmlFor="account-name">
                    {isCustomerPortal ? 'Customer or business name' : isProducerPortal ? 'Producer or business name' : 'Administrator name'}
                  </label>
                  <input id="account-name" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
                </div>
              )}
              {isRegistering && isProducerPortal && (
                <div>
                  <label className="label" htmlFor="producer-state">Business state (used to calculate GST)</label>
                  <select id="producer-state" className="input" value={state} onChange={event => setState(event.target.value)} required>
                    {INDIAN_STATES.map(([stateName, stateCode]) => (
                      <option key={stateCode} value={`${stateName}|${stateCode}`}>{stateName}</option>
                    ))}
                  </select>
                </div>
              )}
              {isRegistering && isProducerPortal && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-800">Products you produce</div>
                  {producerProducts.map((product, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 p-3 space-y-2">
                      <input className="input" placeholder="Product name, e.g. Murukku"
                        value={product.name}
                        onChange={event => setProducerProducts(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}
                        required />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input" placeholder="Category"
                          value={product.category}
                          onChange={event => setProducerProducts(current => current.map((item, i) => i === index ? { ...item, category: event.target.value } : item))} />
                        <input className="input" placeholder="Unit"
                          value={product.unit}
                          onChange={event => setProducerProducts(current => current.map((item, i) => i === index ? { ...item, unit: event.target.value } : item))}
                          required />
                      </div>
                      <input className="input" type="number" min="0" step="0.01" placeholder="Price per unit"
                        value={product.sellingPrice}
                        onChange={event => setProducerProducts(current => current.map((item, i) => i === index ? { ...item, sellingPrice: event.target.value } : item))}
                        required />
                      {producerProducts.length > 1 && (
                        <button type="button" className="text-xs font-semibold text-red-600"
                          onClick={() => setProducerProducts(current => current.filter((_, i) => i !== index))}>Remove product</button>
                      )}
                    </div>
                  ))}
                  {producerProducts.length < 20 && (
                    <button type="button" className="text-sm font-semibold text-teal-700"
                      onClick={() => setProducerProducts(current => [...current, { name: '', category: 'Snacks', unit: 'packet', sellingPrice: '' }])}>
                      + Add another product
                    </button>
                  )}
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@batchledger.com" required />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <div className="relative">
                  <input id="password" type={showPw ? 'text' : 'password'} className="input pr-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={isRegistering ? (isOwnerPortal ? 12 : 8) : undefined} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {isRegistering && isCustomerPortal && (
                <>
                  <div>
                    <label className="label" htmlFor="customer-state">State</label>
                    <select id="customer-state" className="input" value={state} onChange={e => setState(e.target.value)} required>
                      {INDIAN_STATES.map(([stateName, stateCode]) => (
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

            {(isCustomerPortal || isProducerPortal || (isOwnerPortal && !hasAdmin)) && (
              <p className="mt-5 text-center text-sm text-gray-500">
                {isRegistering
                  ? 'Already have an account?'
                  : isCustomerPortal
                    ? 'New customer?'
                    : isProducerPortal
                      ? 'New producer?'
                      : 'First-time setup?'}{' '}
                <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="font-semibold text-teal-700 hover:text-teal-600">
                  {isRegistering
                    ? 'Sign in'
                    : isCustomerPortal
                      ? 'Create an account'
                      : isProducerPortal
                        ? 'Register producer'
                        : 'Create administrator'}
                </button>
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
