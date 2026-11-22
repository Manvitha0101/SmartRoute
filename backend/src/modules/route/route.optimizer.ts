/**
 * route.optimizer.ts — Multi-vehicle route optimization heuristic using OSRM road networks.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM: Capacitated Vehicle Routing Problem (CVRP)
 * ─────────────────────────────────────────────────────────────────────────────
 * Given:
 *   - A set of delivery orders (each with GPS coordinates, SLA deadlines, and weight)
 *   - A fleet of vehicles (each with a maximum weight payload capacity)
 *   - A warehouse depot (the common departure origin)
 *
 * Find: An assignment of orders to vehicles and a delivery sequence per vehicle
 * that minimizes total road distance and travel time while strictly respecting capacity.
 *
 * This problem is NP-Hard. We use a Priority-Weighted Greedy Nearest Neighbor
 * heuristic powered by an OSRM (Open Source Routing Machine) road-network distance
 * and duration matrix.
 */

import {
  getDistanceMatrix,
  haversineDistanceKm,
  type Coordinate,
  type DistanceDurationMatrix,
} from "./osrm.service";

// ─── Types ───────────────────────────────────────────────────────────────────

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

export type OptimizedRoute = {
  vehicleId: string;
  driverId: string;
  stops: {
    orderId: string;
    sequence: number; // 1-based stop sequence: 1, 2, 3...
    projectedArrival: Date | null;
  }[];
  totalDistanceKm: number;
  estimatedDurationMin: number;
};

export type OptimizationComparison = {
  greedyDistanceKm: number;
  randomDistanceKm: number;
  savingsPercent: number;
  trials: number;
  routingProvider: "osrm" | "fallback_haversine";
};

export type OptimizationResult = {
  routes: OptimizedRoute[];
  unassignedOrderIds: string[];
  comparison: OptimizationComparison;
  routingProvider: "osrm" | "fallback_haversine";
  warning: string | null;
};

// ─── Priority Scoring ────────────────────────────────────────────────────────

const priorityScore = (priority: string): number => {
  switch (priority) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
};

const round2 = (n: number) => Math.round(n * 100) / 100;

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

const totalDistanceKm = (routes: OptimizedRoute[]) =>
  round2(routes.reduce((sum, r) => sum + r.totalDistanceKm, 0));

// ─── Random Baseline using Road Matrix ───────────────────────────────────────

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Measure random first-fit route baseline using the exact same road distance matrix.
 */
const evaluateRandomBaselineKm = (
  orders: OrderForOptimizer[],
  vehicles: VehicleForOptimizer[],
  orderIndexMap: Map<string, number>,
  matrix: DistanceDurationMatrix,
  trials: number
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

    let trialTotalKm = 0;
    for (const bag of bags) {
      if (bag.orders.length === 0) continue;
      let currentIndex = 0; // warehouse depot is index 0
      for (const order of bag.orders) {
        const nextIndex = orderIndexMap.get(order.id) ?? 0;
        const dist = matrix.distancesKm[currentIndex]?.[nextIndex] ?? 0;
        trialTotalKm += isFinite(dist) ? dist : 0;
        currentIndex = nextIndex;
      }
    }
    sum += trialTotalKm;
  }

  return round2(sum / trials);
};

// ─── Main Optimization Algorithm ─────────────────────────────────────────────

/**
 * Priority-driven Greedy Nearest Neighbor heuristic using road distance and travel durations.
 *
 * Complexity:
 * - OSRM matrix query: O(1) batch network call for (N+1) x (N+1) table
 * - Optimization search: O(N² × K) where N = orders, K = vehicles
 */
export const optimizeRoutes = async (
  orders: OrderForOptimizer[],
  vehicles: VehicleForOptimizer[],
  warehouse: Warehouse,
  options?: { randomTrials?: number; allowFallback?: boolean }
): Promise<OptimizationResult> => {
  if (orders.length === 0 || vehicles.length === 0) {
    return {
      routes: [],
      unassignedOrderIds: orders.map((o) => o.id),
      comparison: {
        greedyDistanceKm: 0,
        randomDistanceKm: 0,
        savingsPercent: 0,
        trials: 0,
        routingProvider: "osrm",
      },
      routingProvider: "osrm",
      warning: null,
    };
  }

  const sortedOrders = sortOrdersForGreedy(orders);

  // Index 0: Warehouse. Index 1..N: Sorted orders
  const locations: Coordinate[] = [
    { latitude: warehouse.latitude, longitude: warehouse.longitude },
    ...sortedOrders.map((o) => ({ latitude: o.latitude, longitude: o.longitude })),
  ];

  const orderIndexMap = new Map<string, number>();
  sortedOrders.forEach((o, idx) => orderIndexMap.set(o.id, idx + 1));

  // Request road network distance and duration matrix via OSRM service
  const matrix = await getDistanceMatrix(locations, {
    allowFallback: options?.allowFallback,
  });

  const unassigned = new Set(sortedOrders.map((o) => o.id));
  const routes: OptimizedRoute[] = [];

  for (const vehicle of vehicles) {
    let remainingCapacity = vehicle.capacityKg;
    let currentIndex = 0; // Starts at warehouse depot (index 0)
    const stops: OptimizedRoute["stops"] = [];
    let totalDistance = 0;
    let totalDurationMin = 0;
    let sequence = 1;
    let currentTime = new Date();

    while (true) {
      let bestOrder: OrderForOptimizer | null = null;
      let bestIndex = -1;
      let bestDistance = Infinity;

      for (const order of sortedOrders) {
        if (!unassigned.has(order.id)) continue;
        if (order.weightKg > remainingCapacity) continue;

        const candidateIndex = orderIndexMap.get(order.id)!;
        const roadDistance = matrix.distancesKm[currentIndex]?.[candidateIndex];

        // Skip unreachable roads or disconnected points
        if (roadDistance === undefined || !isFinite(roadDistance)) continue;

        if (roadDistance < bestDistance) {
          bestDistance = roadDistance;
          bestOrder = order;
          bestIndex = candidateIndex;
        }
      }

      if (!bestOrder || bestIndex === -1) break;

      unassigned.delete(bestOrder.id);
      totalDistance += bestDistance;

      // Extract accurate road travel duration from OSRM matrix
      const roadDurationMin = matrix.durationsMin[currentIndex]?.[bestIndex] ?? 0;
      const validDurationMin = isFinite(roadDurationMin) ? roadDurationMin : (bestDistance / 30) * 60;
      totalDurationMin += validDurationMin;

      currentTime = new Date(currentTime.getTime() + validDurationMin * 60 * 1000);

      stops.push({
        orderId: bestOrder.id,
        sequence: sequence++,
        projectedArrival: new Date(currentTime),
      });

      remainingCapacity -= bestOrder.weightKg;
      currentIndex = bestIndex;
    }

    if (stops.length > 0) {
      routes.push({
        vehicleId: vehicle.id,
        driverId: vehicle.driverId,
        stops,
        totalDistanceKm: round2(totalDistance),
        estimatedDurationMin: Math.round(totalDurationMin),
      });
    }
  }

  const trials = options?.randomTrials ?? 25;
  const greedyDistanceKm = totalDistanceKm(routes);
  const randomDistanceKm = evaluateRandomBaselineKm(
    orders,
    vehicles,
    orderIndexMap,
    matrix,
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
      routingProvider: matrix.provider,
    },
    routingProvider: matrix.provider,
    warning: matrix.warning,
  };
};

export { haversineDistanceKm };
