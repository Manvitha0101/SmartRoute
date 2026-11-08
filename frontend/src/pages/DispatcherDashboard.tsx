import { useEffect, useState, useCallback } from 'react';
import * as api from '../api';
import type { Order, Driver, Vehicle, Warehouse, Route } from '../types';
import { ApiError } from '../api/client';

interface DispatcherDashboardProps {
  onNavigate?: (page: 'dashboard' | 'orders' | 'routes' | 'drivers') => void;
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function fmtDuration(min: number | null) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function PriorityBadge({ p }: { p: string }) {
  const col = p === 'HIGH' ? '#dc2626' : p === 'MEDIUM' ? '#d97706' : '#6b7280';
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 999, background: col + '18', color: col,
      border: `1px solid ${col}30`,
    }}>{p}</span>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    PENDING: '#d97706', ASSIGNED: '#2563eb', DELIVERED: '#16a34a',
    FAILED: '#dc2626', CANCELLED: '#6b7280',
    PLANNED: '#d97706', IN_PROGRESS: '#2563eb', COMPLETED: '#16a34a',
  };
  const col = map[s] ?? '#6b7280';
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 999, background: col + '15', color: col,
      border: `1px solid ${col}25`,
    }}>{s.replace('_', ' ')}</span>
  );
}

// ── Optimization Result Panel ──────────────────────────────────────────────────

interface OptResult {
  routesCreated: number;
  routes: Route[];
  unassignedOrderCount: number;
  warning: string | null;
}

function OptimizationResultPanel({ result, drivers, onClose }: {
  result: OptResult;
  drivers: Driver[];
  warehouses?: Warehouse[];
  onClose: () => void;
}) {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(
    result.routes[0]?.id ?? null
  );

  const driverName = (id: string) => drivers.find(d => d.id === id)?.name ?? 'Unknown';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
      border: '2px solid #86efac',
      borderRadius: 14,
      padding: 20,
      marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
            Routes created
          </div>
          <div style={{ fontSize: '0.85rem', color: '#16a34a', marginTop: 4 }}>
            {result.routesCreated} route{result.routesCreated !== 1 ? 's' : ''} created
            {result.unassignedOrderCount > 0 && ` · ${result.unassignedOrderCount} orders could not be assigned`}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose} style={{ borderColor: '#86efac', color: '#16a34a' }}>
          ✕ Dismiss
        </button>
      </div>

      {result.warning && (
        <div className="alert alert-warning" style={{ marginBottom: 14, fontSize: '0.85rem' }}>
          ⚠️ {result.warning}
        </div>
      )}

      {/* Route cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {result.routes.map((route, idx) => {
          const isOpen = expandedRoute === route.id;
          return (
            <div key={route.id} style={{
              background: '#fff',
              borderRadius: 10,
              border: '1px solid #bbf7d0',
              overflow: 'hidden',
            }}>
              {/* Route header — always visible */}
              <button
                onClick={() => setExpandedRoute(isOpen ? null : route.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                    color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '0.95rem' }}>
                      👤 {driverName(route.driverId)}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 1 }}>
                      {(route.stops?.length ?? route._count?.stops ?? 0)} stops ·{' '}
                      {route.totalDistanceKm ?? '—'} km ·{' '}
                      {fmtDuration(route.estimatedDurationMin)} estimated
                    </div>
                  </div>
                </div>
                <span style={{ color: 'var(--text-3)', fontSize: '1rem' }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Expanded: stop sequence */}
              {isOpen && route.stops && route.stops.length > 0 && (
                <div style={{ borderTop: '1px solid #bbf7d0', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Delivery Sequence
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {route.stops.sort((a, b) => a.stopSequence - b.stopSequence).map((stop, si) => (
                      <div key={stop.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 12px', borderRadius: 8, background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                      }}>
                        {/* Step number */}
                        <div style={{
                          minWidth: 22, height: 22, borderRadius: '50%',
                          background: '#22c55e', color: '#fff',
                          fontSize: '0.72rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 1,
                        }}>
                          {si + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-1)' }}>
                            {stop.order?.customerName ?? `Order #${stop.orderId.slice(-6).toUpperCase()}`}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 2 }}>
                            📍 {stop.order?.address ?? 'Address not available'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            {stop.order?.priority && <PriorityBadge p={stop.order.priority} />}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                              {stop.order?.weightKg ?? '—'} kg
                            </span>
                            {stop.projectedArrival && (
                              <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
                                ⏰ ETA {new Date(stop.projectedArrival).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Optimize Panel ─────────────────────────────────────────────────────────────

function OptimizePanel({
  warehouses, vehicles, drivers, pendingCount, onOptimized,
}: {
  warehouses: Warehouse[];
  vehicles: Vehicle[];
  drivers: Driver[];
  pendingCount: number;
  onOptimized: (result: OptResult) => void;
}) {
  const [warehouseId, setWarehouseId]     = useState(warehouses[0]?.id ?? '');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedDrivers, setSelectedDrivers]   = useState<string[]>([]);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const toggleVehicle = (id: string) =>
    setSelectedVehicles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleDriver = (id: string) =>
    setSelectedDrivers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleRun = async () => {
    setError('');
    if (selectedVehicles.length === 0 || selectedDrivers.length === 0) {
      setError('Select at least one vehicle and one driver.');
      return;
    }
    if (selectedVehicles.length !== selectedDrivers.length) {
      setError(`Select equal numbers: ${selectedVehicles.length} vehicle(s) vs ${selectedDrivers.length} driver(s).`);
      return;
    }
    setLoading(true);
    try {
      const result = await api.optimizeRoutes({
        warehouseId,
        vehicleIds: selectedVehicles,
        driverIds: selectedDrivers,
      });
      // Fetch full route details with stops for the result display
      const routesWithStops = await Promise.all(
        result.routes.map(r => api.getRouteById(r.id).catch(() => r))
      );
      onOptimized({ ...result, routes: routesWithStops });
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('Optimization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const countMismatch = selectedVehicles.length > 0 && selectedDrivers.length > 0 && selectedVehicles.length !== selectedDrivers.length;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: '1.3rem' }}>⚡</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Plan a route</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-3)', marginTop: 2 }}>
            {pendingCount > 0
              ? `${pendingCount} order${pendingCount !== 1 ? 's' : ''} waiting`
              : 'No orders waiting'}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14, fontSize: '0.85rem' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Warehouse selector */}
        <div>
          <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Warehouse</label>
          <select className="form-select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Vehicles */}
          <div>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
              🚗 Vehicles ({selectedVehicles.length} selected)
            </label>
            {vehicles.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>No vehicles found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                {vehicles.map(v => (
                  <label key={v.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
                    cursor: 'pointer', padding: '7px 10px', borderRadius: 8,
                    background: selectedVehicles.includes(v.id) ? 'var(--green-50)' : 'var(--surface-2)',
                    border: `1px solid ${selectedVehicles.includes(v.id) ? 'var(--green-400)' : 'var(--border)'}`,
                    transition: 'all 0.12s',
                  }}>
                    <input type="checkbox" checked={selectedVehicles.includes(v.id)} onChange={() => toggleVehicle(v.id)} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{v.plateNumber}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{v.type} · {v.capacityKg} kg · {v.fuelType}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Drivers */}
          <div>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
              👤 Drivers ({selectedDrivers.length} selected)
            </label>
            {drivers.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>No drivers found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                {drivers.map(d => (
                  <label key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
                    cursor: 'pointer', padding: '7px 10px', borderRadius: 8,
                    background: selectedDrivers.includes(d.id) ? 'var(--green-50)' : 'var(--surface-2)',
                    border: `1px solid ${selectedDrivers.includes(d.id) ? 'var(--green-400)' : 'var(--border)'}`,
                    transition: 'all 0.12s',
                  }}>
                    <input type="checkbox" checked={selectedDrivers.includes(d.id)} onChange={() => toggleDriver(d.id)} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{d.phone}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {countMismatch && (
          <div className="alert alert-warning" style={{ fontSize: '0.82rem' }}>
            ⚠️ Select equal numbers: {selectedVehicles.length} vehicle{selectedVehicles.length !== 1 ? 's' : ''} vs {selectedDrivers.length} driver{selectedDrivers.length !== 1 ? 's' : ''}.
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={loading || pendingCount === 0}
          style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
        >
          {loading
            ? <><span className="spinner" /> Optimizing routes…</>
            : pendingCount === 0
              ? '✓ No pending orders to optimize'
              : `Plan route (${pendingCount} order${pendingCount !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}

// ── Main Dispatcher Dashboard ──────────────────────────────────────────────────

export default function DispatcherDashboard({ onNavigate }: DispatcherDashboardProps) {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [routes, setRoutes]         = useState<Route[]>([]);
  const [loading, setLoading]       = useState(true);
  const [optResult, setOptResult]   = useState<OptResult | null>(null);
  const [orderTab, setOrderTab]     = useState<'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'ALL'>('PENDING');
  const [refreshing, setRefreshing] = useState(false);

  // Modals for external data intake
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal]       = useState(false);
  const [importInput, setImportInput]         = useState('');
  const [importLoading, setImportLoading]     = useState(false);
  const [importError, setImportError]         = useState('');

  // Manual single order form state
  const [singleOrder, setSingleOrder] = useState({
    customerName: '',
    address: '',
    latitude: '17.4401',
    longitude: '78.3489',
    packageWeightKg: '5',
    priority: 'MEDIUM',
    warehouseId: '',
  });

  const SAMPLE_FLIPKART_MANIFEST = [
    {
      customerName: "Pooja Hegde (Flipkart Express)",
      address: "Road No. 36, Jubilee Hills, Hyderabad",
      latitude: 17.4319,
      longitude: 78.4073,
      packageWeightKg: 3.5,
      priority: "HIGH",
    },
    {
      customerName: "Vikram Sethi (Flipkart Assured)",
      address: "Kondapur Main Road, Near RTO, Hyderabad",
      latitude: 17.4699,
      longitude: 78.3578,
      packageWeightKg: 12.0,
      priority: "MEDIUM",
    },
    {
      customerName: "Sneha Roy (Flipkart Grocery)",
      address: "Madhapur Cyber Towers, Hyderabad",
      latitude: 17.4504,
      longitude: 78.3808,
      packageWeightKg: 18.5,
      priority: "HIGH",
    },
    {
      customerName: "Arjun Kapoor (Flipkart Electronics)",
      address: "Banjara Hills Road 12, Hyderabad",
      latitude: 17.4156,
      longitude: 78.4352,
      packageWeightKg: 8.0,
      priority: "MEDIUM",
    },
    {
      customerName: "Divya Sharma (Flipkart Assured)",
      address: "KPHB Colony 4th Phase, Kukatpally, Hyderabad",
      latitude: 17.4849,
      longitude: 78.4011,
      packageWeightKg: 5.0,
      priority: "LOW",
    },
    {
      customerName: "Kiran Kumar (Flipkart Supermart)",
      address: "Financial District, Nanakramguda, Hyderabad",
      latitude: 17.4198,
      longitude: 78.3412,
      packageWeightKg: 22.0,
      priority: "HIGH",
    },
  ];

  const handleLoadSample = () => {
    setImportInput(JSON.stringify(SAMPLE_FLIPKART_MANIFEST, null, 2));
    setImportError('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportInput((event.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleIngestOrders = async () => {
    setImportError('');
    if (!importInput.trim()) {
      setImportError('Please paste JSON or CSV data or load the sample manifest.');
      return;
    }
    const whId = warehouses[0]?.id;
    if (!whId) {
      setImportError('No warehouse found. Please create or load a warehouse first.');
      return;
    }

    let parsedList: any[] = [];
    try {
      if (importInput.trim().startsWith('[') || importInput.trim().startsWith('{')) {
        const json = JSON.parse(importInput.trim());
        parsedList = Array.isArray(json) ? json : json.orders || [];
      } else {
        // Parse simple CSV
        const lines = importInput.trim().split('\n').filter(Boolean);
        const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
        parsedList = lines.slice(1).map((line: string) => {
          const vals = line.split(',').map((v: string) => v.trim());
          const o: any = {};
          headers.forEach((h: string, idx: number) => { o[h] = vals[idx]; });
          return {
            customerName: o.customername || o.customer || o.name || 'Customer',
            address: o.address || 'Hyderabad',
            latitude: parseFloat(o.latitude || o.lat || '17.44'),
            longitude: parseFloat(o.longitude || o.lng || o.lon || '78.34'),
            packageWeightKg: parseFloat(o.packageweightkg || o.weightkg || o.weight || '5'),
            priority: o.priority ? o.priority.toUpperCase() : 'MEDIUM',
          };
        });
      }
    } catch (err: any) {
      setImportError('Failed to parse input: ' + err.message);
      return;
    }

    if (parsedList.length === 0) {
      setImportError('No valid orders found in input.');
      return;
    }

    const payload = parsedList.map((item) => ({
      customerName: item.customerName || 'Customer',
      address: item.address || 'Hyderabad',
      latitude: Number(item.latitude) || 17.4401,
      longitude: Number(item.longitude) || 78.3489,
      weightKg: Number(item.packageWeightKg || item.weightKg || 5),
      priority: item.priority || 'MEDIUM',
      warehouseId: whId,
    }));

    setImportLoading(true);
    try {
      const res = await api.createBatchOrders(payload);
      setShowImportModal(false);
      setImportInput('');
      await loadAll(true);
      alert(`Successfully ingested ${res.count} orders from client manifest!`);
    } catch (err: any) {
      setImportError(err.message || 'Batch ingestion failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleClearPending = async () => {
    if (!confirm('Are you sure you want to clear all pending unassigned orders to start from scratch?')) {
      return;
    }
    try {
      const res = await api.clearPendingOrders();
      await loadAll(true);
      alert(`Cleared ${res.count} pending orders.`);
    } catch (err: any) {
      alert('Failed to clear orders: ' + err.message);
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const whId = singleOrder.warehouseId || warehouses[0]?.id;
    if (!whId) {
      alert('No warehouse available.');
      return;
    }
    try {
      await api.createOrder({
        customerName: singleOrder.customerName,
        address: singleOrder.address,
        latitude: parseFloat(singleOrder.latitude),
        longitude: parseFloat(singleOrder.longitude),
        weightKg: parseFloat(singleOrder.packageWeightKg),
        priority: singleOrder.priority as any,
        warehouseId: whId,
      } as any);
      setShowAddModal(false);
      setSingleOrder({
        customerName: '',
        address: '',
        latitude: '17.4401',
        longitude: '78.3489',
        packageWeightKg: '5',
        priority: 'MEDIUM',
        warehouseId: '',
      });
      await loadAll(true);
      alert('Order created successfully!');
    } catch (err: any) {
      alert('Failed to create order: ' + err.message);
    }
  };

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [ordersData, driversData, vehiclesData, warehousesData, routesData] = await Promise.all([
        api.getOrders(),
        api.getDrivers(),
        api.getVehicles(),
        api.getWarehouses(),
        api.getRoutes(),
      ]);
      setOrders(ordersData);
      setDrivers(driversData);
      setVehicles(vehiclesData);
      setWarehouses(warehousesData);
      setRoutes(routesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleOptimized = (result: OptResult) => {
    setOptResult(result);
    loadAll(true); // refresh data silently
  };

  if (loading) {
    return (
      <div className="empty-state">
        <span className="spinner spinner-dark" />
        <p style={{ marginTop: 12, color: 'var(--text-3)' }}>Loading live operations…</p>
      </div>
    );
  }

  const pendingOrders   = orders.filter(o => o.status === 'PENDING');
  const assignedOrders  = orders.filter(o => o.status === 'ASSIGNED');
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const activeRoutes    = routes.filter(r => r.status === 'IN_PROGRESS');
  const plannedRoutes   = routes.filter(r => r.status === 'PLANNED');

  const displayOrders = orderTab === 'PENDING' ? pendingOrders
                      : orderTab === 'ASSIGNED' ? assignedOrders
                      : orderTab === 'DELIVERED' ? deliveredOrders
                      : orders;

  // Route driver name lookup
  const driverName = (id: string) => drivers.find(d => d.id === id)?.name;

  return (
    <div className="page-enter">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="page-title">Dispatch Control Center</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', margin: '4px 0 0' }}>
              B2B logistics pipeline: Ingest partner order manifests &amp; plan optimized delivery routes
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowImportModal(true)} style={{ background: '#0284c7' }}>
              📥 Ingest Partner Manifest
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAddModal(true)}>
              ➕ Add Order
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleClearPending} style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
              🗑️ Clear Pending
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => loadAll(true)} disabled={refreshing}>
              {refreshing ? <><span className="spinner spinner-dark" /> Syncing…</> : '🔄 Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div className="stat-label">Waiting</div>
          <div className="stat-value" style={{ color: pendingOrders.length > 0 ? 'var(--red)' : 'var(--green-700)' }}>
            {pendingOrders.length}
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--blue)' }}>
          <div className="stat-label">Assigned</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{assignedOrders.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #16a34a' }}>
          <div className="stat-label">Delivered</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{deliveredOrders.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div className="stat-label">On the road</div>
          <div className="stat-value" style={{ color: '#22c55e' }}>{activeRoutes.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--amber)' }}>
          <div className="stat-label">Planned</div>
          <div className="stat-value amber">{plannedRoutes.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #a78bfa' }}>
          <div className="stat-label">Drivers</div>
          <div className="stat-value" style={{ color: '#7c3aed' }}>{drivers.length}</div>
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,420px)', gap: 20, alignItems: 'start' }}>

        {/* Left: Orders list */}
        <div>
          {/* Section header + tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>📦 Incoming Orders</h3>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['PENDING', 'ASSIGNED', 'DELIVERED', 'ALL'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setOrderTab(tab)}
                  style={{
                    padding: '4px 12px', border: 'none', borderRadius: 6,
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    background: orderTab === tab
                      ? (tab === 'PENDING' ? '#dc2626' : tab === 'ASSIGNED' ? '#2563eb' : tab === 'DELIVERED' ? '#16a34a' : 'var(--green-700)')
                      : 'var(--surface-2)',
                    color: orderTab === tab ? '#fff' : 'var(--text-2)',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'PENDING' ? `Pending (${pendingOrders.length})` : tab === 'ASSIGNED' ? `Assigned (${assignedOrders.length})` : tab === 'DELIVERED' ? `Delivered (${deliveredOrders.length})` : `All (${orders.length})`}
                </button>
              ))}
            </div>
          </div>

          {displayOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 20px' }}>
              <p style={{ fontSize: '1.8rem', marginBottom: 8 }}>📦</p>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>
                {orderTab === 'PENDING' ? 'No Pending Orders' : orderTab === 'ASSIGNED' ? 'No Assigned Orders' : 'No Orders'}
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
                {orderTab === 'PENDING' ? 'All orders have been assigned to drivers.' : 'Run optimization to assign orders.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayOrders.map(o => {

                return (
                  <div key={o.id} style={{
                    padding: '12px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    borderLeft: `4px solid ${o.priority === 'HIGH' ? '#dc2626' : o.priority === 'MEDIUM' ? '#d97706' : '#6b7280'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{o.customerName}</span>
                          <PriorityBadge p={o.priority} />
                          <StatusBadge s={o.status} />
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>📍 {o.address}</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: '0.75rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                          <span>⚖️ {o.weightKg} kg</span>
                          {o.latestDelivery && (
                            <span style={{ color: o.timeWindowStatus === 'VIOLATED' ? '#dc2626' : o.timeWindowStatus === 'AT_RISK' ? '#d97706' : 'inherit', fontWeight: o.timeWindowStatus && o.timeWindowStatus !== 'NONE' ? 600 : 400 }}>
                              🕐 Deadline: {new Date(o.latestDelivery).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              {o.timeWindowStatus === 'AT_RISK' && ' ⚠️'}
                              {o.timeWindowStatus === 'VIOLATED' && ' ❌'}
                            </span>
                          )}
                          {o.status === 'ASSIGNED' && driverName(routes.find(r => r.stops?.some(s => s.orderId === o.id))?.driverId ?? '') && (
                            <span style={{ color: '#0284c7', fontWeight: 600 }}>
                              👤 {driverName(routes.find(r => r.stops?.some(s => s.orderId === o.id))?.driverId ?? '')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0 }}>
                        #{o.id.slice(-6).toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active routes summary */}
          {activeRoutes.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 12 }}>🟢 Active Routes (On Road Now)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeRoutes.map(r => (
                  <div key={r.id} style={{
                    padding: '12px 14px',
                    background: 'rgba(34,197,94,0.06)',
                    border: '1px solid #bbf7d0',
                    borderRadius: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>👤 {r.driver?.name ?? driverName(r.driverId) ?? 'Driver'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>
                        🏭 {r.warehouse?.name ?? 'Warehouse'} · {r._count?.stops ?? r.stops?.length ?? 0} stops · {fmtDuration(r.estimatedDurationMin)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <StatusBadge s={r.status} />
                      {onNavigate && (
                        <button className="btn btn-outline btn-sm" onClick={() => onNavigate('routes')}>
                          View →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Optimization panel */}
        <div style={{ position: 'sticky', top: 20 }}>
          <OptimizePanel
            warehouses={warehouses}
            vehicles={vehicles}
            drivers={drivers}
            pendingCount={pendingOrders.length}
            onOptimized={handleOptimized}
          />

          {/* Optimization result */}
          {optResult && (
            <OptimizationResultPanel
              result={optResult}
              drivers={drivers}
              warehouses={warehouses}
              onClose={() => setOptResult(null)}
            />
          )}
        </div>
      </div>

      {/* ── Modal: Ingest Partner Manifest ── */}
      {showImportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)', padding: 24, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>📥 Ingest Partner Manifest (Flipkart / OMS)</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-3)' }}>
                  Upload CSV/JSON order batch from third-party e-commerce platform
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowImportModal(false)}>✕</button>
            </div>

            {importError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{importError}</div>}

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button className="btn btn-outline btn-sm" type="button" onClick={handleLoadSample} style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#86efac' }}>
                ⚡ Load Flipkart Express Manifest Sample
              </button>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                📁 Upload File (CSV / JSON)
                <input type="file" accept=".csv,.json,text/plain" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>
                Manifest Payload (JSON Array or CSV rows with customerName, address, lat, lng, weightKg, priority)
              </label>
              <textarea
                rows={9}
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.82rem', width: '100%' }}
                placeholder='[{"customerName": "Rohan (Flipkart)", "address": "Madhapur", "latitude": 17.448, "longitude": 78.381, "packageWeightKg": 4.5, "priority": "HIGH"}]'
                value={importInput}
                onChange={e => setImportInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" type="button" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleIngestOrders} disabled={importLoading} style={{ background: '#0284c7' }}>
                {importLoading ? <><span className="spinner" /> Ingesting…</> : '📥 Ingest Manifest into Queue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Single Order ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)', padding: 24, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>➕ Add Single Order</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSingle}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Customer Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={singleOrder.customerName}
                  onChange={e => setSingleOrder({ ...singleOrder, customerName: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Delivery Address</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Hitech City Road, Hyderabad"
                  value={singleOrder.address}
                  onChange={e => setSingleOrder({ ...singleOrder, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    className="form-input"
                    value={singleOrder.latitude}
                    onChange={e => setSingleOrder({ ...singleOrder, latitude: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    className="form-input"
                    value={singleOrder.longitude}
                    onChange={e => setSingleOrder({ ...singleOrder, longitude: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Package Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="form-input"
                    value={singleOrder.packageWeightKg}
                    onChange={e => setSingleOrder({ ...singleOrder, packageWeightKg: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={singleOrder.priority}
                    onChange={e => setSingleOrder({ ...singleOrder, priority: e.target.value })}
                  >
                    <option value="HIGH">HIGH (Urgent)</option>
                    <option value="MEDIUM">MEDIUM (Standard)</option>
                    <option value="LOW">LOW (Bulk)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
