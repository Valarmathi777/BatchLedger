import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, LogOut, Package, Search, ShoppingBag, Download, MessageCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { marketplaceApi, messagesApi, notificationsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const formatINR = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const statusClass = status => ({
  ORDER_RECEIVED: 'badge-yellow',
  PENDING_APPROVAL: 'badge-yellow',
  ORDER_ACCEPTED: 'badge-blue',
  PRODUCTION_STARTED: 'badge-blue',
  PRODUCTION_IN_PROGRESS: 'badge-blue',
  QUALITY_CHECK: 'badge-yellow',
  PRODUCTION_COMPLETED: 'badge-green',
  READY_FOR_PACKAGING: 'badge-green',
  READY_FOR_DISPATCH: 'badge-green',
  DISPATCHED: 'badge-blue',
  DELIVERED: 'badge-green',
  REJECTED: 'badge-red',
}[status] || 'badge-gray');
const unitOptions = unit => {
  const base = String(unit || '').toLowerCase();
  if (base === 'kg') return ['kg', 'g'];
  if (['g', 'gram', 'grams'].includes(base)) return ['g', 'kg'];
  if (['packet', 'packets'].includes(base)) return ['packet'];
  if (['piece', 'pieces', 'pc', 'pcs'].includes(base)) return ['piece'];
  return [unit];
};
const unitFactor = (baseUnit, chosenUnit) => {
  const base = String(baseUnit || '').toLowerCase();
  const chosen = String(chosenUnit || baseUnit || '').toLowerCase();
  if (base === 'kg' && chosen === 'g') return 0.001;
  if (['g', 'gram', 'grams'].includes(base) && chosen === 'kg') return 1000;
  return 1;
};

function downloadInvoice(order, invoice) {
  const doc = new jsPDF();
  let y = 18;
  const line = (text, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const wrapped = doc.splitTextToSize(String(text), 175);
    if (y + wrapped.length * 7 > doc.internal.pageSize.getHeight() - 12) {
      doc.addPage();
      y = 18;
    }
    doc.text(wrapped, 16, y);
    y += wrapped.length * 7;
  };
  line(`BatchLedger Seller Invoice`, true);
  line(`Invoice: ${invoice.invoiceNo}`);
  line(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`);
  line(`Seller order: ${order.orderNo} · Common order: ${order.marketplaceOrderId}`);
  line(`Customer: ${invoice.customer?.name || ''}`);
  y += 3;
  line('Items', true);
  invoice.items.forEach(item => {
    line(`${item.product.name} — ${item.quantity} ${item.unit || item.product.unit} × ${formatINR(item.unitPrice)} = ${formatINR(item.taxableAmount)}`);
  });
  y += 3;
  line(`Subtotal: ${formatINR(invoice.taxableAmount)}`);
  line(`CGST: ${formatINR(invoice.cgst)}   SGST: ${formatINR(invoice.sgst)}   IGST: ${formatINR(invoice.igst)}`);
  line(`Delivery charge: ${formatINR(invoice.deliveryCharge)}`);
  line(`Total: ${formatINR(invoice.grandTotal)}`, true);
  doc.save(`${invoice.invoiceNo}.pdf`);
}

export default function CustomerPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [producers, setProducers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [producerId, setProducerId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('Standard delivery');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [messageThreads, setMessageThreads] = useState([]);
  const [messageProducer, setMessageProducer] = useState(null);
  const [messageProductId, setMessageProductId] = useState(null);
  const [messageText, setMessageText] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [producerResult, productResult, orderResult, chargeResult, notificationResult, threadResult] = await Promise.all([
        marketplaceApi.producers(),
        marketplaceApi.products(),
        marketplaceApi.orders(),
        marketplaceApi.deliveryCharge(),
        notificationsApi.list(),
        messagesApi.threads(),
      ]);
      setProducers(producerResult.data);
      setProducts(productResult.data);
      setOrders(orderResult.data);
      setDeliveryCharge(chargeResult.data.amount);
      setNotifications(notificationResult.data);
      setMessageThreads(threadResult.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load the marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadData();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const categories = useMemo(() => [...new Set(products.map(product => product.category).filter(Boolean))].sort(), [products]);
  const filteredProducts = products.filter(product => {
    const matchesText = `${product.name} ${product.description || ''} ${product.seller?.name || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesText
      && (!category || product.category === category)
      && (!producerId || String(product.sellerId) === producerId);
  });

  const selectedProducts = products.flatMap(product => {
    const selection = cart[product.id];
    if (!selection?.added || !Number.isFinite(Number(selection.quantity)) || Number(selection.quantity) <= 0) return [];
    const factor = unitFactor(product.unit, selection.unit);
    const quantity = Number(selection.quantity);
    const subtotal = quantity * product.sellingPrice * factor;
    return [{ ...product, displayQuantity: quantity, orderUnit: selection.unit, subtotal }];
  });
  const subtotal = selectedProducts.reduce((sum, product) => sum + product.subtotal, 0);
  const taxEstimate = selectedProducts.reduce((sum, product) => sum + product.subtotal * Number(product.gstRate || 0) / 100, 0);
  const totalEstimate = subtotal + taxEstimate + deliveryCharge;

  const updateCart = (product, changes) => {
    setCart(current => ({
      ...current,
      [product.id]: { quantity: current[product.id]?.quantity || '', unit: current[product.id]?.unit || product.unit, ...changes },
    }));
  };

  const addToOrder = product => {
    const quantity = Number(cart[product.id]?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Enter a quantity greater than zero before adding this product.');
      return;
    }
    updateCart(product, { added: true });
    toast.success(`${product.name} added to your order.`);
  };

  const placeOrder = async event => {
    event.preventDefault();
    if (!selectedProducts.length) {
      toast.error('Choose at least one product and quantity.');
      return;
    }
    if (!deliveryAddress.trim()) {
      toast.error('Enter a delivery address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await marketplaceApi.createOrder({
        items: selectedProducts.map(product => ({
          productId: product.id,
          quantity: product.displayQuantity,
          unit: product.orderUnit,
        })),
        deliveryAddress: deliveryAddress.trim(),
        deliveryMethod,
        specialInstructions: specialInstructions.trim() || undefined,
      });
      setCart({});
      setSpecialInstructions('');
      toast.success(`Order placed. Reference: ${data.reference}`);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not place your order.');
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async notification => {
    if (notification.readAt) return;
    try {
      await notificationsApi.markRead(notification.id);
      setNotifications(current => current.map(item => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update notification.');
    }
  };

  const signOut = async () => {
    try {
      await logout();
      navigate('/login?portal=customer');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not sign out. Please try again.');
    }
  };

  const openMessage = (producer, productId = null) => {
    setMessageProducer(producer);
    setMessageProductId(productId);
  };

  const sendMessage = async event => {
    event?.preventDefault();
    if (!messageProducer || !messageText.trim()) return;
    try {
      await messagesApi.send({
        receiverId: messageProducer.id,
        productId: messageProductId,
        body: messageText.trim(),
      });
      setMessageText('');
      await loadData();
      toast.success(`Message sent to ${messageProducer.name}.`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not send message.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-lg font-bold text-gray-900">BatchLedger · Marketplace</div>
            <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="btn-ghost"><ArrowLeft size={16} /> Landing page</Link>
            <button type="button" onClick={signOut} className="btn-ghost"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <section>
          <h1 className="text-2xl font-bold text-gray-900">Browse local producers</h1>
          <p className="mt-1 text-sm text-gray-500">Shop products from individual producers or combine items from multiple sellers in one order. Set quantities here; sellers manage product names, descriptions and prices.</p>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            <button type="button" onClick={() => setProducerId('')} className={`rounded-lg px-4 py-2 text-sm ${!producerId ? 'bg-teal-700 text-white' : 'bg-white text-gray-700'}`}>All producers</button>
            {producers.map(producer => (
              <button type="button" key={producer.id} onClick={() => setProducerId(String(producer.id))}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${producerId === String(producer.id) ? 'bg-teal-700 text-white' : 'bg-white text-gray-700'}`}>
                {producer.name} · {producer.products.length}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <label className="relative">
              <span className="sr-only">Search products or producers</span>
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input className="input pl-9" placeholder="Search products or producers" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <select className="input" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map(value => <option value={value} key={value}>{value}</option>)}
            </select>
            <select className="input" value={producerId} onChange={event => setProducerId(event.target.value)}>
              <option value="">All producers</option>
              {producers.map(producer => <option value={producer.id} key={producer.id}>{producer.name}</option>)}
            </select>
          </div>
        </section>

        {loading ? <div className="card text-center text-gray-500">Loading producers and products…</div> : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map(product => {
              const cartItem = cart[product.id] || { quantity: '', unit: product.unit };
              const options = unitOptions(product.unit);
              return (
                <article key={product.id} className="card flex flex-col gap-3">
                  {product.imageUrl
                    ? <img src={product.imageUrl} alt={product.name} className="h-44 w-full rounded-lg object-cover" />
                    : <div className="flex h-32 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Package size={32} /></div>}
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{product.seller?.name}</p>
                    <h2 className="mt-1 font-semibold text-gray-900">{product.name}</h2>
                    <p className="text-sm text-gray-500">{product.category || 'General'} · approx. {product.preparationMinutes} min preparation</p>
                    {product.description && <p className="mt-2 text-sm text-gray-600">{product.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold text-gray-900">{formatINR(product.sellingPrice)} / {product.unit}</div>
                    <button type="button" className="btn-ghost"
                      onClick={() => openMessage(product.seller, product.id)}>
                      <MessageCircle size={15} /> Message producer
                    </button>
                    <div className="flex gap-2">
                      <input type="number" min="0" step={['kg', 'g'].includes(String(cartItem.unit).toLowerCase()) ? '0.01' : '1'}
                        className="input w-24" value={cartItem.quantity}
                        onChange={event => updateCart(product, { quantity: event.target.value })}
                        aria-label={`Quantity of ${product.name}`} />
                      <select className="input w-24" value={cartItem.unit}
                        onChange={event => updateCart(product, { unit: event.target.value })}
                        aria-label={`Unit for ${product.name}`}>
                        {options.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </div>
                    <button type="button"
                      className={cartItem.added && Number(cartItem.quantity) > 0 ? 'btn-ghost' : 'btn-primary'}
                      onClick={() => cartItem.added && Number(cartItem.quantity) > 0
                        ? updateCart(product, { added: false })
                        : addToOrder(product)}>
                      {cartItem.added && Number(cartItem.quantity) > 0 ? 'Remove from order' : 'Add to order'}
                    </button>
                  </div>
                </article>
              );
            })}
            {!filteredProducts.length && (
              <div className="card text-center text-gray-500 sm:col-span-2 lg:col-span-3">
                {products.length
                  ? 'No available products match these filters.'
                  : 'No products are listed yet. A producer must add and list products before customers can place an order.'}
              </div>
            )}
          </section>
        )}

        {messageProducer && (
          <section className="card">
            <h2 className="text-lg font-bold text-gray-900">Message {messageProducer.name}</h2>
            {messageProductId && (
              <p className="mt-1 text-sm text-gray-500">
                About: {products.find(product => product.id === messageProductId)?.name || 'Selected product'}
              </p>
            )}
            <form onSubmit={sendMessage} className="mt-3 flex gap-3">
              <input className="input flex-1" value={messageText} onChange={event => setMessageText(event.target.value)}
                maxLength={2000} placeholder="Ask about ingredients, bulk quantity, preparation time…" required />
              <button type="submit" className="btn-primary"><MessageCircle size={15} /> Send</button>
              <button type="button" className="btn-ghost" onClick={() => setMessageProducer(null)}>Close</button>
            </form>
            {messageThreads.filter(thread => thread.user.id === messageProducer.id).map(thread => (
              <div key={`${thread.user.id}-${thread.product?.id || 0}`} className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {thread.messages.map(message => (
                  <div key={message.id} className={`rounded-lg px-3 py-2 text-sm ${message.senderId === user?.id ? 'ml-12 bg-teal-50' : 'mr-12 bg-gray-100'}`}>
                    <p>{message.body}</p>
                    <p className="mt-1 text-xs text-gray-500">{new Date(message.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        <form onSubmit={placeOrder} className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="card space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><ShoppingBag size={19} /> Delivery details</h2>
            <label className="block"><span className="label">Delivery address</span>
              <textarea className="input" rows={3} maxLength={300} required value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} />
            </label>
            <label className="block"><span className="label">Delivery method</span>
              <select className="input" value={deliveryMethod} onChange={event => setDeliveryMethod(event.target.value)}>
                <option>Standard delivery</option><option>Pickup</option>
              </select>
            </label>
            <label className="block"><span className="label">Special instructions (optional)</span>
              <textarea className="input" rows={2} maxLength={1000} value={specialInstructions} onChange={event => setSpecialInstructions(event.target.value)} />
            </label>
          </section>
          <section className="card h-fit space-y-3">
            <h2 className="text-lg font-bold text-gray-900">Order summary</h2>
            {selectedProducts.length ? (
              <ul className="space-y-2 text-sm">
                {selectedProducts.map(product => (
                  <li key={product.id} className="flex justify-between gap-3">
                    <span>{product.name} × {product.displayQuantity} {product.orderUnit}</span>
                    <span className="whitespace-nowrap">{formatINR(product.subtotal)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500">Your cart is empty.</p>}
            <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
              <div className="flex justify-between"><span>Estimated GST</span><span>{formatINR(taxEstimate)}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>{formatINR(deliveryCharge)}</span></div>
              <div className="flex justify-between pt-2 text-base font-bold"><span>Estimated total</span><span>{formatINR(totalEstimate)}</span></div>
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={submitting || loading || !selectedProducts.length}>
              <ShoppingBag size={17} />{submitting ? 'Placing order…' : 'Place order'}
            </button>
            <p className="text-xs text-gray-500">One order reference is shared across producers. Each seller receives only their items and issues a separate invoice.</p>
          </section>
        </form>

        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900"><Bell size={20} /> Notifications</h2>
          <div className="space-y-2">
            {notifications.slice(0, 5).map(notification => (
              <button type="button" key={notification.id} onClick={() => markRead(notification)}
                className={`card w-full text-left ${notification.readAt ? 'opacity-70' : 'border-teal-200'}`}>
                <div className="flex justify-between gap-3"><span className="font-semibold">{notification.title}</span><span className="text-xs text-gray-500">{new Date(notification.createdAt).toLocaleString('en-IN')}</span></div>
                <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
              </button>
            ))}
            {!notifications.length && <div className="card text-sm text-gray-500">Order and delivery updates will appear here.</div>}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold text-gray-900">Your orders</h2>
          {orders.length ? (
            <div className="space-y-4">
              {orders.map(order => (
                <article key={order.reference} className="card space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="font-semibold text-gray-900">Order {order.reference}</h3><p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString('en-IN')}</p></div>
                    <span className={`badge ${statusClass(order.status)}`}>{order.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="space-y-3">
                    {order.orders.map(sellerOrder => (
                      <div key={sellerOrder.id} className="rounded-lg border border-gray-100 p-4">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div><h4 className="font-semibold text-gray-800">{sellerOrder.seller?.name}</h4><p className="text-xs text-gray-500">{sellerOrder.orderNo}</p></div>
                          <span className={`badge ${statusClass(sellerOrder.status)}`}>{sellerOrder.status.replaceAll('_', ' ')}</span>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-gray-600">
                          {sellerOrder.items.map(item => <li key={item.id}>{item.product.name} × {item.displayQty ?? item.orderedQty} {item.unit || item.product.unit} — {formatINR(item.totalPrice)}</li>)}
                        </ul>
                        <p className="mt-2 text-sm text-gray-600">Delivery: {sellerOrder.deliveryMethod || order.deliveryMethod} · {sellerOrder.deliveryAddress || order.deliveryAddress}</p>
                        {sellerOrder.trackingReference && <p className="mt-1 text-sm font-medium text-teal-800">Tracking reference: {sellerOrder.trackingReference}</p>}
                        {sellerOrder.statusEvents?.length > 0 && (
                          <ol className="mt-3 flex flex-wrap gap-2">
                            {sellerOrder.statusEvents.map(event => <li className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600" key={event.id}>{event.status.replaceAll('_', ' ')} · {new Date(event.createdAt).toLocaleString('en-IN')}</li>)}
                          </ol>
                        )}
                        {sellerOrder.invoices?.map(invoice => (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3" key={invoice.id}>
                            <span className="text-sm text-gray-700">Invoice {invoice.invoiceNo} · Total {formatINR(invoice.grandTotal)}</span>
                            <button type="button" className="btn-ghost" onClick={() => downloadInvoice(sellerOrder, invoice)}><Download size={15} /> Download invoice</button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 border-t border-gray-100 pt-3 text-right text-sm">
                    <p>Subtotal {formatINR(order.subtotal)} · Estimated tax {formatINR(order.taxAmount)} · Delivery {formatINR(order.deliveryCharge)}</p>
                    <p className="text-lg font-bold text-gray-900">Total {formatINR(order.totalAmount)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="card text-center text-gray-500">You haven’t placed an order yet.</div>}
        </section>
      </main>
    </div>
  );
}
