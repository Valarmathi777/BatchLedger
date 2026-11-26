import { useEffect, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { reportsApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Reports() {
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState(null);
  const [gst, setGst] = useState(null);
  const [collections, setCollections] = useState(null);
  const [production, setProduction] = useState([]);
  const [costing, setCosting] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([reportsApi.stock(), reportsApi.gst(), reportsApi.collections(), reportsApi.production()])
      .then(([s, g, c, p]) => { setStock(s.data); setGst(g.data); setCollections(c.data); setProduction(p.data); })
      .catch(() => toast.error('Load failed'))
      .finally(() => setLoading(false));
  }, []);

  const loadCosting = async (runId) => {
    try { const r = await reportsApi.costing(runId); setCosting(r.data); } catch { toast.error('Costing load failed'); }
  };

  const tabs = ['stock', 'gst', 'collections', 'production', 'costing'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Sales, GST, Stock, Production, Costing, Collections</p>
        </div>
      </div>
      <div className="page-body space-y-4">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} text-xs capitalize`}>{t}</button>
          ))}
        </div>

        {tab === 'stock' && stock && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Raw Material Stock</h3>
              <table className="tbl">
                <thead><tr><th>Material</th><th>Unit</th><th>Qty</th><th>Avg Cost</th><th>Value</th></tr></thead>
                <tbody>
                  {stock.rawMaterials.map((m, i) => <tr key={i}><td>{m.name}</td><td>{m.unit}</td><td className="font-mono">{m.qty?.toFixed(3)}</td><td>{fmtINR(m.avgCost)}</td><td className="font-semibold">{fmtINR(m.totalValue)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-3">Finished Goods Stock</h3>
              <table className="tbl">
                <thead><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Avg Cost</th><th>Value</th></tr></thead>
                <tbody>
                  {stock.finishedGoods.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.unit}</td><td className="font-mono">{p.qty?.toFixed(0)}</td><td>{fmtINR(p.avgCost)}</td><td className="font-semibold">{fmtINR(p.totalValue)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'gst' && gst && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['Taxable', gst.totals.taxable], ['CGST', gst.totals.cgst], ['SGST', gst.totals.sgst], ['IGST', gst.totals.igst]].map(([l, v]) => (
                <div key={l} className="card text-center"><div className="text-xs text-gray-500 mb-1">{l}</div><div className="text-lg font-bold">{fmtINR(v)}</div></div>
              ))}
            </div>
            <div className="card overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
                <tbody>
                  {gst.invoices.map(inv => (
                    <tr key={inv.id}><td className="font-mono text-xs">{inv.invoiceNo}</td><td>{inv.customer?.name}</td><td>{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td><td>{fmtINR(inv.taxableAmount)}</td><td>{fmtINR(inv.cgst)}</td><td>{fmtINR(inv.sgst)}</td><td>{fmtINR(inv.igst)}</td><td className="font-bold">{fmtINR(inv.grandTotal)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'collections' && collections && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="card text-center"><div className="text-xs text-gray-500 mb-1">Total Outstanding</div><div className="text-2xl font-bold text-red-600">{fmtINR(collections.totals.totalDue)}</div></div>
              <div className="card text-center"><div className="text-xs text-gray-500 mb-1">Total Collected</div><div className="text-2xl font-bold text-green-600">{fmtINR(collections.totals.totalPaid)}</div></div>
            </div>
            <div className="card overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {collections.invoices.map(inv => (
                    <tr key={inv.id}><td className="font-mono text-xs">{inv.invoiceNo}</td><td>{inv.customer?.name}</td><td>{fmtINR(inv.grandTotal)}</td><td className="text-green-600">{fmtINR(inv.amountPaid)}</td><td className="font-bold text-red-600">{fmtINR(inv.amountDue)}</td><td><span className={`badge ${inv.paymentStatus === 'PARTIAL' ? 'badge-yellow' : 'badge-red'}`}>{inv.paymentStatus}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'production' && (
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Batch</th><th>Product</th><th>Planned</th><th>Actual</th><th>Yield%</th><th>Date</th><th>Costing</th></tr></thead>
              <tbody>
                {production.map(run => {
                  const yield_ = run.plannedOutput > 0 ? ((run.actualOutput - run.plannedOutput) / run.plannedOutput * 100).toFixed(1) : 0;
                  return (
                    <tr key={run.id}>
                      <td className="font-mono text-xs text-teal-700">{run.batchNo}</td>
                      <td>{run.product?.name}</td>
                      <td>{run.plannedOutput}</td>
                      <td>{run.actualOutput}</td>
                      <td className={yield_ < -3 ? 'text-red-600 font-bold' : 'text-green-600'}>{yield_}%</td>
                      <td>{new Date(run.productionDate).toLocaleDateString('en-IN')}</td>
                      <td><button onClick={() => loadCosting(run.id)} className="btn-ghost py-1 px-2 text-xs">View Costing</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'costing' && (
          <div>
            {costing ? (
              <div className="card">
                <h3 className="font-bold text-gray-800 mb-4">Batch Costing – {costing.run.batchNo}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[['Material Cost', costing.costing.materialCost], ['Expense Cost', costing.costing.expenseCost], ['Total Cost', costing.costing.totalCost], ['Cost/Packet', costing.costing.costPerPacket]].map(([l, v]) => (
                    <div key={l} className="text-center"><div className="text-xs text-gray-500 mb-1">{l}</div><div className="text-xl font-bold text-teal-700">{fmtINR(v)}</div></div>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Costing Assumptions</h4>
                  <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                    {costing.costing.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="card text-center py-8 text-gray-400">Select a production run from the Production tab to view costing</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
