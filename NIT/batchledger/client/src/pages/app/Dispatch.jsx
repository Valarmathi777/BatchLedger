import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { dispatchApi } from '../../api/client';
import toast from 'react-hot-toast';

export default function Dispatch() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { dispatchApi.list().then(r => setData(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header"><h1 className="text-xl font-bold text-gray-900">Dispatch</h1></div>
      <div className="page-body">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Dispatch No</th><th>Invoice</th><th>Customer</th><th>Date</th><th>Vehicle</th></tr></thead>
            <tbody>
              {data.map(d => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.dispatchNo}</td>
                  <td className="font-mono text-xs">{d.invoice?.invoiceNo}</td>
                  <td>{d.invoice?.customer?.name}</td>
                  <td>{new Date(d.dispatchDate).toLocaleDateString('en-IN')}</td>
                  <td>{d.vehicleNo || '-'}</td>
                </tr>
              ))}
              {!loading && !data.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No dispatches</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
