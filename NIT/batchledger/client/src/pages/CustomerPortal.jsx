import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Package, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi, productsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const formatINR = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const statusClass = status => ({
  PENDING_APPROVAL: 'badge-yellow',
  APPROVED: 'badge-blue',
  DISPATCHED: 'badge-green',
  CANCELLED: 'badge-red',
}[status] || 'badge-gray');

export default function CustomerPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadPortalData = async () => {
    try {
      const [productResponse, orderResponse] = await Promise.all([productsApi.list(), ordersApi.list()]);
      setProducts(productResponse.data);
      setOrders(orderResponse.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load the customer portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  const selectedProducts = products
    .map(product => ({ ...product, quantity: Number(quantities[product.id] || 0) }))
    .filter(product => Number.isFinite(product.quantity) && product.quantity > 0);
  const total = selectedProducts.reduce((sum, product) => sum + product.quantity * product.sellingPrice, 0);

  const placeOrder = async event => {
    event.preventDefault();
    if (!selectedProducts.length) {
      toast.error('Choose at least one product and quantity.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await ordersApi.create({
        items: selectedProducts.map(({ id, quantity }) => ({ productId: id, orderedQty: quantity })),
        notes: notes.trim() || undefined,
      });
      setOrders(current => [data, ...current]);
      setQuantities({});
      setNotes('');
      toast.success('Your order was sent to the producer.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not place your order.');
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/login?portal=customer');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">BatchLedger · Customer Portal</div>
            <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="btn-ghost"><ArrowLeft size={16} /> Landing page</Link>
            <button type="button" onClick={signOut} className="btn-ghost"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">Place an order</h1>
          <p className="mt-1 text-sm text-gray-500">Choose products and quantities. The producer will review your request.</p>
        </section>

        <form onSubmit={placeOrder} className="space-y-5">
          {loading ? (
            <div className="card text-center text-gray-500">Loading products…</div>
          ) : products.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map(product => (
                <article key={product.id} className="card flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-teal-50 p-2 text-teal-700"><Package size={20} /></div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-gray-900">{product.name}</h2>
                      <p className="text-sm text-gray-500">{product.code} · per {product.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-800">{formatINR(product.sellingPrice)}</span>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      Qty
                      <input
                        type="number"
                        className="input w-24"
                        min="0"
                        step="1"
                        value={quantities[product.id] || ''}
                        onChange={event => setQuantities(current => ({ ...current, [product.id]: event.target.value }))}
                        aria-label={`Quantity for ${product.name}`}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card text-center text-gray-500">No products are currently available to order.</div>
          )}

          <div className="card space-y-4">
            <label className="block">
              <span className="label">Note to producer (optional)</span>
              <textarea className="input" rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-sm text-gray-500">Estimated subtotal</span>
                <div className="text-xl font-bold text-gray-900">{formatINR(total)}</div>
              </div>
              <button type="submit" className="btn-primary" disabled={loading || submitting || !products.length}>
                <ShoppingBag size={17} />
                {submitting ? 'Sending order…' : 'Send order to producer'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Final availability, GST, and delivery details are confirmed by the producer.</p>
          </div>
        </form>

        <section>
          <h2 className="mb-4 text-xl font-bold text-gray-900">Your orders</h2>
          {loading ? (
            <div className="card text-center text-gray-500">Loading orders…</div>
          ) : orders.length ? (
            <div className="space-y-3">
              {orders.map(order => (
                <article key={order.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{order.orderNo}</h3>
                      <p className="text-sm text-gray-500">{new Date(order.orderDate).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span className={`badge ${statusClass(order.status)}`}>{order.status.replaceAll('_', ' ')}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-gray-600">
                    {order.items.map(item => (
                      <li key={item.id}>{item.product?.name} × {item.orderedQty} — {formatINR(item.totalPrice)}</li>
                    ))}
                  </ul>
                  <div className="mt-3 text-right font-semibold text-gray-900">{formatINR(order.totalAmount)}</div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card text-center text-gray-500">You haven’t placed an order yet.</div>
          )}
        </section>
      </main>
    </div>
  );
}
