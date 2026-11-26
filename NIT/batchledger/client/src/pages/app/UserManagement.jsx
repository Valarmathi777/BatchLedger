import { useEffect, useState } from 'react';
import { Settings, UserPlus } from 'lucide-react';
import { usersApi } from '../../api/client';
import toast from 'react-hot-toast';

const ROLE_BADGE = { ADMIN: 'badge-red', SALESMAN: 'badge-blue', PRODUCTION_SUPERVISOR: 'badge-yellow', AUDITOR: 'badge-gray' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { usersApi.list().then(r => setUsers(r.data)).catch(() => toast.error('Load failed')).finally(() => setLoading(false)); }, []);

  const toggleActive = async (user) => {
    try {
      await usersApi.update(user.id, { isActive: !user.isActive });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      toast.success(`User ${!user.isActive ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Update failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-bold text-gray-900">User Management</h1>
      </div>
      <div className="page-body">
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="font-semibold">{u.name}</td>
                  <td className="text-gray-500 text-xs">{u.email}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-gray'}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td><button onClick={() => toggleActive(u)} className={`btn text-xs py-1 px-2 ${u.isActive ? 'btn-ghost' : 'btn-primary'}`}>{u.isActive ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
