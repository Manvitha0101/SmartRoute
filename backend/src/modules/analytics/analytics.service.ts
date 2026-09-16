/**
 * analytics.service.ts — Combines raw DB data into the analytics response shape.
 *
 * NEW CONCEPT: Promise.all — PARALLEL DB QUERIES
 *
 * The summary endpoint needs 4 separate pieces of data:
 *   1. Order counts by status
 *   2. Route counts by status
 *   3. Average route distance
 *   4. Top warehouses by order count
 *
 * SEQUENTIAL (bad):
 *   const orders = await getOrderCounts();     // 20ms
 *   const routes = await getRouteCounts();     // 20ms
 *   const avg    = await getAvgDistance();     // 20ms
 *   const top    = await getTopWarehouses();   // 20ms
 *   // Total: 80ms
 *
 * PARALLEL with Promise.all (good):
 *   const [orders, routes, avg, top] = await Promise.all([...]);
 *   // Total: ~20ms (all 4 run at the same time)
 *
 * WHY Promise.all IS SAFE HERE:
 * These 4 queries are INDEPENDENT — none depends on the result of another.
 * Promise.all fires all of them simultaneously and waits for all to complete.
 * If ANY one fails, Promise.all rejects immediately (fail-fast).
 *
 * WHEN NOT TO USE Promise.all:
 * When query B needs the result of query A.
 * Example: create a route → THEN create stops using the route.id
 * That's sequential — use await one after the other.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DERIVED METRIC: Delivery Success Rate
 * ─────────────────────────────────────────────────────────────────────────────
 * Formula: (DELIVERED / (DELIVERED + FAILED)) × 100
 *
 * WHY NOT INCLUDE CANCELLED:
 * Cancelled orders are a business decision (customer changed mind, etc.)
 * They don't reflect driver performance or system reliability.
 * Success rate measures: "of orders that were actually attempted, how many succeeded?"
 * CANCELLED orders were never attempted, so they're excluded.
 */

import * as analyticsRepo from "./analytics.repository";

export const getSummary = async () => {
  // ── Step 1: Fire all 4 DB queries in parallel ────────────────────────────
  const [
    orderCountsByStatus,
    routeCountsByStatus,
    avgDistanceKm,
    topWarehousesByCount,
  ] = await Promise.all([
    analyticsRepo.getOrderCountsByStatus(),
    analyticsRepo.getRouteCountsByStatus(),
    analyticsRepo.getAvgRouteDistance(),
    analyticsRepo.getTopWarehousesByOrderCount(5),
  ]);

  // ── Step 2: Transform groupBy results into a flat object ─────────────────
  // groupBy returns: [{ status: "PENDING", _count: { id: 30 } }, ...]
  // We want:         { pending: 30, delivered: 75, ... }

  // Helper: convert groupBy array → { STATUS: count } map
  const toStatusMap = (rows: { status: string; _count: { id: number } }[]) => {
    return rows.reduce(
      (acc, row) => {
        acc[row.status] = row._count.id;
        return acc;
      },
      {} as Record<string, number>
    );
  };

  const orderMap = toStatusMap(orderCountsByStatus as any);
  const routeMap = toStatusMap(routeCountsByStatus as any);

  // ── Step 3: Build order stats ─────────────────────────────────────────────
  const orders = {
    total:
      (orderMap["PENDING"] ?? 0) +
      (orderMap["ASSIGNED"] ?? 0) +
      (orderMap["DELIVERED"] ?? 0) +
      (orderMap["FAILED"] ?? 0) +
      (orderMap["CANCELLED"] ?? 0),
    pending:   orderMap["PENDING"]   ?? 0,
    assigned:  orderMap["ASSIGNED"]  ?? 0,
    delivered: orderMap["DELIVERED"] ?? 0,
    failed:    orderMap["FAILED"]    ?? 0,
    cancelled: orderMap["CANCELLED"] ?? 0,
  };

  // ── Step 4: Build route stats ─────────────────────────────────────────────
  const routes = {
    total:
      (routeMap["PLANNED"] ?? 0) +
      (routeMap["IN_PROGRESS"] ?? 0) +
      (routeMap["COMPLETED"] ?? 0) +
      (routeMap["CANCELLED"] ?? 0),
    planned:    routeMap["PLANNED"]     ?? 0,
    inProgress: routeMap["IN_PROGRESS"] ?? 0,
    completed:  routeMap["COMPLETED"]   ?? 0,
    cancelled:  routeMap["CANCELLED"]   ?? 0,
    // Round to 2 decimal places for clean display
    avgDistanceKm: Math.round(avgDistanceKm * 100) / 100,
  };

  // ── Step 5: Delivery success rate ─────────────────────────────────────────
  // Only count orders that were actually attempted (DELIVERED + FAILED)
  const attempted = orders.delivered + orders.failed;
  const deliverySuccessRate =
    attempted === 0
      ? null // No deliveries attempted yet — don't show 0%, show null
      : Math.round((orders.delivered / attempted) * 10000) / 100; // 2 decimal places

  // ── Step 6: Enrich warehouse leaderboard with names ───────────────────────
  const warehouseIds = topWarehousesByCount.map((r) => r.warehouseId);
  const warehouseNames = await analyticsRepo.getWarehouseNamesByIds(warehouseIds);
  const nameMap = Object.fromEntries(warehouseNames.map((w) => [w.id, w.name]));

  const busyWarehouses = topWarehousesByCount.map((r) => ({
    warehouseId: r.warehouseId,
    name: nameMap[r.warehouseId] ?? "Unknown",
    orderCount: r._count.id,
  }));

  return {
    orders,
    routes,
    deliverySuccessRate,
    busyWarehouses,
  };
};
