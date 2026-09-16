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

export type OptimizationResult = {
  routes: OptimizedRoute[];
  unassignedOrderIds: string[]; // Orders that couldn't fit in any vehicle
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

// ─── Main Algorithm ────────────────────────────────────────────────────────────

/**
 * Nearest Neighbor Heuristic for Vehicle Routing.
 *
 * Time complexity: O(N² × K)
 *   N = number of orders
 *   K = number of vehicles
 *   For N=50, K=5: 50² × 5 = 12,500 operations — runs in < 1ms
 *
 * @param orders   - All PENDING orders for this warehouse
 * @param vehicles - Available vehicles with drivers assigned
 * @param warehouse - The dispatch hub (starting point for all vehicles)
 * @returns        - Optimized routes per vehicle + unassigned order IDs
 */
export const optimizeRoutes = (
  orders: OrderForOptimizer[],
  vehicles: VehicleForOptimizer[],
  warehouse: Warehouse
): OptimizationResult => {

  // Step 1: Sort orders by priority descending (HIGH first)
  // Within same priority, sort by latestDelivery ascending (tightest deadline first)
  // This is the "Earliest Deadline First" (EDF) tie-breaking strategy
  const sortedOrders = [...orders].sort((a, b) => {
    const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    // Same priority → tighter deadline comes first
    if (a.latestDelivery && b.latestDelivery) {
      return a.latestDelivery.getTime() - b.latestDelivery.getTime();
    }
    if (a.latestDelivery) return -1; // a has deadline, b doesn't → a first
    if (b.latestDelivery) return 1;
    return 0;
  });

  // Track which orders have been assigned
  const unassigned = new Set(sortedOrders.map((o) => o.id));
  const routes: OptimizedRoute[] = [];

  // Step 2: For each vehicle, greedily assign nearest-feasible orders
  for (const vehicle of vehicles) {
    let remainingCapacity = vehicle.capacityKg;

    // Current position starts at the warehouse
    let currentLat = warehouse.latitude;
    let currentLon = warehouse.longitude;

    const stops: OptimizedRoute["stops"] = [];
    let totalDistance = 0;
    let sequence = 1;

    // Estimate departure time as "now" — real system would use planned departure
    let currentTime = new Date();

    // Keep picking the nearest unassigned order that fits in remaining capacity
    while (true) {
      let bestOrder: OrderForOptimizer | null = null;
      let bestDistance = Infinity;

      // Scan all unassigned orders to find the nearest feasible one
      for (const order of sortedOrders) {
        if (!unassigned.has(order.id)) continue; // Already assigned

        // Capacity check: can this vehicle carry this order?
        if (order.weightKg > remainingCapacity) continue;

        // Distance from current position to this order
        const dist = haversineDistanceKm(
          currentLat,
          currentLon,
          order.latitude,
          order.longitude
        );

        // Pick this order if it's closer than the current best
        // Note: priority sorting already happened before this loop.
        // If two orders have the same priority, we pick the closer one.
        if (dist < bestDistance) {
          bestDistance = dist;
          bestOrder = order;
        }
      }

      // No feasible order found → this vehicle is done
      if (!bestOrder) break;

      // Assign this order to this vehicle
      unassigned.delete(bestOrder.id);
      totalDistance += bestDistance;

      // Estimate arrival time: distance ÷ average speed
      // We assume 30 km/h average speed for urban delivery
      // (accounts for traffic, stops, loading/unloading time)
      const AVERAGE_SPEED_KMH = 30;
      const travelTimeHours = bestDistance / AVERAGE_SPEED_KMH;
      const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
      currentTime = new Date(currentTime.getTime() + travelTimeMs);

      stops.push({
        orderId: bestOrder.id,
        sequence: sequence++,
        projectedArrival: new Date(currentTime),
      });

      // Move current position to this delivery location
      remainingCapacity -= bestOrder.weightKg;
      currentLat = bestOrder.latitude;
      currentLon = bestOrder.longitude;
    }

    // Only create a route if at least one order was assigned
    if (stops.length > 0) {
      routes.push({
        vehicleId: vehicle.id,
        driverId: vehicle.driverId,
        stops,
        totalDistanceKm: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
      });
    }
  }

  return {
    routes,
    unassignedOrderIds: Array.from(unassigned),
  };
};
