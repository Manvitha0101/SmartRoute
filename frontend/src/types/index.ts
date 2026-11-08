export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'DISPATCHER' | 'DRIVER';
  createdAt?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  type: 'VAN' | 'TRUCK' | 'BIKE' | 'CAR' | 'MOTORCYCLE';
  capacityKg: number;
  fuelType: 'DIESEL' | 'PETROL' | 'ELECTRIC' | 'CNG';
  createdAt?: string;
  updatedAt?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  vehicleId?: string | null;
  userId?: string | null;
  vehicle?: Vehicle | null;
  user?: User | null;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type TimeWindowStatus = 'NONE' | 'AT_RISK' | 'VIOLATED';

export interface Order {
  id: string;
  customerName: string;
  address: string;
  deliveryAddress?: string;
  latitude: number;
  longitude: number;
  weightKg: number;
  packageWeightKg?: number;
  priority: OrderPriority;
  status: OrderStatus;
  warehouseId: string;
  latestDelivery?: string | null;
  earliestDelivery?: string | null;
  deliveryDeadline?: string | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  timeWindowStatus?: TimeWindowStatus | string;
  createdAt?: string;
  updatedAt?: string;
  warehouse?: Warehouse;
}

export type RouteStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RouteStopStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface RouteStop {
  id: string;
  routeId: string;
  orderId: string;
  stopSequence: number;
  status: RouteStopStatus;
  projectedArrival?: string | null;
  estimatedArrival?: string | null;
  actualArrival?: string | null;
  order?: Order;
}

export interface Route {
  id: string;
  warehouseId: string;
  vehicleId: string;
  driverId: string;
  status: RouteStatus;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  plannedDepartureAt?: string | null;
  actualDepartureAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  stops?: RouteStop[];
  vehicle?: Vehicle;
  driver?: Driver;
  warehouse?: Warehouse;
  _count?: {
    stops: number;
  };
}

export interface AnalyticsSummary {
  orders: {
    total: number;
    pending: number;
    assigned: number;
    delivered: number;
    failed: number;
    cancelled?: number;
  };
  routes: {
    total: number;
    planned: number;
    active: number;
    completed: number;
    cancelled: number;
    inProgress?: number;
    avgDistanceKm?: number;
  };
  deliverySuccessRate: number;
  busyWarehouses: {
    id: string;
    warehouseId?: string;
    name: string;
    orderCount: number;
  }[];
}

export interface OptimizationComparison {
  savingsPercent?: number;
  greedyDistanceKm?: number;
  randomDistanceKm?: number;
  trials?: number;
  baselineCost?: number;
  optimizedCost?: number;
  improvementPercent?: number;
  initialDistanceKm?: number;
  optimizedDistanceKm?: number;
  initialDurationMin?: number;
  optimizedDurationMin?: number;
}
