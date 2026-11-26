import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { bomsApi } from '../../api/client';
import toast from 'react-hot-toast';

export default function Boms() {
  const [boms, setBoms] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { bomsApi.list().then(r => setBoms(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bill of Materials</h1>
          <p className="text-sm text-gray-500">Recipe definitions per product batch</p>
        </div>
      </div>
      <div className="page-body space-y-4">
        {loading ? <div className="card text-center py-8 text-gray-400">Loading…</div> : boms.map(bom => (
          <div key={bom.id} className="card">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(e => ({ ...e, [bom.id]: !e[bom.id] }))}>
              <div className="flex items-center gap-3">
                <BookOpen size={18} className="text-teal-600" />
                <div>
                  <div className="font-semibold text-gray-900">{bom.product?.name}</div>
                  <div className="text-sm text-gray-500">Version {bom.version} · Batch size: {bom.batchSize} {bom.product?.unit}s</div>
                </div>
              </div>
              {expanded[bom.id] ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
            </div>
            {expanded[bom.id] && (
              <div className="mt-4 overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Material</th><th>Qty per batch</th><th>Unit</th></tr></thead>
                  <tbody>
                    {bom.items?.map(item => (
                      <tr key={item.id}>
                        <td>{item.material?.name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {!loading && !boms.length && <div className="card text-center py-8 text-gray-400">No BOMs defined</div>}
      </div>
    </div>
  );
}
