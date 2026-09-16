import { useEffect, useState } from 'react';
import * as api from '../api';
import type { Order, Warehouse } from '../types';
import { ApiError } from '../api/client';

const statusBadge = (s: string) => (
  <span className={`badge badge-${s.toLowerCase()}`}>{s}</span>
);

const priorityBadge = (p: string) => (
  <span className={`badge badge-${p.toLowerCase()}`}>{p}</span>
);

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchOrders = async () => {
    const params: Record<string, string> = {};
    if (filterStatus)    params.status = filterStatus;
    if (filterPriority)  params.priority = filterPriority;
    if (filterWarehouse) params.warehouseId = filterWarehouse;
    const data = await api.getOrders(params);
    setOrders(data);
  };

  useEffect(() => {
    Promise.all([api.getWarehouses()])
      .then(([wh]) => setWarehouses(wh))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [filterStatus, filterPriority, filterWarehouse]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await api.cancelOrder(id);
      await fetchOrders();
    } catch (e) {
      if (e instanceof ApiError) setActionError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this order? (Only PENDING/CANCELLED orders can be deleted)')) return;
    try {
      await api.deleteOrder(id);
      await fetchOrders();
    } catch (e) {
      if (e instanceof ApiError) setActionError(e.message);
    }
  };

  if (loading) return <div className="empty-state"><span className="spinner spinner-dark" /></div>;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="page-title">Orders</h2>
            <p className="page-subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''} shown</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Order
          </button>
        </div>
      </div>

      {actionError && (
        <div className="alert alert-error" onClick={() => setActionError('')} style={{ cursor: 'pointer' }}>
          {actionError} <small>(click to dismiss)</small>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['PENDING','ASSIGNED','DELIVERED','FAILED','CANCELLED'].map(s =>
            <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          {['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)}>
          <option value="">All Warehouses</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {(filterStatus || filterPriority || filterWarehouse) && (
          <button className="btn btn-outline btn-sm" onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterWarehouse(''); }}>
            Clear filters
          </button>
        )}
      </div>

      {orders.length === 0
        ? <div className="empty-state"><div className="empty-state-icon">📦</div><p>No orders found</p></div>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Priority</th>
                  <th>Weight</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{o.customerName}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address}</td>
                    <td>{priorityBadge(o.priority)}</td>
                    <td>{o.weightKg} kg</td>
                    <td>{statusBadge(o.status)}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {o.latestDelivery ? (
                        <span style={{
                          color: o.timeWindowStatus === 'VIOLATED' ? 'var(--red)' : o.timeWindowStatus === 'AT_RISK' ? 'var(--amber)' : 'inherit',
                          fontWeight: o.timeWindowStatus && o.timeWindowStatus !== 'NONE' ? 600 : 400
                        }}>
                          {new Date(o.latestDelivery).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          {o.timeWindowStatus === 'AT_RISK' && ' ⚠️'}
                          {o.timeWindowStatus === 'VIOLATED' && ' ❌'}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {o.status === 'PENDING' && (
                          <button className="btn btn-outline btn-sm" onClick={() => handleCancel(o.id)}>Cancel</button>
                        )}
                        {(o.status === 'PENDING' || o.status === 'CANCELLED') && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {showCreate && (
        <CreateOrderModal
          warehouses={warehouses}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchOrders(); }}
        />
      )}
    </div>
  );
}

// ── Create Order Modal ────────────────────────────────────────────────────────

function CreateOrderModal({ warehouses, onClose, onCreated }: {
  warehouses: Warehouse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    customerName: '', address: '', latitude: '', longitude: '',
    priority: 'MEDIUM', weightKg: '0', warehouseId: warehouses[0]?.id ?? '',
    latestDelivery: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.createOrder({
        customerName: form.customerName,
        address: form.address,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        priority: form.priority as 'HIGH' | 'MEDIUM' | 'LOW',
        weightKg: parseFloat(form.weightKg),
        warehouseId: form.warehouseId,
        ...(form.latestDelivery ? { latestDelivery: form.latestDelivery } : {}),
      });
      onCreated();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">New Order</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Customer Name</label>
              <input className="form-input" required value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="e.g. Rajesh Kumar" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Delivery Address</label>
              <input className="form-input" required value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. 12 Park Street, Bandra West" />
            </div>
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input className="form-input" type="number" step="any" required value={form.latitude} onChange={e => set('latitude', e.target.value)} placeholder="19.0596" />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input className="form-input" type="number" step="any" required value={form.longitude} onChange={e => set('longitude', e.target.value)} placeholder="72.8295" />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <input className="form-input" type="number" min="0" step="0.1" value={form.weightKg} onChange={e => set('weightKg', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Warehouse</label>
              <select className="form-select" value={form.warehouseId} onChange={e => set('warehouseId', e.target.value)} required>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deliver by (optional)</label>
              <input className="form-input" type="datetime-local" value={form.latestDelivery} onChange={e => set('latestDelivery', e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating…</> : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
