import { useEffect, useState } from 'react';
import { Factory, AlertTriangle, CheckCircle } from 'lucide-react';
import { productionApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Production() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { productionApi.list().then(r => setRuns(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  const statusBadge = s => ({ PLANNED: 'badge-yellow', IN_PROGRESS: 'badge-blue', COMPLETED: 'badge-green', CANCELLED: 'badge-red' }[s] || 'badge-gray');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Production Runs</h1>
          <p className="text-sm text-gray-500">Batch DNA – Recipe to Finished Goods</p>
        </div>
      </div>
      <div className="page-body space-y-4">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Batch No</th><th>Product</th><th>Planned</th><th>Actual</th><th>Damaged</th><th>Status</th><th>Variances</th></tr></thead>
            <tbody>
              {runs.map(run => {
                const flagged = run.variances?.filter(v => v.isFlagged) || [];
                return (
                  <tr key={run.id} className="cursor-pointer" onClick={() => setSelected(selected?.id === run.id ? null : run)}>
                    <td className="font-mono text-xs font-semibold text-teal-700">{run.batchNo}</td>
                    <td>{run.product?.name}</td>
                    <td>{run.plannedOutput}</td>
                    <td>{run.actualOutput}</td>
                    <td>{run.damagedQty}</td>
                    <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                    <td>
                      {flagged.length > 0
                        ? <span className="flex items-center gap-1 text-orange-600 text-xs font-semibold"><AlertTriangle size={13} /> {flagged.length} flagged</span>
                        : <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={13} /> OK</span>
                      }
                    </td>
                  </tr>
                );
              })}
              {!loading && !runs.length && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No production runs</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Batch DNA Detail */}
        {selected && (
          <div className="card border-teal-100">
            <h3 className="font-bold text-gray-800 mb-3">Batch DNA – {selected.batchNo}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Issues */}
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Material Issues</h4>
                <table className="tbl text-xs">
                  <thead><tr><th>Material</th><th>Standard</th><th>Actual</th><th>Variance</th></tr></thead>
                  <tbody>
                    {selected.issues?.map(i => {
                      const v = selected.variances?.find(v => v.materialId === i.materialId && v.varianceType === 'MATERIAL');
                      return (
                        <tr key={i.id}>
                          <td>{i.material?.name}</td>
                          <td>{i.standardQty} {i.material?.unit}</td>
                          <td>{i.netQty} {i.material?.unit}</td>
                          <td className={v?.isFlagged ? 'text-orange-600 font-bold' : 'text-gray-500'}>
                            {v ? `${v.variancePct > 0 ? '+' : ''}${v.variancePct?.toFixed(1)}%${v.isFlagged ? ' ⚠' : ''}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Expenses & Yield */}
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Expenses & Yield</h4>
                <div className="space-y-2 text-sm">
                  {selected.expenses?.map(e => (
                    <div key={e.id} className="flex justify-between">
                      <span className="text-gray-600">{e.expenseType} – {e.description}</span>
                      <span className="font-semibold">{fmtINR(e.amount)}</span>
                    </div>
                  ))}
                  <hr className="my-2" />
                  {selected.variances?.filter(v => v.varianceType === 'YIELD').map(v => (
                    <div key={v.id} className="flex justify-between">
                      <span className="text-gray-600">Yield ({v.actualQty}/{v.standardQty})</span>
                      <span className={`font-bold ${v.isFlagged ? 'text-red-600' : 'text-green-600'}`}>
                        {v.variancePct?.toFixed(1)}% {v.isFlagged ? '🚨' : '✓'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
