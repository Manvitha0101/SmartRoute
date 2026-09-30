/**
 * Offline benchmark: nearest-neighbor vs random first-fit assignment.
 * Run: npx tsx scripts/benchmark-optimizer.ts
 *
 * Uses a Hyderabad-like synthetic set (no DB required) so you have a
 * resume-ready metric: "greedy cut ~X% distance vs random baseline".
 */

import {
  optimizeRoutes,
  type OrderForOptimizer,
  type VehicleForOptimizer,
} from "../src/modules/route/route.optimizer";

const warehouse = { latitude: 17.4401, longitude: 78.3489 };

const orders: OrderForOptimizer[] = [
  { id: "1", latitude: 17.46, longitude: 78.352, weightKg: 12.5, priority: "HIGH", earliestDelivery: null, latestDelivery: null },
  { id: "2", latitude: 17.4375, longitude: 78.4483, weightKg: 32, priority: "MEDIUM", earliestDelivery: null, latestDelivery: null },
  { id: "3", latitude: 17.4239, longitude: 78.4388, weightKg: 18, priority: "LOW", earliestDelivery: null, latestDelivery: null },
  { id: "4", latitude: 17.4504, longitude: 78.3808, weightKg: 28.5, priority: "HIGH", earliestDelivery: null, latestDelivery: null },
  { id: "5", latitude: 17.6184, longitude: 78.5833, weightKg: 20, priority: "MEDIUM", earliestDelivery: null, latestDelivery: null },
  { id: "6", latitude: 17.4842, longitude: 78.3888, weightKg: 42, priority: "MEDIUM", earliestDelivery: null, latestDelivery: null },
  { id: "7", latitude: 17.385, longitude: 78.4867, weightKg: 15, priority: "LOW", earliestDelivery: null, latestDelivery: null },
  { id: "8", latitude: 17.444, longitude: 78.391, weightKg: 22, priority: "HIGH", earliestDelivery: null, latestDelivery: null },
];

const vehicles: VehicleForOptimizer[] = [
  { id: "v1", driverId: "d1", capacityKg: 850 },
  { id: "v2", driverId: "d2", capacityKg: 950 },
];

const result = optimizeRoutes(orders, vehicles, warehouse, { randomTrials: 50 });
const { comparison } = result;

console.log("SmartRoute optimizer benchmark (Hyderabad-like sample)");
console.log("─────────────────────────────────────────────────────");
console.log(`Orders: ${orders.length}  |  Vehicles: ${vehicles.length}`);
console.log(`Greedy (nearest-neighbor): ${comparison.greedyDistanceKm} km`);
console.log(`Random baseline (avg of ${comparison.trials} trials): ${comparison.randomDistanceKm} km`);
console.log(`Distance savings vs random: ${comparison.savingsPercent}%`);
console.log(`Routes created: ${result.routes.length}`);
console.log(`Unassigned: ${result.unassignedOrderIds.length}`);
console.log("");
console.log(
  `Resume line: "Nearest-neighbor VRP cut ~${Math.round(comparison.savingsPercent)}% travel distance vs random assignment on seeded Hyderabad orders."`
);
