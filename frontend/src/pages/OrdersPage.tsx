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
        <div>
          <h2 className="page-title">Incoming Orders</h2>
          <p className="page-subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''} received from company</p>
        </div>
      </div>

      {/* Dispatcher info banner */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 8,
        padding: '10px 16px',
        fontSize: '0.85rem',
        color: '#1e40af',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
        <span>
          <strong>Dispatcher view:</strong> Orders are assigned by your logistics company and appear here automatically.
          Go to <strong>Routes</strong> to run the AI optimizer and dispatch drivers to these orders.
        </span>
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
        ? <div className="empty-state"><div className="empty-state-icon">📦</div><p>No company orders received yet.</p><p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: 4 }}>Orders assigned by your logistics company will appear here automatically.</p></div>
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

    </div>
  );
}

