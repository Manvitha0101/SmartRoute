import { useEffect, useState, useCallback } from 'react';
import * as api from '../api';
import type { AnalyticsSummary } from '../types';

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      setError('');
      const summary = await api.getAnalyticsSummary();
      setData(summary);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-dark" />
        <p style={{ marginTop: 12, color: 'var(--text-3)' }}>Loading admin overview…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter">
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div><strong>Error:</strong> {error}</div>
          <button className="btn btn-outline btn-sm" onClick={() => loadData(true)} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { orders, routes, deliverySuccessRate, busyWarehouses } = data;
  const fulfillmentRate = orders.total > 0 ? Math.round((orders.delivered / orders.total) * 100) : 0;

  return (
    <div className="page-enter">
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="page-title">Overview</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh metrics"
            >
              {refreshing ? <><span className="spinner spinner-dark" /> Syncing…</> : '🔄 Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Top KPI Cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{orders.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivered</div>
          <div className="stat-value green">{fulfillmentRate}%</div>
          <div className="stat-sub">{orders.delivered} of {orders.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success rate</div>
          <div className="stat-value" style={{ color: deliverySuccessRate !== null && deliverySuccessRate >= 90 ? 'var(--green-700)' : 'var(--amber)' }}>
            {deliverySuccessRate !== null ? `${deliverySuccessRate}%` : '—'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Routes</div>
          <div className="stat-value">{routes.total}</div>
          <div className="stat-sub">{routes.completed} completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg distance</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{(routes.avgDistanceKm ?? 0) > 0 ? `${routes.avgDistanceKm}` : '0'}</div>
          <div className="stat-sub">km</div>
        </div>
      </div>

      {/* ── Main Columns ── */}
      <div className="dashboard-cols">
        {/* Left: Fleet breakdown + Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Fleet Status Breakdown */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">Routes</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Planned', value: routes.planned, color: 'var(--amber)', pct: routes.total ? Math.round((routes.planned / routes.total) * 100) : 0 },
                { label: 'On the road', value: routes.inProgress ?? 0, color: 'var(--blue)', pct: routes.total ? Math.round(((routes.inProgress ?? 0) / routes.total) * 100) : 0 },
                { label: 'Completed', value: routes.completed, color: 'var(--green-700)', pct: routes.total ? Math.round((routes.completed / routes.total) * 100) : 0 },
                { label: 'Cancelled', value: routes.cancelled, color: 'var(--text-3)', pct: routes.total ? Math.round((routes.cancelled / routes.total) * 100) : 0 },
              ].map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      {r.label}
                    </span>
                    <span style={{ fontWeight: 600 }}>{r.value}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Pipeline */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">Orders</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Waiting', value: orders.pending, color: 'var(--amber)' },
                { label: 'Assigned', value: orders.assigned, color: 'var(--blue)' },
                { label: 'Delivered', value: orders.delivered, color: 'var(--green-700)' },
                { label: 'Failed', value: orders.failed, color: 'var(--red)' },
                { label: 'Cancelled', value: orders.cancelled, color: 'var(--text-3)' },
              ].map(o => (
                <div key={o.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
                    {o.label}
                  </span>
                  <span style={{ fontWeight: 700, color: o.color }}>{o.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="section-header">
              <span className="section-title">Warehouses</span>
            </div>
            {busyWarehouses.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', padding: '12px 0' }}>
                No orders yet.
              </p>
            ) : (
              busyWarehouses.map((w, i) => (
                <div key={w.warehouseId} className="leaderboard-item">
                  <div className="leaderboard-rank">#{i + 1}</div>
                  <div className="leaderboard-name">{w.name}</div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                      background: i === 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'var(--surface-3)',
                      color: i === 0 ? '#fff' : 'var(--text-2)',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>
                      {w.orderCount} orders
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
