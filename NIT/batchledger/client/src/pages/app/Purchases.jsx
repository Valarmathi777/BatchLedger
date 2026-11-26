import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { purchasesApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Purchases() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { purchasesApi.list().then(r => setData(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold text-gray-900">Purchases</h1>
      </div>
      <div className="page-body">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Purchase No</th><th>Supplier</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.purchaseNo}</td>
                  <td>{p.supplier?.name}</td>
                  <td>{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                  <td className="font-semibold">{fmtINR(p.totalAmount)}</td>
                  <td><span className="badge badge-green">{p.status}</span></td>
                </tr>
              ))}
              {!loading && !data.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No purchases recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
