import { useEffect, useState } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { ordersApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Orders() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { ordersApi.list().then(r => setData(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); };
  useEffect(load, []);

  const approve = async (id) => {
    try { await ordersApi.approve(id); toast.success('Order approved'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Approval failed'); }
  };

  const statusBadge = s => ({ DRAFT: 'badge-gray', PENDING_APPROVAL: 'badge-yellow', APPROVED: 'badge-blue', DISPATCHED: 'badge-green', CANCELLED: 'badge-red' }[s] || 'badge-gray');

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold text-gray-900">Sales Orders</h1>
      </div>
      <div className="page-body">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Order No</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Shortage</th><th>Action</th></tr></thead>
            <tbody>
              {data.map(o => {
                const hasShortage = o.items?.some(i => i.shortageQty > 0);
                return (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.orderNo}</td>
                    <td>{o.customer?.name}</td>
                    <td>{new Date(o.orderDate).toLocaleDateString('en-IN')}</td>
                    <td className="font-semibold">{fmtINR(o.totalAmount)}</td>
                    <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                    <td>
                      {hasShortage
                        ? <span className="text-red-600 text-xs font-semibold">⚠ Shortage: {o.items?.reduce((s, i) => s + i.shortageQty, 0)} units</span>
                        : <span className="text-green-600 text-xs">✓ Available</span>
                      }
                    </td>
                    <td>
                      {o.status === 'PENDING_APPROVAL' && !hasShortage && (
                        <button onClick={() => approve(o.id)} className="btn-primary py-1 px-2 text-xs">Approve</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && !data.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No orders</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
