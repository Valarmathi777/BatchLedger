import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { invoicesApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Invoices() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { invoicesApi.list().then(r => setData(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  const statusBadge = s => ({ DRAFT: 'badge-gray', POSTED: 'badge-green', CANCELLED: 'badge-red', CREDIT_NOTE: 'badge-yellow' }[s] || 'badge-gray');
  const payBadge = s => ({ UNPAID: 'badge-red', PARTIAL: 'badge-yellow', PAID: 'badge-green' }[s] || 'badge-gray');

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold text-gray-900">GST Invoices</h1>
      </div>
      <div className="page-body">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Invoice No</th><th>Customer</th><th>Date</th><th>Taxable</th><th>GST</th><th>Total</th><th>Status</th><th>Payment</th><th>Due</th></tr></thead>
            <tbody>
              {data.map(inv => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs font-semibold">{inv.invoiceNo}</td>
                  <td>{inv.customer?.name}</td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                  <td>{fmtINR(inv.taxableAmount)}</td>
                  <td className="text-xs text-gray-500">{inv.isInterState ? `IGST ${fmtINR(inv.igst)}` : `C+S ${fmtINR(inv.cgst + inv.sgst)}`}</td>
                  <td className="font-bold">{fmtINR(inv.grandTotal)}</td>
                  <td><span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span></td>
                  <td><span className={`badge ${payBadge(inv.paymentStatus)}`}>{inv.paymentStatus}</span></td>
                  <td className={inv.amountDue > 0 ? 'font-semibold text-red-600' : 'text-green-600'}>{fmtINR(inv.amountDue)}</td>
                </tr>
              ))}
              {!loading && !data.length && <tr><td colSpan={9} className="text-center py-8 text-gray-400">No invoices</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
