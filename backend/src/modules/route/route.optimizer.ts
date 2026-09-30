/**
 * route.optimizer.ts — The nearest-neighbor route optimization algorithm.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM: Vehicle Routing Problem (VRP)
 * ─────────────────────────────────────────────────────────────────────────────
 * Given:
 *   - A set of delivery orders (each with GPS coordinates and weight)
 *   - A fleet of vehicles (each with a weight capacity)
 *   - A single warehouse (the departure point for all vehicles)
 *
 * Find: An assignment of orders to vehicles, and a delivery sequence for each
 * vehicle, that minimizes total travel distance while respecting capacity.
 *
 * This is NP-Hard — no polynomial-time exact algorithm exists.
 * We use the Nearest Neighbor Heuristic (a greedy approximation):
 *   - Fast: O(N² × K) where N = orders, K = vehicles
 *   - Good enough: typically within 20-25% of optimal for small N
 *   - Explainable: interviewers can follow the logic step by step
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HAVERSINE FORMULA — Why we don't just use (x2-x1)² + (y2-y1)²
 * ─────────────────────────────────────────────────────────────────────────────
 * The Earth is a sphere, not a flat plane.
 * Euclidean distance works fine for small areas (< 5 km), but for city-scale
 * routing (10-50 km), the curvature of the Earth matters.
 *
 * Haversine gives the "great-circle distance" — the shortest path along the
 * Earth's surface between two GPS coordinates.
 *
 * Formula:
 *   a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
 *   c = 2 × atan2(√a, √(1−a))
 *   d = R × c   where R = 6371 km (Earth's radius)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ALGORITHM WALKTHROUGH (for interviews)
 * ─────────────────────────────────────────────────────────────────────────────
 * Input: 10 orders, 2 vehicles (V1: 500kg, V2: 300kg)
 *
 * Step 1: Sort orders HIGH priority first
 * Step 2: V1 starts at warehouse
 *   - Find nearest unassigned order that fits in 500kg remaining
 *   - Assign it → remaining = 500 - order.weight
 *   - Move "current position" to that order's location
 *   - Repeat until capacity full or no order fits
 * Step 3: V2 starts at warehouse
 *   - Same process for remaining unassigned orders
 * Step 4: Unassigned orders left over = couldn't fit in any vehicle
 *   (returned as a warning — dispatcher must handle manually)
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrderForOptimizer = {
  id: string;
  latitude: number;
  longitude: number;
  weightKg: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  earliestDelivery: Date | null;
  latestDelivery: Date | null;
};

export type VehicleForOptimizer = {
  id: string;
  driverId: string;
  capacityKg: number;
};

export type Warehouse = {
  latitude: number;
  longitude: number;
};

// The output for one vehicle's route
export type OptimizedRoute = {
  vehicleId: string;
  driverId: string;
  stops: {
    orderId: string;
    sequence: number; // 1-based: stop 1, stop 2, stop 3...
    projectedArrival: Date | null;
  }[];
  totalDistanceKm: number;
};

export type OptimizationComparison = {
  greedyDistanceKm: number;
  randomDistanceKm: number;
  savingsPercent: number;
  trials: number;
};

export type OptimizationResult = {
  routes: OptimizedRoute[];
  unassignedOrderIds: string[]; // Orders that couldn't fit in any vehicle
  comparison: OptimizationComparison;
};

// ─── Haversine Distance ────────────────────────────────────────────────────────

/**
 * Calculate the straight-line distance (km) between two GPS coordinates.
 *
 * WHY THIS IS "AS THE CROW FLIES" NOT ROAD DISTANCE:
 * Actual road distance requires a Maps API (Google Maps, OSRM).
 * We use Haversine as an approximation. Road distance is typically
 * 1.2-1.4x the Haversine distance (the "circuity factor").
 *
 * In production, we'd call an OSRM (Open Source Routing Machine) API
 * to get actual road distances. For this project, Haversine gives
 * accurate enough relative comparisons for the optimizer.
 */
export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km

  // Convert degrees to radians — Math.sin/cos work in radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};

// ─── Priority Scoring ──────────────────────────────────────────────────────────

/**
 * Convert priority enum to a numeric score for sorting.
 * Higher score = higher priority = assigned first.
 *
 * WHY SORT BY PRIORITY FIRST:
 * If a HIGH priority order and a LOW priority order are equidistant from
 * the vehicle's current position, we prefer the HIGH priority one.
 * This ensures SLA-sensitive deliveries are scheduled earliest in the route.
 */
const priorityScore = (priority: string): number => {
  switch (priority) {
    case "HIGH":   return 3;
    case "MEDIUM": return 2;
    case "LOW":    return 1;
    default:       return 0;
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const AVERAGE_SPEED_KMH = 30;

const sortOrdersForGreedy = (orders: OrderForOptimizer[]): OrderForOptimizer[] =>
  [...orders].sort((a, b) => {
    const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.latestDelivery && b.latestDelivery) {
      return a.latestDelivery.getTime() - b.latestDelivery.getTime();
    }
    if (a.latestDelivery) return -1;
    if (b.latestDelivery) return 1;
    return 0;
  });

const round2 = (n: number) => Math.round(n * 100) / 100;

const totalDistanceKm = (routes: OptimizedRoute[]) =>
  round2(routes.reduce((sum, r) => sum + r.totalDistanceKm, 0));

/**
 * Build routes by walking an explicit order sequence per vehicle (no re-picking).
 * Used for the random baseline: assign orders randomly, then measure path length.
 */
const buildRoutesFromAssignment = (
  assignments: { vehicle: VehicleForOptimizer; orders: OrderForOptimizer[] }[],
  warehouse: Warehouse
): OptimizedRoute[] => {
  const routes: OptimizedRoute[] = [];

  for (const { vehicle, orders } of assignments) {
    if (orders.length === 0) continue;

    let currentLat = warehouse.latitude;
    let currentLon = warehouse.longitude;
    let totalDistance = 0;
    let currentTime = new Date();
    const stops: OptimizedRoute["stops"] = [];
    let sequence = 1;

    for (const order of orders) {
      const dist = haversineDistanceKm(
        currentLat,
        currentLon,
        order.latitude,
        order.longitude
      );
      totalDistance += dist;
      const travelTimeMs = (dist / AVERAGE_SPEED_KMH) * 60 * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + travelTimeMs);
      stops.push({
        orderId: order.id,
        sequence: sequence++,
        projectedArrival: new Date(currentTime),
      });
      currentLat = order.latitude;
      currentLon = order.longitude;
    }

    routes.push({
      vehicleId: vehicle.id,
      driverId: vehicle.driverId,
      stops,
      totalDistanceKm: round2(totalDistance),
    });
  }

  return routes;
};

/** Fisher–Yates shuffle (pure; seed via Math.random for demo benchmarks). */
const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Random baseline: shuffle orders, first-fit into vehicles by capacity,
 * visit each vehicle's bag in assignment order. Average over `trials`.
 */
export const averageRandomDistanceKm = (
  orders: OrderForOptimizer[],
  vehicles: VehicleForOptimizer[],
  warehouse: Warehouse,
  trials = 25
): number => {
  if (orders.length === 0 || vehicles.length === 0) return 0;

  let sum = 0;
  for (let t = 0; t < trials; t++) {
    const shuffled = shuffle(orders);
    const bags = vehicles.map((v) => ({
      vehicle: v,
      orders: [] as OrderForOptimizer[],
      remaining: v.capacityKg,
    }));

    for (const order of shuffled) {
      const bag = bags.find((b) => order.weightKg <= b.remaining);
      if (!bag) continue;
      bag.orders.push(order);
      bag.remaining -= order.weightKg;
    }

    const routes = buildRoutesFromAssignment(
      bags.map((b) => ({ vehicle: b.vehicle, orders: b.orders })),
      warehouse
    );
    sum += totalDistanceKm(routes);
  }

  return round2(sum / trials);
};

// ─── Main Algorithm ────────────────────────────────────────────────────────────

/**
 * Nearest Neighbor Heuristic for Vehicle Routing.
 *
 * Time complexity: O(N² × K)
 *   N = number of orders
 *   K = number of vehicles
 *   For N=50, K=5: 50² × 5 = 12,500 operations — runs in < 1ms
 */
export const optimizeRoutes = (
  orders: OrderForOptimizer[],
  vehicles: VehicleForOptimizer[],
  warehouse: Warehouse,
  options?: { randomTrials?: number }
): OptimizationResult => {
  const sortedOrders = sortOrdersForGreedy(orders);
  const unassigned = new Set(sortedOrders.map((o) => o.id));
  const routes: OptimizedRoute[] = [];

  for (const vehicle of vehicles) {
    let remainingCapacity = vehicle.capacityKg;
    let currentLat = warehouse.latitude;
    let currentLon = warehouse.longitude;
    const stops: OptimizedRoute["stops"] = [];
    let totalDistance = 0;
    let sequence = 1;
    let currentTime = new Date();

    while (true) {
      let bestOrder: OrderForOptimizer | null = null;
      let bestDistance = Infinity;

      for (const order of sortedOrders) {
        if (!unassigned.has(order.id)) continue;
        if (order.weightKg > remainingCapacity) continue;

        const dist = haversineDistanceKm(
          currentLat,
          currentLon,
          order.latitude,
          order.longitude
        );

        if (dist < bestDistance) {
          bestDistance = dist;
          bestOrder = order;
        }
      }

      if (!bestOrder) break;

      unassigned.delete(bestOrder.id);
      totalDistance += bestDistance;

      const travelTimeMs = (bestDistance / AVERAGE_SPEED_KMH) * 60 * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + travelTimeMs);

      stops.push({
        orderId: bestOrder.id,
        sequence: sequence++,
        projectedArrival: new Date(currentTime),
      });

      remainingCapacity -= bestOrder.weightKg;
      currentLat = bestOrder.latitude;
      currentLon = bestOrder.longitude;
    }

    if (stops.length > 0) {
      routes.push({
        vehicleId: vehicle.id,
        driverId: vehicle.driverId,
        stops,
        totalDistanceKm: round2(totalDistance),
      });
    }
  }

  const trials = options?.randomTrials ?? 25;
  const greedyDistanceKm = totalDistanceKm(routes);
  const randomDistanceKm = averageRandomDistanceKm(
    orders,
    vehicles,
    warehouse,
    trials
  );
  const savingsPercent =
    randomDistanceKm > 0
      ? round2(((randomDistanceKm - greedyDistanceKm) / randomDistanceKm) * 100)
      : 0;

  return {
    routes,
    unassignedOrderIds: Array.from(unassigned),
    comparison: {
      greedyDistanceKm,
      randomDistanceKm,
      savingsPercent,
      trials,
    },
  };
};
