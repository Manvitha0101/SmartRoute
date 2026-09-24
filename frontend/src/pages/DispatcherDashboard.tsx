import { useEffect, useState, useCallback } from 'react';
import * as api from '../api';
import type { DispatcherLive, ActiveRouteItem, PlannedRouteItem } from '../types';

interface DispatcherDashboardProps {
  onNavigate?: (page: 'dashboard' | 'orders' | 'routes' | 'drivers') => void;
}

// Format duration in minutes → "1h 20m"
function fmtDuration(min: number | null) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Format a timestamp into a short local time string
function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Status badge for route cards
function StatusBadge({ status }: { status: 'IN_PROGRESS' | 'PLANNED' }) {
  const styles: Record<string, React.CSSProperties> = {
    IN_PROGRESS: { background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' },
    PLANNED:     { background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.25)' },
  };
  const labels: Record<string, string> = { IN_PROGRESS: '🟢 On Road', PLANNED: '🟡 Ready' };
  return (
    <span style={{
      ...styles[status],
      fontSize: '0.72rem',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 999,
      letterSpacing: '0.03em',
    }}>
      {labels[status]}
    </span>
  );
}

function ActiveRouteCard({ route, onView }: { route: ActiveRouteItem; onView: () => void }) {
  return (
    <div className="route-card" style={{
      padding: '14px 16px',
      background: 'var(--surface-2)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status="IN_PROGRESS" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>
            #{route.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onView} style={{ fontSize: '0.75rem' }}>
          View Route →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '0.85rem' }}>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Driver</div>
          <div style={{ fontWeight: 600 }}>👤 {route.driverName}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Vehicle</div>
          <div style={{ fontWeight: 600 }}>🚚 {route.vehiclePlate}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Warehouse</div>
          <div style={{ fontWeight: 600 }}>🏭 {route.warehouseName}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Departed At</div>
          <div style={{ fontWeight: 600 }}>⏱ {fmtTime(route.actualDepartureAt)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Stops</div>
          <div style={{ fontWeight: 600 }}>📍 {route.totalStops} stops</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Est. Duration</div>
          <div style={{ fontWeight: 600 }}>🕐 {fmtDuration(route.estimatedDurationMin)}</div>
        </div>
      </div>
    </div>
  );
}

function PlannedRouteCard({ route, onView }: { route: PlannedRouteItem; onView: () => void }) {
  return (
    <div className="route-card" style={{
      padding: '14px 16px',
      background: 'var(--surface-2)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status="PLANNED" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>
            #{route.id.slice(-6).toUpperCase()}
          </span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onView} style={{ fontSize: '0.75rem' }}>
          Start Route →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: '0.85rem' }}>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Driver</div>
          <div style={{ fontWeight: 600 }}>👤 {route.driverName}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Vehicle</div>
          <div style={{ fontWeight: 600 }}>🚚 {route.vehiclePlate}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Warehouse</div>
          <div style={{ fontWeight: 600 }}>🏭 {route.warehouseName}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Planned Departure</div>
          <div style={{ fontWeight: 600 }}>⏰ {fmtTime(route.plannedDepartureAt)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Stops</div>
          <div style={{ fontWeight: 600 }}>📍 {route.totalStops} stops</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Distance</div>
          <div style={{ fontWeight: 600 }}>📏 {route.totalDistanceKm ? `${route.totalDistanceKm} km` : '—'}</div>
        </div>
      </div>
    </div>
  );
}

export default function DispatcherDashboard({ onNavigate }: DispatcherDashboardProps) {
  const [data, setData] = useState<DispatcherLive | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'planned'>('active');

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      setError('');
      const live = await api.getDispatcherLive();
      setData(live);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load live operations data');
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
        <p style={{ marginTop: 12, color: 'var(--text-3)' }}>Loading live operations…</p>
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

  const { pendingOrderCount, availableDriverCount, activeRoutes, plannedRoutes } = data;

  return (
    <div className="page-enter">
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 6,
              }}>Dispatcher View</span>
            </div>
            <h2 className="page-title">Live Operations Control</h2>
            <p className="page-subtitle">Monitor active routes, dispatch planned runs, and manage the delivery queue.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh live data"
            >
              {refreshing ? <><span className="spinner spinner-dark" /> Syncing…</> : '🔄 Refresh'}
            </button>
            {onNavigate && (
              <button className="btn btn-primary btn-sm" onClick={() => onNavigate('routes')}>
                ⚡ Optimize Routes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Alert: High pending queue ── */}
      {pendingOrderCount > 5 && (
        <div className="alert alert-warning" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <strong>📋 {pendingOrderCount} orders waiting!</strong> Run route optimization to assign them to drivers before time windows expire.
          </div>
          {onNavigate && (
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('routes')}>
              Optimize Now →
            </button>
          )}
        </div>
      )}

      {/* ── Status KPI Cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--blue)' }}>
          <div className="stat-label">🟢 Active Routes</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{activeRoutes.length}</div>
          <div className="stat-sub">Drivers currently on road</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--amber)' }}>
          <div className="stat-label">🟡 Planned Routes</div>
          <div className="stat-value amber">{plannedRoutes.length}</div>
          <div className="stat-sub">Ready for dispatch</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="stat-label">📦 Pending Orders</div>
          <div className="stat-value" style={{ color: pendingOrderCount > 0 ? 'var(--red)' : 'var(--green-700)' }}>
            {pendingOrderCount}
          </div>
          <div className="stat-sub">{pendingOrderCount > 0 ? 'Need route assignment' : 'All orders assigned ✓'}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--green-700)' }}>
          <div className="stat-label">🧑‍✈️ Available Drivers</div>
          <div className="stat-value green">{availableDriverCount}</div>
          <div className="stat-sub">Ready to be dispatched</div>
        </div>
      </div>

      {/* ── Main area: Route lists ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 2,
          borderBottom: '2px solid var(--border)',
          marginBottom: 20,
        }}>
          {(['active', 'planned'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? 'var(--primary)' : 'var(--text-3)',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
                transition: 'all 0.15s',
              }}
            >
              {tab === 'active'
                ? `🟢 Active Routes (${activeRoutes.length})`
                : `🟡 Planned Routes (${plannedRoutes.length})`}
            </button>
          ))}
        </div>

        {/* Active Routes Panel */}
        {activeTab === 'active' && (
          <>
            {activeRoutes.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>🛣️</p>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No Active Routes Right Now</p>
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>
                  All drivers are idle. {plannedRoutes.length > 0 ? 'Start a planned route to dispatch.' : 'Run route optimization to create routes.'}
                </p>
                {onNavigate && plannedRoutes.length > 0 && (
                  <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveTab('planned')}>
                    View Planned Routes →
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {activeRoutes.map(route => (
                  <ActiveRouteCard
                    key={route.id}
                    route={route}
                    onView={() => onNavigate?.('routes')}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Planned Routes Panel */}
        {activeTab === 'planned' && (
          <>
            {plannedRoutes.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>📋</p>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No Planned Routes</p>
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>
                  {pendingOrderCount > 0
                    ? `${pendingOrderCount} orders are pending. Run route optimization to create routes.`
                    : 'All routes have been dispatched or are currently in progress.'}
                </p>
                {onNavigate && pendingOrderCount > 0 && (
                  <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNavigate('routes')}>
                    ⚡ Optimize Routes
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {plannedRoutes.map(route => (
                  <PlannedRouteCard
                    key={route.id}
                    route={route}
                    onView={() => onNavigate?.('routes')}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Quick Links bottom bar ── */}
      <div style={{
        marginTop: 28,
        padding: '16px 20px',
        background: 'var(--surface-2)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 600, marginRight: 4 }}>Quick Access:</span>
        {onNavigate && (
          <>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('orders')}>📦 Pending Orders</button>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('drivers')}>👤 Driver Status</button>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('routes')}>🗺️ All Routes</button>
          </>
        )}
      </div>
    </div>
  );
}
