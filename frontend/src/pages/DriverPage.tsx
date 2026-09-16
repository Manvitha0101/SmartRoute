import { useState, useEffect } from 'react';
import type { Driver, Route, RouteStop } from '../types';
import * as api from '../api';
import { ApiError } from '../api/client';

export default function DriverPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [activeRouteDetail, setActiveRouteDetail] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'driver' | 'fleet'>('driver');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (preserveDriverId?: string) => {
    try {
      setLoading(true);
      const [driversData, routesData] = await Promise.all([
        api.getDrivers(),
        api.getRoutes(),
      ]);
      setDrivers(driversData);
      setRoutes(routesData);

      const targetId = preserveDriverId || selectedDriverId || driversData[0]?.id || '';
      if (targetId) {
        setSelectedDriverId(targetId);
        await loadDriverRouteDetail(targetId, routesData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDriverRouteDetail = async (driverId: string, currentRoutes: Route[]) => {
    // Find active or planned route for this driver
    const driverRoute = currentRoutes.find(
      (r) => r.driverId === driverId && (r.status === 'IN_PROGRESS' || r.status === 'PLANNED')
    ) || currentRoutes.find((r) => r.driverId === driverId);

    if (driverRoute) {
      try {
        const full = await api.getRouteById(driverRoute.id);
        setActiveRouteDetail(full);
      } catch {
        setActiveRouteDetail(driverRoute);
      }
    } else {
      setActiveRouteDetail(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDriver = async (driverId: string) => {
    setSelectedDriverId(driverId);
    await loadDriverRouteDetail(driverId, routes);
  };

  const handleStartTrip = async (routeId: string) => {
    try {
      setActionLoading(true);
      await api.startRoute(routeId);
      showToast('🚀 Trip started! Navigation in progress.');
      await loadData(selectedDriverId);
    } catch (err: any) {
      showToast(err instanceof ApiError ? err.message : 'Failed to start trip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTrip = async (routeId: string) => {
    try {
      setActionLoading(true);
      await api.completeRoute(routeId);
      showToast('🎉 Trip completed successfully! All tasks finished.');
      await loadData(selectedDriverId);
    } catch (err: any) {
      showToast(err instanceof ApiError ? err.message : 'Failed to complete trip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStop = async (routeId: string, stopId: string, status: 'COMPLETED' | 'FAILED') => {
    try {
      setActionLoading(true);
      await api.updateRouteStopStatus(routeId, stopId, status);
      showToast(
        status === 'COMPLETED'
          ? '✅ Stop marked as Delivered successfully!'
          : '⚠️ Stop marked as Failed/Attempted.'
      );
      // Reload route detail
      const full = await api.getRouteById(routeId);
      setActiveRouteDetail(full);
      // Also reload routes list
      const rList = await api.getRoutes();
      setRoutes(rList);
    } catch (err: any) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update stop status');
    } finally {
      setActionLoading(false);
    }
  };

  const currentDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];

  const stops = activeRouteDetail?.stops || [];
  const completedStops = stops.filter((s) => s.status === 'COMPLETED').length;
  const progressPercent = stops.length > 0 ? Math.round((completedStops / stops.length) * 100) : 0;

  return (
    <div className="driver-page">
      {/* Toast Notification */}
      {toastMessage && <div className="toast-notification">{toastMessage}</div>}

      {/* Top Header Bar */}
      <div className="page-header">
        <div>
          <div className="page-badge">🚚 DRIVER PORTAL & FLEET TASKS</div>
          <h1 className="page-title">Driver Tasks & Live Status</h1>
          <p className="page-subtitle">
            View assigned delivery runs, track real-time stop sequences, and update order statuses.
          </p>
        </div>

        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'driver' ? 'active' : ''}`}
              onClick={() => setViewMode('driver')}
            >
              👤 Driver View
            </button>
            <button
              className={`toggle-btn ${viewMode === 'fleet' ? 'active' : ''}`}
              onClick={() => setViewMode('fleet')}
            >
              📊 Fleet Overview
            </button>
          </div>
          <button className="btn btn-outline" onClick={() => loadData(selectedDriverId)}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <span className="spinner" />
          <p>Loading driver schedules and assigned tasks…</p>
        </div>
      ) : viewMode === 'fleet' ? (
        /* ════════════════════════════════════════════════════════════════════════
           FLEET OVERVIEW VIEW (All drivers side-by-side)
           ════════════════════════════════════════════════════════════════════════ */
        <div className="fleet-view-grid">
          {drivers.map((d) => {
            const activeR = routes.find(
              (r) => r.driverId === d.id && (r.status === 'IN_PROGRESS' || r.status === 'PLANNED')
            );
            const totalStopsCount = activeR?._count?.stops ?? activeR?.stops?.length ?? 0;
            const isAssigned = !!activeR;

            return (
              <div key={d.id} className="fleet-card">
                <div className="fleet-card-header">
                  <div className="driver-avatar-circle">
                    {d.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {d.name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      📱 {d.phone} • DL: {d.licenseNumber}
                    </div>
                  </div>
                  <span
                    className={`status-chip ${
                      activeR?.status === 'IN_PROGRESS'
                        ? 'status-in-progress'
                        : activeR?.status === 'PLANNED'
                        ? 'status-planned'
                        : 'status-idle'
                    }`}
                  >
                    {activeR?.status === 'IN_PROGRESS'
                      ? 'IN TRANSIT'
                      : activeR?.status === 'PLANNED'
                      ? 'ASSIGNED'
                      : 'AVAILABLE'}
                  </span>
                </div>

                <div className="fleet-card-body">
                  <div className="meta-pill-group">
                    <div className="meta-pill">
                      <span className="label">Vehicle:</span>
                      <span className="value">
                        {d.vehicle?.plateNumber || 'TS-09-EV-1024'} ({d.vehicle?.type || 'VAN'})
                      </span>
                    </div>
                    <div className="meta-pill">
                      <span className="label">Capacity:</span>
                      <span className="value">{d.vehicle?.capacityKg || 850} kg</span>
                    </div>
                  </div>

                  {isAssigned ? (
                    <div className="fleet-task-summary">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span>
                          📍 <strong>{activeR.warehouse?.name || 'Warehouse Hub'}</strong>
                        </span>
                        <span>
                          <strong>{totalStopsCount}</strong> stops
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>Distance: {activeR.totalDistanceKm ?? '--'} km</span>
                        <span>Est: {activeR.estimatedDurationMin ?? '--'} min</span>
                      </div>
                    </div>
                  ) : (
                    <div className="fleet-no-task">No active trips assigned. Ready for next optimization run.</div>
                  )}
                </div>

                <div className="fleet-card-footer">
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setSelectedDriverId(d.id);
                      setViewMode('driver');
                      loadDriverRouteDetail(d.id, routes);
                    }}
                  >
                    Open Driver Portal →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════════
           INDIVIDUAL DRIVER PORTAL VIEW (Active Tasks, Stops & Actions)
           ════════════════════════════════════════════════════════════════════════ */
        <div className="driver-portal-layout">
          {/* Driver Switcher & Profile Card */}
          <div className="driver-profile-card">
            <div className="driver-select-container">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select Active Driver:
              </label>
              <select
                className="form-select"
                value={selectedDriverId}
                onChange={(e) => handleSelectDriver(e.target.value)}
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.vehicle?.plateNumber || 'Vehicle Assigned'}
                  </option>
                ))}
              </select>
            </div>

            {currentDriver && (
              <div className="driver-info-box">
                <div className="driver-info-header">
                  <div className="driver-large-avatar">
                    {currentDriver.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {currentDriver.name}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      DL No: {currentDriver.licenseNumber}
                    </div>
                  </div>
                </div>

                <div className="driver-meta-grid">
                  <div className="driver-meta-item">
                    <span className="meta-label">Phone</span>
                    <span className="meta-val">{currentDriver.phone}</span>
                  </div>
                  <div className="driver-meta-item">
                    <span className="meta-label">Vehicle</span>
                    <span className="meta-val">
                      {currentDriver.vehicle?.plateNumber || 'TS-09-EV-1024'}
                    </span>
                  </div>
                  <div className="driver-meta-item">
                    <span className="meta-label">Type & Fuel</span>
                    <span className="meta-val">
                      {currentDriver.vehicle?.type || 'VAN'} • {currentDriver.vehicle?.fuelType || 'ELECTRIC'}
                    </span>
                  </div>
                  <div className="driver-meta-item">
                    <span className="meta-label">Max Load</span>
                    <span className="meta-val">{currentDriver.vehicle?.capacityKg || 850} kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Assigned Route & Tasks Detail Section */}
          <div className="driver-tasks-container">
            {activeRouteDetail ? (
              <>
                {/* Active Trip Header Banner */}
                <div className="trip-banner">
                  <div className="trip-banner-top">
                    <div>
                      <div className="trip-tag">ACTIVE ASSIGNED RUN</div>
                      <h2 className="trip-title">
                        {activeRouteDetail.warehouse?.name || 'Warehouse Depot'}
                      </h2>
                      <div className="trip-sub">
                        Route ID: <code style={{ fontSize: '0.8rem' }}>{activeRouteDetail.id.slice(0, 8)}</code>
                        {' • '}
                        Status:{' '}
                        <span
                          className={`badge ${
                            activeRouteDetail.status === 'IN_PROGRESS'
                              ? 'badge-in-progress'
                              : activeRouteDetail.status === 'PLANNED'
                              ? 'badge-planned'
                              : 'badge-completed'
                          }`}
                        >
                          {activeRouteDetail.status}
                        </span>
                      </div>
                    </div>

                    <div className="trip-actions">
                      {activeRouteDetail.status === 'PLANNED' && (
                        <button
                          className="btn btn-primary"
                          disabled={actionLoading}
                          onClick={() => handleStartTrip(activeRouteDetail.id)}
                        >
                          ▶ Start Trip & Navigate
                        </button>
                      )}
                      {activeRouteDetail.status === 'IN_PROGRESS' && (
                        <button
                          className="btn btn-success"
                          disabled={actionLoading}
                          onClick={() => handleCompleteTrip(activeRouteDetail.id)}
                        >
                          🏁 Complete Trip
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Trip Metrics Row */}
                  <div className="trip-metrics-row">
                    <div className="trip-metric">
                      <span className="val">{activeRouteDetail.totalDistanceKm ?? '--'} km</span>
                      <span className="lbl">Total Distance</span>
                    </div>
                    <div className="trip-metric">
                      <span className="val">{activeRouteDetail.estimatedDurationMin ?? '--'} min</span>
                      <span className="lbl">Est. Duration</span>
                    </div>
                    <div className="trip-metric">
                      <span className="val">{stops.length}</span>
                      <span className="lbl">Total Stops</span>
                    </div>
                    <div className="trip-metric">
                      <span className="val">{completedStops} / {stops.length}</span>
                      <span className="lbl">Delivered</span>
                    </div>
                  </div>

                  {/* Trip Progress Bar */}
                  <div className="trip-progress-container">
                    <div className="progress-label">
                      <span>Delivery Completion</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>

                {/* Sequential Delivery Stops Section */}
                <div className="stops-timeline-header">
                  <h3>📦 Delivery Tasks ({stops.length} Stops in Sequence)</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Deliver in strict ascending order for optimal mileage & time window compliance.
                  </span>
                </div>

                <div className="stops-timeline">
                  {stops.map((stop: RouteStop, index: number) => {
                    const isCompleted = stop.status === 'COMPLETED';
                    const isFailed = stop.status === 'FAILED';
                    const isPending = stop.status === 'PENDING';

                    return (
                      <div
                        key={stop.id}
                        className={`stop-timeline-card ${
                          isCompleted ? 'stop-done' : isFailed ? 'stop-failed' : 'stop-active'
                        }`}
                      >
                        <div className="stop-badge-column">
                          <div className="stop-number-circle">{stop.stopSequence || index + 1}</div>
                          {index < stops.length - 1 && <div className="stop-line" />}
                        </div>

                        <div className="stop-card-content">
                          <div className="stop-card-header">
                            <div>
                              <h4 className="customer-name">
                                {stop.order?.customerName || `Order #${stop.orderId.slice(0, 8)}`}
                              </h4>
                              <p className="delivery-address">📍 {stop.order?.address || 'Address details'}</p>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {stop.order?.priority && (
                                <span className={`priority-badge priority-${stop.order.priority.toLowerCase()}`}>
                                  {stop.order.priority} PRIORITY
                                </span>
                              )}
                              <span
                                className={`stop-status-chip ${
                                  isCompleted
                                    ? 'chip-completed'
                                    : isFailed
                                    ? 'chip-failed'
                                    : 'chip-pending'
                                }`}
                              >
                                {stop.status}
                              </span>
                            </div>
                          </div>

                          <div className="stop-details-row">
                            <div className="stop-meta-tag">
                              ⚖️ Weight: <strong>{stop.order?.weightKg ?? 10} kg</strong>
                            </div>
                            <div className="stop-meta-tag">
                              🕒 Scheduled ETA:{' '}
                              <strong>
                                {stop.projectedArrival
                                  ? new Date(stop.projectedArrival).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '--:--'}
                              </strong>
                            </div>
                            {stop.actualArrival && (
                              <div className="stop-meta-tag delivered-tag">
                                ✨ Delivered at:{' '}
                                <strong>
                                  {new Date(stop.actualArrival).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </strong>
                              </div>
                            )}
                          </div>

                          {/* Driver Stop Action Buttons */}
                          {activeRouteDetail.status === 'IN_PROGRESS' && isPending && (
                            <div className="stop-actions-bar">
                              <button
                                className="btn btn-success btn-sm"
                                disabled={actionLoading}
                                onClick={() => handleUpdateStop(activeRouteDetail.id, stop.id, 'COMPLETED')}
                              >
                                ✅ Mark Delivered
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={actionLoading}
                                onClick={() => handleUpdateStop(activeRouteDetail.id, stop.id, 'FAILED')}
                              >
                                ⚠️ Report Issue / Failed
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => showToast(`📞 Calling customer: ${stop.order?.customerName}`)}
                              >
                                📞 Call Customer
                              </button>
                              <a
                                href={`https://maps.google.com/?q=${stop.order?.latitude || 17.44},${
                                  stop.order?.longitude || 78.38
                                }`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline btn-sm"
                              >
                                🗺️ Open GPS Maps
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="empty-tasks-card">
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>☕</div>
                <h3>No Active Trips Assigned</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
                  {currentDriver?.name} currently has no pending or in-progress routes. You can optimize and dispatch
                  new orders from the Routes page.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
