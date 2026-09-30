import { useState, useEffect, useCallback } from 'react';
import type { Driver, Route } from '../types';
import * as api from '../api';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import RouteMap from '../components/RouteMap';

function fmtDuration(min: number | null) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: '#2563eb', PLANNED: '#d97706', COMPLETED: '#16a34a', CANCELLED: '#6b7280',
  PENDING: '#d97706', FAILED: '#dc2626', SKIPPED: '#6b7280',
};

function StatusBadge({ s }: { s: string }) {
  const col = STATUS_COLOR[s] ?? '#6b7280';
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: col + '15', color: col, border: `1px solid ${col}25`,
    }}>
      {s.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const col = p === 'HIGH' ? '#dc2626' : p === 'MEDIUM' ? '#d97706' : '#6b7280';
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
      background: col + '18', color: col,
    }}>{p}</span>
  );
}

function RouteDetailCard({ route, onAction, actionLoading, canCancel }: {
  route: Route;
  onAction: (routeId: string, action: 'start' | 'complete' | 'cancel') => void;
  actionLoading: boolean;
  canCancel: boolean;
}) {
  const stops = route.stops ?? [];
  const completed = stops.filter(s => s.status === 'COMPLETED').length;
  const progressPct = stops.length > 0 ? Math.round((completed / stops.length) * 100) : 0;
  const mapStops = stops
    .filter(s => s.order?.latitude != null && s.order?.longitude != null)
    .map(s => ({
      sequence: s.stopSequence,
      latitude: s.order!.latitude,
      longitude: s.order!.longitude,
      label: s.order?.customerName ?? `Stop ${s.stopSequence}`,
      address: s.order?.address,
    }));

  return (
    <div style={{
      background: 'var(--surface)',
      border: `2px solid ${STATUS_COLOR[route.status] ?? 'var(--border)'}30`,
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        background: route.status === 'IN_PROGRESS'
          ? 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02))'
          : route.status === 'COMPLETED'
            ? 'linear-gradient(135deg, rgba(22,163,74,0.06), rgba(22,163,74,0.02))'
            : 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <StatusBadge s={route.status} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontFamily: 'monospace' }}>
                Route #{route.id.slice(-8).toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: 'var(--text-2)', flexWrap: 'wrap' }}>
              <span>{route.warehouse?.name ?? 'Warehouse'}</span>
              <span>{route.vehicle?.plateNumber ?? 'Vehicle'} ({route.vehicle?.type ?? ''})</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {route.status === 'PLANNED' && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => onAction(route.id, 'start')} disabled={actionLoading}>
                  {actionLoading ? <span className="spinner" /> : 'Start Trip'}
                </button>
                {canCancel && (
                  <button className="btn btn-outline btn-sm" onClick={() => onAction(route.id, 'cancel')} disabled={actionLoading}
                    style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
                    Cancel
                  </button>
                )}
              </>
            )}
            {route.status === 'IN_PROGRESS' && (
              <button className="btn btn-primary btn-sm" onClick={() => onAction(route.id, 'complete')} disabled={actionLoading}
                style={{ background: 'var(--green-700)' }}>
                {actionLoading ? <span className="spinner" /> : 'Mark Complete'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Stops', value: `${stops.length}` },
            { label: 'Distance', value: route.totalDistanceKm ? `${route.totalDistanceKm} km` : '—' },
            { label: 'Duration', value: fmtDuration(route.estimatedDurationMin) },
            route.status === 'PLANNED' ? { label: 'Departs', value: fmtTime(route.plannedDepartureAt) } : null,
            route.status === 'IN_PROGRESS' ? { label: 'Departed', value: fmtTime(route.actualDepartureAt) } : null,
            route.status === 'COMPLETED' ? { label: 'Completed', value: fmtTime(route.completedAt) } : null,
          ].filter(Boolean).map(stat => (
            <div key={stat!.label}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat!.label}</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stat!.value}</div>
            </div>
          ))}
        </div>

        {route.status === 'IN_PROGRESS' && stops.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 4 }}>
              <span>Delivery Progress</span>
              <span>{completed}/{stops.length} stops done ({progressPct}%)</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 999 }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                borderRadius: 999, transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {(route.warehouse || mapStops.length > 0) && (
        <div style={{ padding: '12px 16px 0' }}>
          <RouteMap
            warehouse={route.warehouse ? {
              latitude: route.warehouse.latitude,
              longitude: route.warehouse.longitude,
              name: route.warehouse.name,
            } : null}
            stops={mapStops}
            height={220}
          />
        </div>
      )}

      {stops.length > 0 ? (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Delivery Stops — Sequence
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {stops.sort((a, b) => a.stopSequence - b.stopSequence).map((stop, idx) => {
              const isDone = stop.status === 'COMPLETED';
              const isFailed = stop.status === 'FAILED';
              return (
                <div key={stop.id} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12, flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: isDone ? '#22c55e' : isFailed ? '#dc2626' : 'var(--surface-3)',
                      border: `2px solid ${isDone ? '#16a34a' : isFailed ? '#b91c1c' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.78rem', fontWeight: 700, color: isDone || isFailed ? '#fff' : 'var(--text-2)',
                    }}>
                      {isDone ? '✓' : isFailed ? '✗' : idx + 1}
                    </div>
                    {idx < stops.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 16, background: isDone ? '#22c55e' : 'var(--border)', marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: idx < stops.length - 1 ? 14 : 0, opacity: isFailed ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 700, fontSize: '0.9rem',
                          textDecoration: isFailed ? 'line-through' : 'none',
                          color: isDone ? 'var(--text-2)' : 'var(--text-1)',
                        }}>
                          {stop.order?.customerName ?? `Order #${stop.orderId.slice(-6).toUpperCase()}`}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 2 }}>
                          {stop.order?.address ?? 'Address not available'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {stop.order?.priority && <PriorityBadge p={stop.order.priority} />}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{stop.order?.weightKg ?? '—'} kg</span>
                          {stop.projectedArrival && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isDone ? '#16a34a' : '#0284c7' }}>
                              {isDone ? 'Arrived' : 'ETA'}: {fmtTime(stop.actualArrival ?? stop.projectedArrival)}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge s={stop.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', color: 'var(--text-3)', fontSize: '0.875rem' }}>
          No stops loaded for this route.
        </div>
      )}
    </div>
  );
}

export default function DriverPage() {
  const { user } = useAuth();
  const isDriverLogin = user?.role === 'DRIVER';

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routesByDriver, setRoutesByDriver] = useState<Record<string, Route[]>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [driverRoutes, setDriverRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadDriverRoutes = useCallback(async (driverId: string, allRoutes: Record<string, Route[]>) => {
    const basic = allRoutes[driverId] ?? [];
    if (basic.length === 0) { setDriverRoutes([]); return; }
    setRoutesLoading(true);
    try {
      const full = await Promise.all(basic.map(r => api.getRouteById(r.id).catch(() => r)));
      const order: Record<string, number> = { IN_PROGRESS: 0, PLANNED: 1, COMPLETED: 2, CANCELLED: 3 };
      full.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
      setDriverRoutes(full);
    } catch {
      setDriverRoutes(basic);
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      if (isDriverLogin) {
        const [me, routesData] = await Promise.all([api.getMyDriverProfile(), api.getRoutes()]);
        setDrivers([me]);
        setSelectedDriverId(me.id);
        const grouped: Record<string, Route[]> = {};
        for (const r of routesData) {
          if (!grouped[r.driverId]) grouped[r.driverId] = [];
          grouped[r.driverId].push(r);
        }
        setRoutesByDriver(grouped);
        await loadDriverRoutes(me.id, grouped);
      } else {
        const [driversData, routesData] = await Promise.all([api.getDrivers(), api.getRoutes()]);
        setDrivers(driversData);
        const grouped: Record<string, Route[]> = {};
        for (const r of routesData) {
          if (!grouped[r.driverId]) grouped[r.driverId] = [];
          grouped[r.driverId].push(r);
        }
        setRoutesByDriver(grouped);
        const nextId = selectedDriverId || driversData[0]?.id || '';
        if (nextId) {
          setSelectedDriverId(nextId);
          await loadDriverRoutes(nextId, grouped);
        }
      }
    } catch (e) {
      console.error(e);
      showToast(e instanceof ApiError ? e.message : 'Failed to load driver data');
    } finally {
      setLoading(false);
    }
  }, [isDriverLogin, loadDriverRoutes, selectedDriverId]);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!isDriverLogin && selectedDriverId) {
      loadDriverRoutes(selectedDriverId, routesByDriver);
    }
  }, [selectedDriverId, routesByDriver, isDriverLogin, loadDriverRoutes]);

  const handleAction = async (routeId: string, action: 'start' | 'complete' | 'cancel') => {
    setActionLoading(true);
    try {
      if (action === 'start') await api.startRoute(routeId);
      if (action === 'complete') await api.completeRoute(routeId);
      if (action === 'cancel') await api.cancelRoute(routeId);
      showToast(action === 'start' ? 'Trip started' : action === 'complete' ? 'Route marked complete' : 'Route cancelled');
      await loadAll();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-dark" />
        <p style={{ marginTop: 12, color: 'var(--text-3)' }}>Loading driver data…</p>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#1a1a1a', color: '#fff', padding: '12px 18px',
          borderRadius: 10, fontSize: '0.9rem', fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', maxWidth: 320,
        }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="page-title">{isDriverLogin ? 'My Routes' : 'Driver Portal'}</h2>
            <p className="page-subtitle">
              {isDriverLogin
                ? 'Your assigned stops, map, and trip controls'
                : 'Select a driver to view allocated routes and delivery stops'}
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadAll}>Refresh</button>
        </div>
      </div>

      {drivers.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontWeight: 600 }}>No Drivers Found</p>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', marginTop: 4 }}>
            Add drivers via seed or admin API.
          </p>
        </div>
      ) : (
        <>
          {!isDriverLogin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {drivers.map(d => {
                const dRoutes = routesByDriver[d.id] ?? [];
                const hasActive = dRoutes.some(r => r.status === 'IN_PROGRESS');
                const hasPlanned = dRoutes.some(r => r.status === 'PLANNED');
                const isSelected = d.id === selectedDriverId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriverId(d.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px',
                      background: isSelected ? 'var(--green-800)' : 'var(--surface)',
                      color: isSelected ? '#fff' : 'var(--text-1)',
                      border: `2px solid ${isSelected ? 'var(--green-700)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{d.name}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: 1 }}>
                        {hasActive ? 'On Road' : hasPlanned ? 'Ready' : dRoutes.length > 0 ? `${dRoutes.length} routes` : 'No routes'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedDriver && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, marginBottom: 20, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedDriver.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                  <span>{selectedDriver.phone}</span>
                  <span>{selectedDriver.licenseNumber}</span>
                  {selectedDriver.vehicle && (
                    <span>{selectedDriver.vehicle.plateNumber} ({selectedDriver.vehicle.type})</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--green-700)' }}>{driverRoutes.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Total Routes</div>
              </div>
            </div>
          )}

          {routesLoading ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <span className="spinner spinner-dark" />
            </div>
          ) : driverRoutes.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No Routes Assigned Yet</p>
              <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>
                {selectedDriver?.name} has no routes. Ask a dispatcher to run optimization.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {driverRoutes.map(route => (
                <RouteDetailCard
                  key={route.id}
                  route={route}
                  onAction={handleAction}
                  actionLoading={actionLoading}
                  canCancel={!isDriverLogin}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
