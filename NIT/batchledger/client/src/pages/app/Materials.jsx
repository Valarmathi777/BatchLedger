import { useEffect, useState } from 'react';
import { Boxes, Plus, Search } from 'lucide-react';
import { materialsApi, usersApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Materials() {
  const [data, setData] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([materialsApi.list(), user?.role === 'ADMIN' ? usersApi.list() : Promise.resolve({ data: [] })])
      .then(([materials, accounts]) => {
        setData(materials.data);
        setSellers(accounts.data.filter(account => account.role === 'SELLER' && account.isActive));
      })
      .catch(error => toast.error(error.response?.data?.error || 'Could not load materials.'))
      .finally(() => setLoading(false));
  }, [user?.role]);

  const filtered = data.filter(row => JSON.stringify(row).toLowerCase().includes(q.toLowerCase()));
  const assignSeller = async (material, value) => {
    try {
      const { data: updated } = await materialsApi.update(material.id, { sellerId: value ? Number(value) : null });
      setData(current => current.map(item => item.id === material.id ? { ...item, sellerId: updated.sellerId, seller: sellers.find(seller => seller.id === updated.sellerId) || null } : item));
      toast.success('Material ownership updated.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not assign material.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Materials</h1>
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
                <thead><tr><th>code</th><th>name</th><th>unit</th><th>reorderLevel</th>{user?.role === 'ADMIN' && <th>Seller owner</th>}</tr></thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.unit}</td><td>{row.reorderLevel}</td>
                      {user?.role === 'ADMIN' && <td><select className="input min-w-40" value={row.sellerId || ''} onChange={event => assignSeller(row, event.target.value)}>
                        <option value="">Unassigned</option>{sellers.map(seller => <option value={seller.id} key={seller.id}>{seller.name}</option>)}
                      </select></td>}
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={user?.role === 'ADMIN' ? 5 : 4} className="text-center py-8 text-gray-400">No records found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
