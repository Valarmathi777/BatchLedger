import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const customerLogin = /"role"\s*:\s*"CUSTOMER"/.test(localStorage.getItem('bl_user') || '');
      localStorage.removeItem('bl_token');
      localStorage.removeItem('bl_user');
      window.location.href = customerLogin ? '/login?portal=customer' : '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  registerCustomer: (data) => api.post('/auth/register-customer', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  charts: () => api.get('/dashboard/charts'),
};

// ── Master data ───────────────────────────────────────────────────────────────
export const customersApi = {
  list: () => api.get('/customers'),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
};

export const suppliersApi = {
  list: () => api.get('/suppliers'),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
};

export const productsApi = {
  list: () => api.get('/products'),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
};

export const materialsApi = {
  list: () => api.get('/materials'),
  get: (id) => api.get(`/materials/${id}`),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
};

// ── BOM ───────────────────────────────────────────────────────────────────────
export const bomsApi = {
  list: () => api.get('/boms'),
  get: (id) => api.get(`/boms/${id}`),
  create: (data) => api.post('/boms', data),
};

// ── Purchases ─────────────────────────────────────────────────────────────────
export const purchasesApi = {
  list: () => api.get('/purchases'),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
};

// ── Stock ─────────────────────────────────────────────────────────────────────
export const stockApi = {
  materials: () => api.get('/stock/materials'),
  products: () => api.get('/stock/products'),
  movements: (params) => api.get('/stock/movements', { params }),
};

// ── Production ────────────────────────────────────────────────────────────────
export const productionApi = {
  list: () => api.get('/production'),
  get: (id) => api.get(`/production/${id}`),
  create: (data) => api.post('/production', data),
  complete: (id, data) => api.post(`/production/${id}/complete`, data),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: () => api.get('/orders'),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  approve: (id) => api.post(`/orders/${id}/approve`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
};

// ── Invoices ──────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: () => api.get('/invoices'),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  cancel: (id, data) => api.post(`/invoices/${id}/cancel`, data),
};

// ── Dispatch ──────────────────────────────────────────────────────────────────
export const dispatchApi = {
  list: () => api.get('/dispatch'),
  create: (data) => api.post('/dispatch', data),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: () => api.get('/payments'),
  create: (data) => api.post('/payments', data),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  sales: (params) => api.get('/reports/sales', { params }),
  gst: (params) => api.get('/reports/gst', { params }),
  stock: () => api.get('/reports/stock'),
  production: (params) => api.get('/reports/production', { params }),
  costing: (runId) => api.get(`/reports/costing/${runId}`),
  collections: () => api.get('/reports/collections'),
  auditExplorer: (invoiceId) => api.get(`/reports/audit-explorer/${invoiceId}`),
};

// ── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
};

// ── Audit ────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params) => api.get('/audit', { params }),
};
