// All shared TypeScript types — mirrors the backend response shapes

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'DISPATCHER';
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: string;
  capacityKg: number;
  fuelType: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  vehicleId: string | null;
  vehicle?: {
    id: string;
    plateNumber: string;
    type: string;
    capacityKg: number;
    fuelType: string;
  } | null;
  routes?: {
    id: string;
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    totalDistanceKm: number | null;
    estimatedDurationMin: number | null;
    warehouse: { name: string };
    stops: { id: string; status: string }[];
  }[];
}

export interface Order {
  id: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  earliestDelivery: string | null;
  latestDelivery: string | null;
  weightKg: number;
  status: 'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  timeWindowStatus: string;
  warehouseId: string;
  createdAt: string;
}

export interface RouteStop {
  id: string;
  orderId: string;
  stopSequence: number;
  projectedArrival: string | null;
  actualArrival: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  order?: {
    customerName: string;
    address: string;
    weightKg: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    latestDelivery: string | null;
    latitude: number;
    longitude: number;
  };
}

export interface Route {
  id: string;
  driverId: string;
  vehicleId: string;
  warehouseId: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  plannedDepartureAt: string | null;
  actualDepartureAt: string | null;
  completedAt: string | null;
  createdAt: string;
  driver?: { name: string; phone: string };
  vehicle?: { plateNumber: string; capacityKg: number; type: string };
  warehouse?: { name: string; latitude: number; longitude: number };
  _count?: { stops: number };
  stops?: RouteStop[];
}

export interface AnalyticsSummary {
  orders: {
    total: number;
    pending: number;
    assigned: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
  routes: {
    total: number;
    planned: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    avgDistanceKm: number;
  };
  deliverySuccessRate: number | null;
  busyWarehouses: {
    warehouseId: string;
    name: string;
    orderCount: number;
  }[];
}

export interface ActiveRouteItem {
  id: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  vehicleType: string;
  warehouseName: string;
  totalStops: number;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  actualDepartureAt: string | null;
}

export interface PlannedRouteItem {
  id: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  vehicleType: string;
  warehouseName: string;
  totalStops: number;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  plannedDepartureAt: string | null;
}

export interface DispatcherLive {
  pendingOrderCount: number;
  availableDriverCount: number;
  activeRoutes: ActiveRouteItem[];
  plannedRoutes: PlannedRouteItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}
