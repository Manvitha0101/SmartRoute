/**
 * analytics.repository.ts — Raw DB queries for analytics.
 *
 * NEW CONCEPT: PRISMA AGGREGATIONS
 *
 * Instead of fetching all rows and counting in JavaScript,
 * we push the aggregation work to PostgreSQL — it's much faster.
 *
 * prisma.model.groupBy()   → SQL: SELECT status, COUNT(*) FROM orders GROUP BY status
 * prisma.model.aggregate() → SQL: SELECT AVG(totalDistanceKm) FROM routes
 * prisma.model.count()     → SQL: SELECT COUNT(*) FROM orders WHERE ...\n *
 * WHY AGGREGATE IN THE DB, NOT IN JAVASCRIPT:\n * If you have 100,000 orders, fetching all of them into Node.js to count
 * them is: 100,000 rows × ~200 bytes = 20MB transferred over the network.
 * Aggregating in PostgreSQL returns one row: { status: "PENDING", _count: 30 }
 * Zero unnecessary data transferred. Orders of magnitude faster.
 */

import { prisma } from "../../prisma/client";

// ─── Order stats ───────────────────────────────────────────────────────────────

/**
 * Count orders grouped by status.
 * SQL equivalent:
 *   SELECT status, COUNT(*) as count FROM orders
 *   WHERE deletedAt IS NULL
 *   GROUP BY status
 */
export const getOrderCountsByStatus = async () => {
  return prisma.order.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: { id: true },
  });
  // Returns: [{ status: "PENDING", _count: { id: 30 } }, ...]
};

// ─── Route stats ───────────────────────────────────────────────────────────────

/**
 * Count routes grouped by status.
 */
export const getRouteCountsByStatus = async () => {
  return prisma.route.groupBy({
    by: ["status"],
    _count: { id: true },
  });
};

/**
 * Average distance across all completed routes.
 * SQL equivalent:
 *   SELECT AVG(totalDistanceKm) FROM routes WHERE status = 'COMPLETED'
 *
 * WHY ONLY COMPLETED:
 * PLANNED routes have estimated distance. IN_PROGRESS routes have partial actual.
 * Only COMPLETED routes have the full, accurate total distance.
 */
export const getAvgRouteDistance = async (): Promise<number> => {
  const result = await prisma.route.aggregate({
    where: { status: "COMPLETED", totalDistanceKm: { not: null } },
    _avg: { totalDistanceKm: true },
  });
  // _avg.totalDistanceKm is null if no completed routes exist
  return result._avg.totalDistanceKm ?? 0;
};

// ─── Warehouse leaderboard ─────────────────────────────────────────────────────

/**
 * Top 5 warehouses by number of orders dispatched.
 */
export const getTopWarehousesByOrderCount = async (limit = 5) => {
  return prisma.order.groupBy({
    by: ["warehouseId"],
    where: { deletedAt: null },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
};

/**
 * Fetch warehouse names for a list of IDs.
 * Used to enrich the leaderboard with human-readable names.
 */
export const getWarehouseNamesByIds = async (ids: string[]) => {
  return prisma.warehouse.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
};

// ─── Dispatcher Live Feed ──────────────────────────────────────────────────────

/**
 * Active routes (IN_PROGRESS) with driver, vehicle, warehouse, and stop counts.
 * Powers the dispatcher's real-time operations view.
 */
export const getActiveRoutes = async () => {
  return prisma.route.findMany({
    where: { status: "IN_PROGRESS" },
    include: {
      driver: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, type: true } },
      warehouse: { select: { name: true } },
      _count: { select: { stops: true } },
    },
    orderBy: { actualDepartureAt: "desc" },
    take: 10,
  });
};

/**
 * Planned routes ready to be dispatched.
 */
export const getPlannedRoutes = async () => {
  return prisma.route.findMany({
    where: { status: "PLANNED" },
    include: {
      driver: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, type: true } },
      warehouse: { select: { name: true } },
      _count: { select: { stops: true } },
    },
    orderBy: { plannedDepartureAt: "asc" },
    take: 10,
  });
};

/**
 * Count of pending (unassigned) orders — dispatcher's action queue.
 */
export const getPendingOrderCount = async (): Promise<number> => {
  return prisma.order.count({ where: { status: "PENDING", deletedAt: null } });
};

/**
 * Count of available drivers (those with no IN_PROGRESS routes).
 */
export const getAvailableDriverCount = async (): Promise<number> => {
  const busyDriverIds = await prisma.route.findMany({
    where: { status: "IN_PROGRESS" },
    select: { driverId: true },
  });
  const busyIds = busyDriverIds.map((r) => r.driverId);
  return prisma.driver.count({
    where: busyIds.length ? { id: { notIn: busyIds } } : {},
  });
};
