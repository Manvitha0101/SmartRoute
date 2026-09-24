import { api } from './client';
import type { AuthResponse, Order, Warehouse, Vehicle, Driver, Route, RouteStop, AnalyticsSummary, DispatcherLive } from '../types';

// ── Auth ───────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password });

export const googleLogin = (payload: { credential?: string; email?: string; name?: string; role?: string }) =>
  api.post<AuthResponse>('/auth/google', payload);

export const logout = (refreshToken: string) =>
  api.post<void>('/auth/logout', { refreshToken });

// ── Analytics ──────────────────────────────────────────────────────────────────
export const getAnalyticsSummary = () =>
  api.get<AnalyticsSummary>('/analytics/summary');

export const getDispatcherLive = () =>
  api.get<DispatcherLive>('/analytics/dispatcher/live');

// ── Warehouses ─────────────────────────────────────────────────────────────────
export const getWarehouses = () =>
  api.get<Warehouse[]>('/warehouses');

// ── Vehicles ───────────────────────────────────────────────────────────────────
export const getVehicles = () =>
  api.get<Vehicle[]>('/vehicles');

// ── Drivers ────────────────────────────────────────────────────────────────────
export const getDrivers = () =>
  api.get<Driver[]>('/drivers');

export const getDriverById = (id: string) =>
  api.get<Driver>(`/drivers/${id}`);

// ── Orders ─────────────────────────────────────────────────────────────────────
export const getOrders = (params?: { status?: string; priority?: string; warehouseId?: string }) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
  const qs = query.toString();
  return api.get<Order[]>(`/orders${qs ? '?' + qs : ''}`);
};

export const createOrder = (data: Partial<Order>) =>
  api.post<Order>('/orders', data);

export const cancelOrder = (id: string) =>
  api.patch<Order>(`/orders/${id}/cancel`);

export const deleteOrder = (id: string) =>
  api.delete<void>(`/orders/${id}`);

// ── Routes ─────────────────────────────────────────────────────────────────────
export const getRoutes = () =>
  api.get<Route[]>('/routes');

export const getRouteById = (id: string) =>
  api.get<Route>(`/routes/${id}`);

export const optimizeRoutes = (data: {
  warehouseId: string;
  vehicleIds: string[];
  driverIds: string[];
}) => api.post<{ routesCreated: number; routes: Route[]; unassignedOrderCount: number; warning: string | null }>('/routes/optimize', data);

export const startRoute = (id: string) =>
  api.patch<Route>(`/routes/${id}/start`);

export const completeRoute = (id: string) =>
  api.patch<Route>(`/routes/${id}/complete`);

export const cancelRoute = (id: string) =>
  api.patch<Route>(`/routes/${id}/cancel`);

export const updateRouteStopStatus = (
  routeId: string,
  stopId: string,
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
) => api.patch<RouteStop>(`/routes/${routeId}/stops/${stopId}`, { status });
