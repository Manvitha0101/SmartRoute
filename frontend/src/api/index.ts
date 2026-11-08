import { api } from './client';
import type {
  User,
  Warehouse,
  Vehicle,
  Driver,
  Order,
  Route,
  RouteStop,
  AnalyticsSummary,
  OptimizationComparison,
} from '../types';

// ── Auth ───────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  accessToken: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/login', { email, password });
}

export async function register(data: {
  email: string;
  password: string;
  role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
  name?: string;
  phone?: string;
}): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/register', data);
}

// ── Warehouses ─────────────────────────────────────────────────────────────────
export async function getWarehouses(): Promise<Warehouse[]> {
  return api.get<Warehouse[]>('/warehouses');
}

// ── Vehicles ───────────────────────────────────────────────────────────────────
export async function getVehicles(): Promise<Vehicle[]> {
  return api.get<Vehicle[]>('/vehicles');
}

// ── Drivers ────────────────────────────────────────────────────────────────────
export async function getDrivers(): Promise<Driver[]> {
  return api.get<Driver[]>('/drivers');
}

export async function getMyDriverProfile(): Promise<Driver> {
  return api.get<Driver>('/drivers/me');
}

// ── Orders ─────────────────────────────────────────────────────────────────────
export async function getOrders(params?: Record<string, string>): Promise<Order[]> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return api.get<Order[]>(`/orders${query}`);
}

export async function getOrderById(id: string): Promise<Order> {
  return api.get<Order>(`/orders/${id}`);
}

export async function createOrder(data: Partial<Order>): Promise<Order> {
  return api.post<Order>('/orders', data);
}

export async function createBatchOrders(orders: Partial<Order>[]): Promise<{ count: number; orders: Order[] }> {
  return api.post<{ count: number; orders: Order[] }>('/orders/batch', orders);
}

export async function clearPendingOrders(): Promise<{ message: string; count: number }> {
  return api.delete<{ message: string; count: number }>('/orders/clear/pending');
}

export async function updateOrder(id: string, data: Partial<Order>): Promise<Order> {
  return api.patch<Order>(`/orders/${id}`, data);
}

export async function cancelOrder(id: string): Promise<Order> {
  return api.patch<Order>(`/orders/${id}/cancel`);
}

export async function deleteOrder(id: string): Promise<void> {
  return api.delete<void>(`/orders/${id}`);
}

// ── Routes ─────────────────────────────────────────────────────────────────────
export async function getRoutes(): Promise<Route[]> {
  return api.get<Route[]>('/routes');
}

export async function getRouteById(id: string): Promise<Route> {
  return api.get<Route>(`/routes/${id}`);
}

export interface OptimizeRoutesPayload {
  warehouseId: string;
  vehicleIds: string[];
  driverIds: string[];
}

export interface OptimizeRoutesResponse {
  routesCreated: number;
  routes: Route[];
  unassignedOrderCount: number;
  warning: string | null;
  comparison?: OptimizationComparison;
}

export async function optimizeRoutes(
  payload: OptimizeRoutesPayload
): Promise<OptimizeRoutesResponse> {
  return api.post<OptimizeRoutesResponse>('/routes/optimize', payload);
}

export async function compareRoutes(
  payload: OptimizeRoutesPayload
): Promise<OptimizationComparison> {
  return api.post<OptimizationComparison>('/routes/compare', payload);
}

export async function startRoute(id: string): Promise<Route> {
  return api.patch<Route>(`/routes/${id}/start`);
}

export async function completeRoute(id: string): Promise<Route> {
  return api.patch<Route>(`/routes/${id}/complete`);
}

export async function updateStopStatus(
  routeId: string,
  stopId: string,
  data: { status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'; actualArrival?: string }
): Promise<RouteStop> {
  return api.patch<RouteStop>(`/routes/${routeId}/stops/${stopId}`, data);
}

export async function cancelRoute(id: string): Promise<Route> {
  return api.patch<Route>(`/routes/${id}/cancel`);
}

// ── Analytics ──────────────────────────────────────────────────────────────────
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return api.get<AnalyticsSummary>('/analytics/summary');
}

