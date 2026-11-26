import { useEffect, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { auditApi } from '../../api/client';
import toast from 'react-hot-toast';

const ACTION_BADGE = { CREATE: 'badge-green', UPDATE: 'badge-blue', DELETE: 'badge-red', LOGIN: 'badge-gray', LOGOUT: 'badge-gray', APPROVE: 'badge-blue', CANCEL: 'badge-red' };

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    auditApi.list({ limit: 100 }).then(r => { setLogs(r.data.logs); setTotal(r.data.total); }).catch(() => toast.error('Load failed')).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l => JSON.stringify(l).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">{total} total events</p>
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="mb-4 relative max-w-xs">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input pl-9" placeholder="Filter logs..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>IP</th></tr></thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                    <td className="text-xs">{log.user?.name || 'System'}<br /><span className="text-gray-400">{log.user?.role}</span></td>
                    <td><span className={`badge ${ACTION_BADGE[log.action] || 'badge-gray'}`}>{log.action}</span></td>
                    <td className="font-medium">{log.entity}</td>
                    <td className="font-mono text-xs">{log.entityId || '-'}</td>
                    <td className="text-xs text-gray-400">{log.ipAddress || '-'}</td>
                  </tr>
                ))}
                {!loading && !filtered.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No audit events</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
