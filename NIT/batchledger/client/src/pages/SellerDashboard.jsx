import { useCallback, useEffect, useState } from 'react';
import { LogOut, Package, Bell, ShoppingBag, Boxes, Factory, Receipt, LayoutDashboard, MessageCircle, Plus, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { messagesApi, notificationsApi, productionApi, sellerApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const tabs = [
  ['overview', 'Overview', LayoutDashboard],
  ['orders', 'Orders', ShoppingBag],
  ['products', 'Products', Package],
  ['inventory', 'Inventory', Boxes],
  ['materials', 'Raw materials', Boxes],
  ['boms', 'Bills of materials', Factory],
  ['production', 'Production', Factory],
  ['invoices', 'Invoices', Receipt],
  ['messages', 'Customer messages', MessageCircle],
  ['notifications', 'Notifications', Bell],
];
const nextStatuses = {
  ORDER_RECEIVED: ['ORDER_ACCEPTED', 'REJECTED'],
  PENDING_APPROVAL: ['ORDER_ACCEPTED', 'REJECTED'],
  ORDER_ACCEPTED: ['PRODUCTION_STARTED'],
  APPROVED: ['PRODUCTION_STARTED'],
  PRODUCTION_STARTED: ['PRODUCTION_IN_PROGRESS', 'QUALITY_CHECK'],
  PRODUCTION_IN_PROGRESS: ['QUALITY_CHECK'],
  QUALITY_CHECK: ['PRODUCTION_COMPLETED', 'PRODUCTION_IN_PROGRESS'],
  PRODUCTION_COMPLETED: ['READY_FOR_PACKAGING'],
  READY_FOR_PACKAGING: ['READY_FOR_DISPATCH'],
  READY_FOR_DISPATCH: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
};

function SellerOrderCard({ order, onStatusChange, saving }) {
  const [status, setStatus] = useState('');
  const [trackingReference, setTrackingReference] = useState(order.trackingReference || '');
  const [note, setNote] = useState('');
  const options = nextStatuses[order.status] || [];

  const submitStatus = async () => {
    if (!status) return;
    await onStatusChange(order, status, {
      note,
      ...(status === 'DISPATCHED' ? { trackingReference } : {}),
    });
    setStatus('');
    setNote('');
  };

  return (
    <article className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{order.orderNo}</h3>
          <p className="text-sm text-gray-500">Customer: {order.customer?.name} · {order.customer?.phone || order.customer?.email}</p>
        </div>
        <span className="badge badge-blue">{order.status.replaceAll('_', ' ')}</span>
      </div>
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <div className="font-medium text-gray-700">Items</div>
          <ul className="mt-1 space-y-1 text-gray-600">
            {order.items.map(item => (
              <li key={item.id}>
                {item.product.name} · {item.displayQty ?? item.orderedQty} {item.unit || item.product.unit} — {money(item.totalPrice)}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-semibold text-gray-900">Items + delivery: {money(order.totalAmount)}</p>
        </div>
        <div className="text-gray-600">
          <div className="font-medium text-gray-700">Delivery address</div>
          <p className="mt-1 whitespace-pre-line">{order.deliveryAddress || order.customer?.address || 'No address supplied'}</p>
          <p className="mt-1">{order.deliveryMethod || 'Delivery method not selected'}</p>
          {order.trackingReference && <p className="mt-1">Tracking: {order.trackingReference}</p>}
          {order.specialInstructions && <p className="mt-2">Instructions: {order.specialInstructions}</p>}
        </div>
      </div>
      {order.statusEvents?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {order.statusEvents.map(event => (
            <span key={event.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {event.status.replaceAll('_', ' ')} · {new Date(event.createdAt).toLocaleString('en-IN')}
            </span>
          ))}
        </div>
      )}
      {options.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <label className="min-w-52 flex-1 text-sm text-gray-600">
            Update status
            <select className="input mt-1" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="">Choose next status</option>
              {options.map(option => <option value={option} key={option}>{option.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          {status === 'DISPATCHED' && (
            <label className="min-w-52 flex-1 text-sm text-gray-600">
              Tracking reference
              <input className="input mt-1" value={trackingReference} onChange={event => setTrackingReference(event.target.value)} maxLength={120} />
            </label>
          )}
          <label className="min-w-52 flex-1 text-sm text-gray-600">
            Note (optional)
            <input className="input mt-1" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} />
          </label>
          <button type="button" className="btn-primary" disabled={!status || saving} onClick={submitStatus}>
            {saving ? 'Saving…' : 'Update order'}
          </button>
        </div>
      )}
    </article>
  );
}

function ProductionRunCard({ run, onComplete, saving }) {
  const [actualOutput, setActualOutput] = useState(String(run.plannedOutput));
  const [issues, setIssues] = useState(() => (run.bom?.items || []).map(item => ({
    materialId: item.materialId,
    actualQty: String(item.quantity * (run.bom.batchSize ? run.plannedOutput / run.bom.batchSize : 1)),
    returnedQty: '0',
    name: item.material.name,
    unit: item.material.unit,
  })));
  const [expenseRows, setExpenseRows] = useState([{ expenseType: 'LABOUR', amount: '', description: '' }]);
  const materialCost = (run.issues || []).reduce((total, issue) => total + Number(issue.totalCost || 0), 0);
  const expenseCost = (run.expenses || []).reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const totalCost = materialCost + expenseCost;
  const costPerUnit = Number(run.actualOutput) > 0 ? totalCost / Number(run.actualOutput) : null;

  const submit = async event => {
    event.preventDefault();
    await onComplete(run, {
      actualOutput: Number(actualOutput),
      issues: issues.map(({ materialId, actualQty, returnedQty }) => ({
        materialId,
        actualQty: Number(actualQty),
        returnedQty: Number(returnedQty),
      })),
      expenses: expenseRows
        .filter(expense => Number(expense.amount) > 0)
        .map(expense => ({ ...expense, amount: Number(expense.amount) })),
    });
  };

  return (
    <article className="card space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div><h3 className="font-semibold text-gray-900">{run.batchNo} · {run.product.name}</h3><p className="text-sm text-gray-500">Order {run.order?.orderNo || '—'} · Planned {run.plannedOutput} {run.product.unit}</p></div>
        <span className="badge badge-blue">{run.status}</span>
      </div>
      {run.status === 'COMPLETED' ? (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          <p>Production recorded and inventory reconciled. Good output: {run.actualOutput} {run.product.unit}.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <p>Material cost: <strong>{money(materialCost)}</strong></p>
            <p>Labour and other expenses: <strong>{money(expenseCost)}</strong></p>
            <p>Total production cost: <strong>{money(totalCost)}</strong></p>
          </div>
          <p className="mt-2 font-semibold">{costPerUnit === null ? 'Cost per unit unavailable because output is zero.' : `Actual cost per ${run.product.unit}: ${money(costPerUnit)}`}</p>
          <p className="mt-1 text-xs text-green-700">Sales GST ({Number(run.product.gstRate || 0)}%) is calculated on the customer invoice.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 border-t border-gray-100 pt-4">
          <label className="block max-w-xs text-sm text-gray-600">Good output ({run.product.unit})
            <input className="input mt-1" type="number" min="0" step="0.001" required value={actualOutput} onChange={event => setActualOutput(event.target.value)} />
          </label>
          <div className="overflow-x-auto">
            <table className="tbl"><thead><tr><th>Seller-owned material</th><th>Actual used</th><th>Returned</th></tr></thead>
              <tbody>{issues.map((issue, index) => (
                <tr key={issue.materialId}><td>{issue.name} ({issue.unit})</td>
                  <td><input className="input min-w-28" type="number" min="0" step="0.001" value={issue.actualQty}
                    onChange={event => setIssues(current => current.map((item, position) => position === index ? { ...item, actualQty: event.target.value } : item))} /></td>
                  <td><input className="input min-w-28" type="number" min="0" step="0.001" value={issue.returnedQty}
                    onChange={event => setIssues(current => current.map((item, position) => position === index ? { ...item, returnedQty: event.target.value } : item))} /></td>
                </tr>
              ))}
                {!issues.length && <tr><td colSpan={3} className="text-gray-500">No raw materials listed on this BOM.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Production expenses</h3>
            {expenseRows.map((expense, index) => (
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]" key={index}>
                <label className="text-sm text-gray-600">Expense type
                  <select className="input mt-1" value={expense.expenseType} onChange={event => setExpenseRows(current =>
                    current.map((row, rowIndex) => rowIndex === index ? { ...row, expenseType: event.target.value } : row))}>
                    {['LABOUR', 'POWER', 'GAS', 'OTHER'].map(value => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-sm text-gray-600">Amount (₹)
                  <input className="input mt-1" type="number" min="0" step="0.01" value={expense.amount} onChange={event => setExpenseRows(current =>
                    current.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))} />
                </label>
                <label className="text-sm text-gray-600">Expense note
                  <input className="input mt-1" maxLength={200} value={expense.description} onChange={event => setExpenseRows(current =>
                    current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />
                </label>
                <button type="button" className="btn-ghost" disabled={expenseRows.length === 1}
                  onClick={() => setExpenseRows(current => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setExpenseRows(current =>
              [...current, { expenseType: 'OTHER', amount: '', description: '' }])}><Plus size={15} />Add expense</button>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Recording…' : 'Complete ERP production run'}</button>
        </form>
      )}
    </article>
  );
}

export default function SellerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({ materials: [], products: [] });
  const [production, setProduction] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [replyTexts, setReplyTexts] = useState({});
  const [rawMaterials, setRawMaterials] = useState([]);
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [savingRunId, setSavingRunId] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: '', unit: 'packet', sellingPrice: '', description: '', gstRate: '5' });
  const [productDrafts, setProductDrafts] = useState({});
  const [savingProduct, setSavingProduct] = useState(false);
  const [materialForm, setMaterialForm] = useState({ name: '', unit: 'kg', reorderLevel: '0' });
  const [receiptForm, setReceiptForm] = useState({ materialId: '', quantity: '', unitCost: '', notes: '' });
  const [bomForm, setBomForm] = useState({ productId: '', batchSize: '', items: [{ materialId: '', quantity: '' }] });
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [savingBom, setSavingBom] = useState(false);

  const loadWorkspace = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [dashboardResult, ordersResult, productsResult, inventoryResult, productionResult, invoicesResult, notificationsResult, threadResult, materialsResult, bomsResult] = await Promise.all([
        sellerApi.dashboard(),
        sellerApi.orders(),
        sellerApi.products(),
        sellerApi.inventory(),
        sellerApi.production(),
        sellerApi.invoices(),
        notificationsApi.list(),
        messagesApi.threads(),
        sellerApi.materials(),
        sellerApi.boms(),
      ]);
      setDashboard(dashboardResult.data);
      setOrders(ordersResult.data);
      setProducts(productsResult.data);
      setInventory(inventoryResult.data);
      setProduction(productionResult.data);
      setInvoices(invoicesResult.data);
      setNotifications(notificationsResult.data);
      setMessageThreads(threadResult.data);
      setRawMaterials(materialsResult.data);
      setBoms(bomsResult.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load the seller workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadWorkspace();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace]);

  const updateOrder = async (order, status, details) => {
    setSavingOrderId(order.id);
    try {
      await sellerApi.updateOrderStatus(order.id, status, details);
      toast.success(`Order updated: ${status.replaceAll('_', ' ').toLowerCase()}.`);
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update this order.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const toggleProduct = async product => {
    try {
      await sellerApi.updateProduct(product.id, { isAvailable: !product.isAvailable });
      toast.success(`${product.name} is now ${product.isAvailable ? 'hidden' : 'available'} in the marketplace.`);
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update product availability.');
    }
  };

  const createProduct = async event => {
    event.preventDefault();
    setSavingProduct(true);
    try {
      await sellerApi.createProduct({
        ...productForm,
        sellingPrice: Number(productForm.sellingPrice),
        gstRate: Number(productForm.gstRate),
      });
      setProductForm({ name: '', category: '', unit: 'packet', sellingPrice: '', description: '', gstRate: '5' });
      toast.success('Product added and listed in your workspace.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not add product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const saveProductDetails = async product => {
    const draft = productDrafts[product.id] || {};
    try {
      await sellerApi.updateProduct(product.id, {
        name: draft.name ?? product.name,
        category: draft.category ?? product.category ?? '',
        sellingPrice: Number(draft.sellingPrice ?? product.sellingPrice),
        gstRate: Number(draft.gstRate ?? product.gstRate),
        preparationMinutes: Number(draft.preparationMinutes ?? product.preparationMinutes),
        description: draft.description ?? product.description ?? '',
      });
      setProductDrafts(current => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      toast.success(`Product details updated for ${draft.name || product.name}.`);
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update product details.');
    }
  };

  const completeRun = async (run, data) => {
    setSavingRunId(run.id);
    try {
      await productionApi.complete(run.id, data);
      toast.success('Production output, material usage, and expenses recorded.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not complete the production run.');
    } finally {
      setSavingRunId(null);
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

  const sendReply = async (thread) => {
    const body = replyTexts[thread.user.id]?.trim();
    if (!body) return;
    try {
      await messagesApi.send({
        receiverId: thread.user.id,
        productId: thread.product?.id,
        body,
      });
      setReplyTexts(current => ({ ...current, [thread.user.id]: '' }));
      await loadWorkspace();
      toast.success('Reply sent.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not send reply.');
    }
  };

  const createMaterial = async event => {
    event.preventDefault();
    setSavingMaterial(true);
    try {
      const { data: material } = await sellerApi.createMaterial({
        ...materialForm,
        reorderLevel: Number(materialForm.reorderLevel),
      });
      setMaterialForm({ name: '', unit: 'kg', reorderLevel: '0' });
      setReceiptForm(current => ({ ...current, materialId: String(material.id) }));
      toast.success('Raw material added.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not add raw material.');
    } finally {
      setSavingMaterial(false);
    }
  };

  const receiveMaterial = async event => {
    event.preventDefault();
    setSavingReceipt(true);
    try {
      await sellerApi.receiveMaterial(receiptForm.materialId, {
        quantity: Number(receiptForm.quantity),
        unitCost: Number(receiptForm.unitCost),
        notes: receiptForm.notes,
      });
      setReceiptForm(current => ({ ...current, quantity: '', unitCost: '', notes: '' }));
      toast.success('Raw material receipt recorded and average cost updated.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not record raw material receipt.');
    } finally {
      setSavingReceipt(false);
    }
  };

  const createBom = async event => {
    event.preventDefault();
    setSavingBom(true);
    try {
      const materialById = new Map(rawMaterials.map(material => [String(material.id), material]));
      await sellerApi.createBom({
        productId: Number(bomForm.productId),
        batchSize: Number(bomForm.batchSize),
        items: bomForm.items.map(item => ({
          materialId: Number(item.materialId),
          quantity: Number(item.quantity),
          unit: materialById.get(item.materialId)?.unit,
        })),
      });
      setBomForm({ productId: '', batchSize: '', items: [{ materialId: '', quantity: '' }] });
      toast.success('BOM version created. The previous version remains in the history.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not create BOM.');
    } finally {
      setSavingBom(false);
    }
  };

  const signOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not sign out. Please try again.');
    }
  };

  const content = () => {
    if (loading) return <div className="card text-center text-gray-500">Loading seller data…</div>;
    if (tab === 'overview') return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Orders', dashboard?.totalOrders || 0],
            ['Needs attention', dashboard?.pendingOrders || 0],
            ['Sales', money(dashboard?.revenue)],
            ['Expenses', money(dashboard?.expenses)],
            ['Profit / loss', money(dashboard?.profit)],
          ].map(([label, value]) => <div className="card" key={label}><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-bold text-gray-900">{value}</p></div>)}
        </div>
        <div className="card"><h2 className="mb-4 font-semibold text-gray-900">Recent orders</h2><div className="space-y-4">{orders.slice(0, 4).map(order => <SellerOrderCard key={order.id} order={order} onStatusChange={updateOrder} saving={savingOrderId === order.id} />)}{!orders.length && <p className="text-sm text-gray-500">No marketplace orders yet.</p>}</div></div>
      </>
    );
    if (tab === 'orders') return <div className="space-y-4">{orders.map(order => <SellerOrderCard key={order.id} order={order} onStatusChange={updateOrder} saving={savingOrderId === order.id} />)}{!orders.length && <div className="card text-center text-gray-500">No orders yet.</div>}</div>;
    if (tab === 'products') return (
      <div className="space-y-5">
        <form onSubmit={createProduct} className="card space-y-3">
          <div className="flex items-center gap-2"><Plus size={18} className="text-teal-700" /><h2 className="font-semibold text-gray-900">Add a product you make</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm text-gray-600">Product name
              <input className="input mt-1" value={productForm.name} maxLength={100} onChange={event => setProductForm(current => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="text-sm text-gray-600">Category
              <input className="input mt-1" value={productForm.category} maxLength={80} onChange={event => setProductForm(current => ({ ...current, category: event.target.value }))} placeholder="Snacks" />
            </label>
            <label className="text-sm text-gray-600">Sell by / unit
              <input className="input mt-1" value={productForm.unit} maxLength={30} onChange={event => setProductForm(current => ({ ...current, unit: event.target.value }))} placeholder="packet, kg, piece" required />
            </label>
            <label className="text-sm text-gray-600">Customer price per unit (₹)
              <input className="input mt-1" type="number" min="0" step="0.01" value={productForm.sellingPrice} onChange={event => setProductForm(current => ({ ...current, sellingPrice: event.target.value }))} required />
            </label>
            <label className="text-sm text-gray-600">GST rate (%)
              <input className="input mt-1" type="number" min="0" max="100" step="0.01" value={productForm.gstRate} onChange={event => setProductForm(current => ({ ...current, gstRate: event.target.value }))} />
            </label>
            <label className="text-sm text-gray-600">Description
              <input className="input mt-1" value={productForm.description} maxLength={1000} onChange={event => setProductForm(current => ({ ...current, description: event.target.value }))} placeholder="Product details for customers" />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={savingProduct}><Plus size={16} />{savingProduct ? 'Adding…' : 'Add product'}</button>
        </form>
        <div className="grid gap-4 sm:grid-cols-2">
        {products.map(product => (
          <article className="card" key={product.id}>
            {product.imageUrl && <img src={product.imageUrl} alt="" className="mb-3 h-40 w-full rounded-lg object-cover" />}
            <h2 className="font-semibold text-gray-900">{product.name}</h2>
            <p className="mt-1 text-sm text-gray-500">{product.category || 'Uncategorized'} · {product.unit} · {product.preparationMinutes} min prep</p>
            <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); saveProductDetails(product); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-600">Product name
                  <input className="input mt-1" maxLength={100} value={productDrafts[product.id]?.name ?? product.name}
                    onChange={event => setProductDrafts(current => ({ ...current, [product.id]: { ...current[product.id], name: event.target.value } }))} required />
                </label>
                <label className="text-sm text-gray-600">Category
                  <input className="input mt-1" maxLength={80} value={productDrafts[product.id]?.category ?? product.category ?? ''}
                    onChange={event => setProductDrafts(current => ({ ...current, [product.id]: { ...current[product.id], category: event.target.value } }))} />
                </label>
                <label className="text-sm text-gray-600">Customer price per {product.unit} (₹)
                  <input className="input mt-1" type="number" min="0" step="0.01" value={productDrafts[product.id]?.sellingPrice ?? product.sellingPrice}
                    onChange={event => setProductDrafts(current => ({ ...current, [product.id]: { ...current[product.id], sellingPrice: event.target.value } }))} required />
                </label>
                <label className="text-sm text-gray-600">GST rate (%)
                  <input className="input mt-1" type="number" min="0" max="100" step="0.01" value={productDrafts[product.id]?.gstRate ?? product.gstRate}
                    onChange={event => setProductDrafts(current => ({ ...current, [product.id]: { ...current[product.id], gstRate: event.target.value } }))} required />
                </label>
                <label className="text-sm text-gray-600">Preparation time (minutes)
                  <input className="input mt-1" type="number" min="0" step="1" value={productDrafts[product.id]?.preparationMinutes ?? product.preparationMinutes}
                    onChange={event => setProductDrafts(current => ({ ...current, [product.id]: { ...current[product.id], preparationMinutes: event.target.value } }))} required />
                </label>
                <label className="text-sm text-gray-600">Description
                  <input className="input mt-1" maxLength={1000} value={productDrafts[product.id]?.description ?? product.description ?? ''}
                    onChange={event => setProductDrafts(current => ({ ...current, [product.id]: { ...current[product.id], description: event.target.value } }))} />
                </label>
              </div>
              <button type="submit" className="btn-ghost" aria-label={`Save product details for ${product.name}`}><Save size={16} /> Save details</button>
            </form>
            <p className="mt-1 text-sm text-gray-500">Finished stock: {product.stockLedger?.currentQty ?? 0}</p>
            <button type="button" className="btn-ghost mt-4" onClick={() => toggleProduct(product)}>{product.isAvailable ? 'Remove from marketplace' : 'List in marketplace'}</button>
          </article>
        ))}
        {!products.length && <div className="card text-gray-500">No products assigned to this seller.</div>}
        </div>
      </div>
    );
    if (tab === 'inventory') return (
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          ['Raw materials', inventory.materials, 'material'],
          ['Finished goods', inventory.products, 'product'],
        ].map(([title, rows, key]) => (
          <section className="card overflow-x-auto" key={title}>
            <h2 className="mb-3 font-semibold text-gray-900">{title}</h2>
            <table className="tbl"><thead><tr><th>Name</th><th>Quantity</th><th>Unit cost</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.id}><td>{row[key]?.name}</td><td>{row.currentQty} {row[key]?.unit || ''}</td><td>{money(row.avgCost)}</td></tr>)}
                {!rows.length && <tr><td colSpan={3} className="text-center text-gray-400">No assigned inventory.</td></tr>}</tbody>
            </table>
          </section>
        ))}
      </div>
    );
    if (tab === 'materials') return (
      <div className="space-y-5">
        <form onSubmit={createMaterial} className="card space-y-3">
          <div className="flex items-center gap-2"><Plus size={18} className="text-teal-700" /><h2 className="font-semibold text-gray-900">Add a raw material</h2></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-gray-600">Material name
              <input className="input mt-1" value={materialForm.name} maxLength={100}
                onChange={event => setMaterialForm(current => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="text-sm text-gray-600">Stock unit
              <input className="input mt-1" value={materialForm.unit} maxLength={30}
                onChange={event => setMaterialForm(current => ({ ...current, unit: event.target.value }))} placeholder="kg, L, piece" required />
            </label>
            <label className="text-sm text-gray-600">Reorder level
              <input className="input mt-1" type="number" min="0" step="0.001" value={materialForm.reorderLevel}
                onChange={event => setMaterialForm(current => ({ ...current, reorderLevel: event.target.value }))} required />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={savingMaterial}><Plus size={16} />{savingMaterial ? 'Adding…' : 'Add material'}</button>
        </form>

        <form onSubmit={receiveMaterial} className="card space-y-3">
          <h2 className="font-semibold text-gray-900">Record a stock receipt</h2>
          <p className="text-sm text-gray-500">Each receipt updates weighted-average unit cost, which is used in BOM and production costing.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-gray-600">Material
              <select className="input mt-1" value={receiptForm.materialId}
                onChange={event => setReceiptForm(current => ({ ...current, materialId: event.target.value }))} required>
                <option value="">Select a material</option>
                {rawMaterials.map(material => <option value={material.id} key={material.id}>{material.name} ({material.unit})</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-600">Quantity received
              <input className="input mt-1" type="number" min="0.001" step="0.001" value={receiptForm.quantity}
                onChange={event => setReceiptForm(current => ({ ...current, quantity: event.target.value }))} required />
            </label>
            <label className="text-sm text-gray-600">Cost per {rawMaterials.find(material => String(material.id) === receiptForm.materialId)?.unit || 'unit'} (₹)
              <input className="input mt-1" type="number" min="0" step="0.01" value={receiptForm.unitCost}
                onChange={event => setReceiptForm(current => ({ ...current, unitCost: event.target.value }))} required />
            </label>
            <label className="text-sm text-gray-600">Receipt note (optional)
              <input className="input mt-1" maxLength={200} value={receiptForm.notes}
                onChange={event => setReceiptForm(current => ({ ...current, notes: event.target.value }))} />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={savingReceipt || !rawMaterials.length}>
            {savingReceipt ? 'Recording…' : 'Record receipt'}
          </button>
        </form>

        <section className="card overflow-x-auto">
          <h2 className="mb-4 font-semibold text-gray-900">Producer raw materials</h2>
          <table className="tbl"><thead><tr><th>Name</th><th>Unit</th><th>Stock</th><th>Average cost / unit</th><th>Stock value</th></tr></thead>
            <tbody>{rawMaterials.map(material => {
              const quantity = Number(material.stockLedger?.currentQty || 0);
              const averageCost = Number(material.stockLedger?.avgCost || 0);
              return <tr key={material.id}><td>{material.name}</td><td>{material.unit}</td><td>{quantity}</td><td>{money(averageCost)}</td><td>{money(quantity * averageCost)}</td></tr>;
            })}
            {!rawMaterials.length && <tr><td colSpan={5} className="text-center text-gray-400">No raw materials yet.</td></tr>}</tbody>
          </table>
        </section>
      </div>
    );
    if (tab === 'boms') return (
      <div className="space-y-4">
        <form onSubmit={createBom} className="card space-y-4">
          <div className="flex items-center gap-2"><Plus size={18} className="text-teal-700" /><h2 className="font-semibold text-gray-900">Create a product BOM</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-600">Producer product
              <select className="input mt-1" value={bomForm.productId}
                onChange={event => setBomForm(current => ({ ...current, productId: event.target.value }))} required>
                <option value="">Select your product</option>
                {products.map(product => <option value={product.id} key={product.id}>{product.name} ({product.unit})</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-600">Batch output ({products.find(product => String(product.id) === bomForm.productId)?.unit || 'units'})
              <input className="input mt-1" type="number" min="0.001" step="0.001" value={bomForm.batchSize}
                onChange={event => setBomForm(current => ({ ...current, batchSize: event.target.value }))} required />
            </label>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Raw materials required for this batch</h3>
            {bomForm.items.map((item, index) => {
              const material = rawMaterials.find(candidate => String(candidate.id) === item.materialId);
              return (
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" key={index}>
                  <label className="text-sm text-gray-600">Material
                    <select className="input mt-1" value={item.materialId}
                      onChange={event => setBomForm(current => ({
                        ...current,
                        items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, materialId: event.target.value } : row),
                      }))} required>
                      <option value="">Select raw material</option>
                      {rawMaterials.map(option => <option value={option.id} key={option.id}>{option.name} ({option.unit})</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-gray-600">Quantity {material ? `(${material.unit})` : ''}
                    <input className="input mt-1" type="number" min="0.001" step="0.001" value={item.quantity}
                      onChange={event => setBomForm(current => ({
                        ...current,
                        items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row),
                      }))} required />
                  </label>
                  <button type="button" className="btn-ghost" disabled={bomForm.items.length === 1}
                    onClick={() => setBomForm(current => ({ ...current, items: current.items.filter((_, rowIndex) => rowIndex !== index) }))}>
                    Remove
                  </button>
                </div>
              );
            })}
            <button type="button" className="btn-ghost" onClick={() => setBomForm(current => ({
              ...current,
              items: [...current.items, { materialId: '', quantity: '' }],
            }))}><Plus size={15} />Add material row</button>
          </div>
          {!products.length && <p className="text-sm text-amber-700">Add a product before creating its BOM.</p>}
          {!rawMaterials.length && <p className="text-sm text-amber-700">Add raw materials before creating a BOM.</p>}
          <button type="submit" className="btn-primary" disabled={savingBom || !products.length || !rawMaterials.length}>
            {savingBom ? 'Saving…' : 'Save new BOM version'}
          </button>
        </form>
        {boms.map(bom => (
          <section className="card" key={bom.id}>
            <div className="flex justify-between gap-3"><h2 className="font-semibold text-gray-900">{bom.product.name}</h2><div className="flex gap-2"><span className="badge badge-blue">Version {bom.version}</span><span className={`badge ${bom.isActive ? 'badge-green' : 'badge-gray'}`}>{bom.isActive ? 'Active' : 'Archived'}</span></div></div>
            <p className="mt-1 text-sm text-gray-500">Batch size: {bom.batchSize} {bom.product.unit}</p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">{bom.items.map(item => <li key={item.id}>{item.material.name}: {item.quantity} {item.unit}</li>)}</ul>
            {(() => {
              const batchCost = bom.items.reduce((total, item) => {
                const material = rawMaterials.find(candidate => candidate.id === item.materialId);
                return total + Number(item.quantity) * Number(material?.stockLedger?.avgCost || 0);
              }, 0);
              const hasUncostedMaterials = bom.items.some(item => {
                const material = rawMaterials.find(candidate => candidate.id === item.materialId);
                return !material || Number(material.stockLedger?.avgCost || 0) === 0;
              });
              return <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-700">
                Estimated material cost: <strong>{money(batchCost)}</strong> per batch
                {Number(bom.batchSize) > 0 && <> · <strong>{money(batchCost / Number(bom.batchSize))}</strong> per {bom.product.unit}</>}
                <span className="mt-1 block text-xs text-gray-500">Estimate uses current weighted-average stock costs; production expenses are added to actual run costing.</span>
                {hasUncostedMaterials && <span className="mt-1 block text-xs text-amber-700">One or more materials have no priced stock receipt yet, so the estimate currently counts them at ₹0.</span>}
              </p>;
            })()}
          </section>
        ))}
        {!boms.length && <div className="card text-center text-gray-500">No bill of materials configured yet. Add your products and raw materials above to create a recipe.</div>}
      </div>
    );
    if (tab === 'production') return (
      <div className="space-y-4">
        {production.map(run => <ProductionRunCard key={run.id} run={run} onComplete={completeRun} saving={savingRunId === run.id} />)}
        {!production.length && <div className="card text-center text-gray-500">No production records.</div>}
      </div>
    );
    if (tab === 'invoices') return (
      <section className="card overflow-x-auto">
        <p className="mb-4 text-sm text-gray-500">Invoices are generated when an order reaches production complete. Customers can download the invoice PDF from their order history.</p>
        <table className="tbl"><thead><tr><th>Invoice</th><th>Order</th><th>Customer</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>GST type</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>{invoices.map(invoice => <tr key={invoice.id}>
            <td>{invoice.invoiceNo}</td><td>{invoice.order?.orderNo}</td><td>{invoice.customer?.name}</td>
            <td>{money(invoice.taxableAmount)}</td><td>{money(invoice.cgst)}</td><td>{money(invoice.sgst)}</td><td>{money(invoice.igst)}</td>
            <td>{invoice.isInterState ? 'IGST' : 'CGST + SGST'}</td><td>{money(invoice.deliveryCharge)}</td><td>{money(invoice.grandTotal)}</td><td>{invoice.status}</td>
          </tr>)}
            {!invoices.length && <tr><td colSpan={11} className="text-center text-gray-400">Invoices are generated when production completes.</td></tr>}</tbody>
        </table>
      </section>
    );
    if (tab === 'messages') return (
      <div className="space-y-4">
        {messageThreads.map(thread => (
          <section className="card" key={`${thread.user.id}-${thread.product?.id || 0}`}>
            <h2 className="font-semibold text-gray-900">{thread.user.name}</h2>
            {thread.product && <p className="mt-1 text-sm text-teal-700">Product: {thread.product.name}</p>}
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {thread.messages.map(message => (
                <div key={message.id} className={`rounded-lg px-3 py-2 text-sm ${message.senderId === user?.id ? 'ml-12 bg-teal-50' : 'mr-12 bg-gray-100'}`}>
                  <p>{message.body}</p>
                  <p className="mt-1 text-xs text-gray-500">{new Date(message.createdAt).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input className="input flex-1" maxLength={2000} value={replyTexts[thread.user.id] || ''}
                onChange={event => setReplyTexts(current => ({ ...current, [thread.user.id]: event.target.value }))}
                placeholder="Reply to customer…" />
              <button type="button" className="btn-primary" onClick={() => sendReply(thread)}><MessageCircle size={15} /> Send</button>
            </div>
          </section>
        ))}
        {!messageThreads.length && <div className="card text-center text-gray-500">No customer messages yet.</div>}
      </div>
    );
    return (
      <div className="space-y-3">
        {notifications.map(notification => (
          <button type="button" key={notification.id} onClick={() => markRead(notification)}
            className={`card w-full text-left ${notification.readAt ? 'opacity-70' : 'border-teal-200'}`}>
            <div className="flex justify-between gap-3"><span className="font-semibold text-gray-900">{notification.title}</span><span className="text-xs text-gray-500">{new Date(notification.createdAt).toLocaleString('en-IN')}</span></div>
            <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
          </button>
        ))}
        {!notifications.length && <div className="card text-center text-gray-500">No notifications.</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <div><h1 className="text-lg font-bold text-gray-900">BatchLedger · Seller workspace</h1><p className="text-sm text-gray-500">Welcome, {user?.name}</p></div>
        <button type="button" className="btn-ghost" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex gap-2 overflow-x-auto">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`btn whitespace-nowrap ${tab === id ? 'bg-teal-700 text-white' : 'bg-white text-gray-700'}`}>
              <Icon size={16} />{label}{id === 'notifications' && notifications.some(item => !item.readAt) ? ` (${notifications.filter(item => !item.readAt).length})` : ''}
            </button>
          ))}
        </nav>
        <main className="space-y-5">{content()}</main>
      </div>
    </div>
  );
}
