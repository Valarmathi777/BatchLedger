import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, FileText, AlertTriangle, Factory, CreditCard, ShoppingCart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { dashboardApi } from '../../api/client';
import toast from 'react-hot-toast';

const fmtINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatCard({ icon: Icon, label, value, sub, color = 'teal' }) {
  const colors = { teal: 'bg-teal-100 text-teal-700', blue: 'bg-blue-100 text-blue-700', red: 'bg-red-100 text-red-700', orange: 'bg-orange-100 text-orange-700', purple: 'bg-purple-100 text-purple-700' };
  return (
    <div className="stat-card">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const COLORS = ['#14b8a6', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444'];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([dashboardApi.summary(), dashboardApi.charts()])
      .then(([s, c]) => { setSummary(s.data); setCharts(c.data); })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-body flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Sri Murugan Snacks – Live Overview</p>
        </div>
        <div className="text-sm text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="page-body space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={TrendingUp} label="Total Revenue" value={fmtINR(summary?.totalRevenue)} color="teal" />
          <StatCard icon={CreditCard} label="Outstanding Dues" value={fmtINR(summary?.totalDue)} color="red" />
          <StatCard icon={FileText} label="Total Orders" value={summary?.totalOrders ?? 0} color="blue" />
          <StatCard icon={Factory} label="Active Production" value={summary?.activeProductionRuns ?? 0} sub="runs in progress" color="orange" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 card">
            <h3 className="font-semibold text-gray-800 mb-4">Revenue (last 6 months)</h3>
            {charts?.revenueByMonth?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmtINR(v)} />
                  <Bar dataKey="revenue" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="gst" fill="#0d9488" radius={[4, 4, 0, 0]} name="GST" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No revenue data yet</div>
            )}
          </div>

          {/* Stock summary */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Stock Snapshot</h3>
            {charts?.stockSummary?.length > 0 ? (
              <div className="space-y-3">
                {charts.stockSummary.slice(0, 7).map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-700 truncate max-w-[130px]">{s.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{s.qty.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm">No stock data</div>}
          </div>
        </div>

        {/* Flagged variances */}
        {charts?.flaggedVariances?.length > 0 && (
          <div className="card border-orange-100 bg-orange-50">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-orange-600" />
              <h3 className="font-semibold text-orange-800">Variance Intelligence – Flagged Items</h3>
            </div>
            <div className="space-y-2">
              {charts.flaggedVariances.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Batch {v.productionRun?.batchNo} · {v.varianceType} · {v.notes}</span>
                  <span className={`font-bold ${v.variancePct < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {v.variancePct > 0 ? '+' : ''}{v.variancePct?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders & pending payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Recent Orders</h3>
            <table className="tbl">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th></tr></thead>
              <tbody>
                {summary?.recentOrders?.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.orderNo}</td>
                    <td>{o.customer?.name}</td>
                    <td><span className={`badge ${o.status === 'DISPATCHED' ? 'badge-green' : o.status === 'APPROVED' ? 'badge-blue' : o.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Pending Payments</h3>
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Due</th></tr></thead>
              <tbody>
                {summary?.pendingPayments?.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs">{inv.invoiceNo}</td>
                    <td>{inv.customer?.name}</td>
                    <td className="font-semibold text-red-600">{fmtINR(inv.amountDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
