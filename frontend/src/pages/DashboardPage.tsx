import { useEffect, useState, useCallback } from 'react';
import * as api from '../api';
import type { AnalyticsSummary } from '../types';

interface DashboardPageProps {
  onNavigate?: (page: 'dashboard' | 'orders' | 'routes') => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-dark" />
        <p style={{ marginTop: 12, color: 'var(--text-3)' }}>Loading fleet analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-enter">
        <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <strong>Error loading dashboard:</strong> {error}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => loadData(true)}
              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
            >
              Retry
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                window.location.reload();
              }}
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { orders, routes, deliverySuccessRate, busyWarehouses } = data;
  const attemptedDeliveries = orders.delivered + orders.failed;

  return (
    <div className="page-enter">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="page-title">Operations Dashboard</h2>
            <p className="page-subtitle">Real-time status of dispatch operations, routes, and order fulfillment.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh metrics from server"
            >
              {refreshing ? <><span className="spinner spinner-dark" /> Syncing…</> : '🔄 Refresh'}
            </button>
            {onNavigate && (
              <>
                <button className="btn btn-outline btn-sm" onClick={() => onNavigate('orders')}>
                  Manage Orders
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigate('routes')}>
                  ⚡ Optimize Routes
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Order Metrics Grid ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{orders.total}</div>
          <div className="stat-sub">across all warehouses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value amber">{orders.pending}</div>
          <div className="stat-sub">awaiting optimization</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assigned</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{orders.assigned}</div>
          <div className="stat-sub">allocated to routes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivered</div>
          <div className="stat-value green">{orders.delivered}</div>
          <div className="stat-sub">completed successfully</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed / Cancelled</div>
          <div className="stat-value red">{orders.failed + orders.cancelled}</div>
          <div className="stat-sub">{orders.failed} failed · {orders.cancelled} cancelled</div>
        </div>
      </div>

      {/* ── Main Dashboard Columns ── */}
      <div className="dashboard-cols">
        {/* Left Column: Route Analytics & Fleet Progress */}
        <div className="card">
          <div className="section-header">
            <span className="section-title">🚚 Fleet & Route Performance</span>
            <span className="badge badge-planned">{routes.total} Total</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Planned Routes',      value: routes.planned,    color: 'var(--amber)' },
              { label: 'In Progress Routes',  value: routes.inProgress, color: 'var(--blue)' },
              { label: 'Completed Routes',    value: routes.completed,  color: 'var(--green-700)' },
              { label: 'Cancelled Routes',    value: routes.cancelled,  color: 'var(--text-3)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                  {r.label}
                </span>
                <span style={{ fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}

            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 16,
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
            }}>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Average Route Distance
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>Across completed runs</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--green-700)' }}>
                {routes.avgDistanceKm > 0 ? `${routes.avgDistanceKm} km` : '0 km'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Delivery Success Rate & Busiest Warehouses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Success Rate Card */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">📊 Delivery Success Rate</span>
            </div>
            <div className="success-rate-ring">
              <div className="rate-value">
                {deliverySuccessRate !== null ? `${deliverySuccessRate}%` : '—'}
              </div>
              <div className="rate-label">
                {deliverySuccessRate !== null
                  ? `${orders.delivered} delivered of ${attemptedDeliveries} completed attempts`
                  : 'No delivery attempts completed yet'}
              </div>
            </div>
          </div>

          {/* Busiest Warehouses Leaderboard */}
          <div className="card">
            <div className="section-header">
              <span className="section-title">🏭 Warehouse Distribution</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>By assigned orders</span>
            </div>
            {busyWarehouses.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', padding: '12px 0' }}>
                No warehouse activity recorded yet.
              </p>
            ) : (
              busyWarehouses.map((w, i) => (
                <div key={w.warehouseId} className="leaderboard-item">
                  <div className="leaderboard-rank">{i + 1}</div>
                  <div className="leaderboard-name">{w.name}</div>
                  <div className="leaderboard-count">{w.orderCount} order{w.orderCount !== 1 ? 's' : ''}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
