import { useState, useEffect } from 'react';
import * as api from '../api';
import type { Route, Warehouse, Vehicle, Driver } from '../types';
import { ApiError } from '../api/client';

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOptimize, setShowOptimize] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchRoutes = () => {
    setLoading(true);
    Promise.all([api.getRoutes(), api.getWarehouses(), api.getVehicles(), api.getDrivers()])
      .then(([r, w, v, d]) => { setRoutes(r); setWarehouses(w); setVehicles(v); setDrivers(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoutes(); }, []);

  const handleStart = async (id: string) => {
    try {
      await api.startRoute(id);
      fetchRoutes();
    } catch (e) {
      if (e instanceof ApiError) setActionError(e.message);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.completeRoute(id);
      fetchRoutes();
    } catch (e) {
      if (e instanceof ApiError) setActionError(e.message);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.cancelRoute(id);
      fetchRoutes();
    } catch (e) {
      if (e instanceof ApiError) setActionError(e.message);
    }
  };

  const viewStops = async (r: Route) => {
    try {
      const full = await api.getRouteById(r.id);
      setSelectedRoute(full);
    } catch {
      setSelectedRoute(r);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      PLANNED: 'badge-planned',
      IN_PROGRESS: 'badge-in-progress',
      COMPLETED: 'badge-completed',
      CANCELLED: 'badge-cancelled',
    };
    return <span className={`badge ${map[s] ?? ''}`}>{s}</span>;
  };

  if (loading) return <div className="empty-state"><span className="spinner spinner-dark" /></div>;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="page-title">Routes & Trips</h2>
            <p className="page-subtitle">{routes.length} route{routes.length !== 1 ? 's' : ''} total</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowOptimize(true)}>
            ⚡ Run Optimization
          </button>
        </div>
      </div>

      {actionError && (
        <div className="alert alert-error" onClick={() => setActionError('')} style={{ cursor: 'pointer' }}>
          {actionError} <small>(click to dismiss)</small>
        </div>
      )}

      {routes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗺️</div>
          <p>No routes yet. Create some orders then run optimization.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Driver & Vehicle</th>
                <th>Warehouse Hub</th>
                <th>Stops</th>
                <th>Status</th>
                <th>Distance</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => {
                const stopsCount = r._count?.stops ?? r.stops?.length ?? 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                        {r.driver?.name || 'Assigned Driver'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                        🚗 {r.vehicle?.plateNumber || 'Vehicle'} ({r.vehicle?.type || 'VAN'})
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {r.warehouse?.name || 'Warehouse Depot'}
                    </td>
                    <td>
                      <span className="badge badge-outline" style={{ fontWeight: 600 }}>
                        {stopsCount} stops
                      </span>
                    </td>
                    <td>{statusBadge(r.status)}</td>
                    <td>{r.totalDistanceKm != null ? `${r.totalDistanceKm} km` : '—'}</td>
                    <td>{r.estimatedDurationMin != null ? `${r.estimatedDurationMin} min` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => viewStops(r)}>View Stops</button>
                        {r.status === 'PLANNED'     && <button className="btn btn-primary btn-sm" onClick={() => handleStart(r.id)}>Start</button>}
                        {r.status === 'IN_PROGRESS' && <button className="btn btn-primary btn-sm" onClick={() => handleComplete(r.id)}>Complete</button>}
                        {r.status === 'PLANNED'     && <button className="btn btn-danger btn-sm"  onClick={() => handleCancel(r.id)}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showOptimize && (
        <OptimizeModal
          warehouses={warehouses}
          vehicles={vehicles}
          drivers={drivers}
          onClose={() => setShowOptimize(false)}
          onDone={() => { setShowOptimize(false); fetchRoutes(); }}
        />
      )}

      {selectedRoute && (
        <StopsModal route={selectedRoute} onClose={() => setSelectedRoute(null)} />
      )}
    </div>
  );
}

// ── Optimize Modal ─────────────────────────────────────────────────────────────

function OptimizeModal({ warehouses, vehicles, drivers, onClose, onDone }: {
  warehouses: Warehouse[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers]   = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleVehicle = (id: string) =>
    setSelectedVehicles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleDriver = (id: string) =>
    setSelectedDrivers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleRun = async () => {
    setError(''); setSuccess(''); setLoading(true);
    if (selectedVehicles.length !== selectedDrivers.length) {
      setError('Number of vehicles must equal number of drivers.');
      setLoading(false); return;
    }
    if (selectedVehicles.length === 0) {
      setError('Select at least one vehicle and one driver.');
      setLoading(false); return;
    }
    try {
      const result = await api.optimizeRoutes({ warehouseId, vehicleIds: selectedVehicles, driverIds: selectedDrivers });
      const msg = `✅ ${result.routesCreated} route(s) created.${result.warning ? ' ⚠️ ' + result.warning : ''}`;
      setSuccess(msg);
      setTimeout(onDone, 1800);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">⚡ Run Route Optimization</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: 20 }}>
          Select the warehouse, vehicles, and drivers for this run. The AI optimizer will assign pending orders in optimal delivery order.
        </p>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Warehouse Depot</label>
            <select className="form-select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="form-grid">
            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                Vehicles ({selectedVehicles.length} selected)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {vehicles.map(v => (
                  <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: selectedVehicles.includes(v.id) ? 'var(--green-50)' : 'transparent', border: `1px solid ${selectedVehicles.includes(v.id) ? 'var(--green-400)' : 'transparent'}` }}>
                    <input type="checkbox" checked={selectedVehicles.includes(v.id)} onChange={() => toggleVehicle(v.id)} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{v.plateNumber}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{v.type} · {v.capacityKg} kg</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                Drivers ({selectedDrivers.length} selected)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {drivers.map(d => (
                  <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, background: selectedDrivers.includes(d.id) ? 'var(--green-50)' : 'transparent', border: `1px solid ${selectedDrivers.includes(d.id) ? 'var(--green-400)' : 'transparent'}` }}>
                    <input type="checkbox" checked={selectedDrivers.includes(d.id)} onChange={() => toggleDriver(d.id)} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{d.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{d.phone} • {d.licenseNumber}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {selectedVehicles.length > 0 && selectedDrivers.length > 0 && selectedVehicles.length !== selectedDrivers.length && (
            <div className="alert alert-warning">
              Select the same number of vehicles and drivers ({selectedVehicles.length} vehicles vs {selectedDrivers.length} drivers).
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? <><span className="spinner" /> Optimizing…</> : '⚡ Run Optimization'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stops Modal ───────────────────────────────────────────────────────────────

function StopsModal({ route, onClose }: { route: Route; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Route Stops & Deliveries</h3>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
          <span>🏢 {route.warehouse?.name || 'Warehouse Hub'}</span>
          <span>🛣️ {route.totalDistanceKm} km</span>
          <span>⏱ ~{route.estimatedDurationMin} min</span>
        </div>
        {!route.stops || route.stops.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No stops recorded for this route.</p>
        ) : (
          <div className="stops-list" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {route.stops.map((s, idx) => (
              <div key={s.id} className="stop-item">
                <div className="stop-seq">{s.stopSequence || idx + 1}</div>
                <div className="stop-info" style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                    {s.order?.customerName || `Order #${s.orderId.slice(0, 8)}`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
                    📍 {s.order?.address || 'Address'}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', marginTop: 2 }}>
                    Weight: {s.order?.weightKg ?? '--'} kg • Priority: {s.order?.priority ?? 'MEDIUM'}
                  </div>
                </div>
                <div className="stop-eta" style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {s.projectedArrival
                      ? new Date(s.projectedArrival).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </div>
                  <span className={`badge badge-${s.status.toLowerCase()}`} style={{ marginTop: 4 }}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
