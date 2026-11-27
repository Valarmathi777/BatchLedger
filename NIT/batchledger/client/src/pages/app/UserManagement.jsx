import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi, usersApi } from '../../api/client';
import { INDIAN_STATES } from '../../constants/indianStates';

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SALESMAN', label: 'Salesman' },
  { value: 'PRODUCTION_SUPERVISOR', label: 'Production Supervisor' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'SELLER', label: 'Seller' },
];

const EMPTY_FORM = { name: '', email: '', password: '', role: 'SALESMAN', productIds: [], businessState: 'Tamil Nadu|33' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadUsers = async () => {
    try {
      const [usersResult, productsResult] = await Promise.all([usersApi.list(), productsApi.list()]);
      setUsers(usersResult.data);
      setProducts(productsResult.data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, productIds: form.role === 'SELLER' ? form.productIds : [] };
      if (form.role === 'SELLER') {
        [payload.businessState, payload.businessStateCode] = form.businessState.split('|');
      } else {
        delete payload.businessState;
      }
      await usersApi.create(payload);
      setForm(EMPTY_FORM);
      toast.success('Account created.');
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Could not create account.');
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (user, changes) => {
    setUpdatingId(user.id);
    try {
      const { data } = await usersApi.update(user.id, changes);
      setUsers(current => current.map(item => item.id === data.id ? { ...item, ...data } : item));
      toast.success('Account updated.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not update account.');
      await loadUsers();
    } finally {
      setUpdatingId(null);
    }
  };

  const roleName = (role) => ROLES.find(item => item.value === role)?.label || role;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">Create staff accounts, assign roles, and deactivate access.</p>
      </header>

      <form onSubmit={createUser} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
          <UserPlus size={18} /> Create staff account
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-gray-700">
            Name
            <input required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Email
            <input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Temporary password
            <input required type="password" minLength={8} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Role
            <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal">
              {ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
        </div>
        {form.role === 'SELLER' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Business state for GST
              <select value={form.businessState} onChange={event => setForm({ ...form, businessState: event.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal">
                {INDIAN_STATES.map(([stateName, stateCode]) => (
                  <option key={stateCode} value={`${stateName}|${stateCode}`}>{stateName}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700">
              Assigned products
              <select multiple value={form.productIds.map(String)}
                onChange={event => setForm({ ...form, productIds: Array.from(event.target.selectedOptions, option => Number(option.value)) })}
                className="mt-1 h-32 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"
                aria-label="Products assigned to seller">
                {products.filter(product => !product.sellerId).map(product => <option key={product.id} value={product.id}>{product.name} · {product.unit}</option>)}
              </select>
              <span className="mt-1 block text-xs text-gray-500">Only unassigned products can be selected. Use Ctrl or Command to select multiple products.</span>
            </label>
          </div>
        )}
        <button type="submit" disabled={saving}
          className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
          {saving ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <Users size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Staff accounts</h2>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Loading accounts…</p>
        ) : users.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No staff accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Business state</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-5 py-3 text-gray-600">{user.email}</td>
                    <td className="px-5 py-3">
                      <select value={user.role} disabled={updatingId === user.id}
                        onChange={event => updateUser(user, { role: event.target.value })}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
                        aria-label={`Role for ${user.name}`}>
                        {ROLES.map(role => <option key={role.value} value={role.value}>{roleName(role.value)}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      {user.role === 'SELLER' ? (
                        <select value={user.businessState && user.businessStateCode ? `${user.businessState}|${user.businessStateCode}` : ''}
                          disabled={updatingId === user.id}
                          onChange={event => {
                            const [businessState, businessStateCode] = event.target.value.split('|');
                            updateUser(user, { businessState, businessStateCode });
                          }}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
                          aria-label={`Business state for ${user.name}`}>
                          {!user.businessState && <option value="">Configured default</option>}
                          {INDIAN_STATES.map(([stateName, stateCode]) => (
                            <option key={stateCode} value={`${stateName}|${stateCode}`}>{stateName}</option>
                          ))}
                        </select>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {user.role === 'SELLER' ? (
                        <select multiple value={(user.sellerProducts || []).map(product => String(product.id))}
                          disabled={updatingId === user.id}
                          onChange={event => updateUser(user, { productIds: Array.from(event.target.selectedOptions, option => Number(option.value)) })}
                          className="h-20 min-w-48 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs disabled:opacity-60"
                          aria-label={`Products assigned to ${user.name}`}>
                          {products.filter(product => !product.sellerId || product.sellerId === user.id).map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                        </select>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button type="button" disabled={updatingId === user.id}
                        onClick={() => updateUser(user, { isActive: !user.isActive })}
                        className="font-medium text-teal-700 hover:text-teal-900 disabled:opacity-50">
                        {user.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
