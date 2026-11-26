import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { stockApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function StockLedger() {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('materials');

  useEffect(() => {
    Promise.all([stockApi.materials(), stockApi.products(), stockApi.movements({ limit: 50 })])
      .then(([m, p, mv]) => { setMaterials(m.data); setProducts(p.data); setMovements(mv.data); })
      .catch(() => toast.error('Load failed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock Ledger</h1>
          <p className="text-sm text-gray-500">Real-time inventory with weighted-average costing</p>
        </div>
      </div>
      <div className="page-body space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          {['materials', 'products', 'movements'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} text-xs capitalize`}>{t}</button>
          ))}
        </div>

        <div className="card overflow-x-auto">
          {tab === 'materials' && (
            <table className="tbl">
              <thead><tr><th>Material</th><th>Unit</th><th>Qty in Stock</th><th>Avg Cost</th><th>Total Value</th></tr></thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.materialId}>
                    <td className="font-semibold">{m.material?.name}</td>
                    <td>{m.material?.unit}</td>
                    <td className="font-mono">{m.currentQty.toFixed(3)}</td>
                    <td className="font-mono">{fmtINR(m.avgCost)}</td>
                    <td className="font-semibold">{fmtINR(m.totalValue)}</td>
                  </tr>
                ))}
                {!loading && !materials.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No stock</td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'products' && (
            <table className="tbl">
              <thead><tr><th>Product</th><th>Unit</th><th>Qty in Stock</th><th>Avg Cost</th><th>Total Value</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.productId}>
                    <td className="font-semibold">{p.product?.name}</td>
                    <td>{p.product?.unit}</td>
                    <td className="font-mono">{p.currentQty.toFixed(0)}</td>
                    <td className="font-mono">{fmtINR(p.avgCost)}</td>
                    <td className="font-semibold">{fmtINR(p.totalValue)}</td>
                  </tr>
                ))}
                {!loading && !products.length && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No finished goods stock</td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'movements' && (
            <table className="tbl">
              <thead><tr><th>Type</th><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Balance</th><th>Date</th><th>Ref</th></tr></thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td><span className={`badge ${m.quantity > 0 ? 'badge-green' : 'badge-red'}`}>{m.movementType}</span></td>
                    <td>{m.material?.name || m.product?.name || '-'}</td>
                    <td className={m.quantity > 0 ? 'text-green-700 font-mono' : 'text-red-600 font-mono'}>{m.quantity > 0 ? '+' : ''}{m.quantity.toFixed(3)}</td>
                    <td className="font-mono">{fmtINR(m.unitCost)}</td>
                    <td className="font-mono">{m.balanceQty.toFixed(3)}</td>
                    <td className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="text-xs text-gray-400">{m.referenceType} #{m.referenceId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
