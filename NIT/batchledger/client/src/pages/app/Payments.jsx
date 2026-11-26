import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { paymentsApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Payments() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { paymentsApi.list().then(r => setData(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header"><h1 className="text-xl font-bold text-gray-900">Payments</h1></div>
      <div className="page-body">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Payment No</th><th>Invoice</th><th>Customer</th><th>Date</th><th>Amount</th><th>Mode</th><th>Ref</th></tr></thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.paymentNo}</td>
                  <td className="font-mono text-xs">{p.invoice?.invoiceNo}</td>
                  <td>{p.customer?.name}</td>
                  <td>{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                  <td className="font-semibold text-green-700">{fmtINR(p.amount)}</td>
                  <td>{p.mode}</td>
                  <td className="text-xs text-gray-500">{p.referenceNo || '-'}</td>
                </tr>
              ))}
              {!loading && !data.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No payments</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
