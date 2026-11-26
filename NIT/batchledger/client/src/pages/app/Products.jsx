import { useEffect, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { productsApi } from '../../api/client';
import toast from 'react-hot-toast';

export default function Products() {
  const [data, setData] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { productsApi.list().then(r => setData(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  const filtered = data.filter(row => JSON.stringify(row).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{filtered.length} records</p>
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input className="input pl-9" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>
          {loading ? <div className="text-center py-8 text-gray-400">Loading…</div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>code</th><th>name</th><th>unit</th><th>gstRate</th><th>sellingPrice</th></tr></thead>
                <tbody>
                  {filtered.map(row => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.unit}</td><td>{row.gstRate}</td><td>{row.sellingPrice}</td></tr>)}
                  {!filtered.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No records found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
