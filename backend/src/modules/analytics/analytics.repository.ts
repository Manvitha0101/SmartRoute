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
 * prisma.model.count()     → SQL: SELECT COUNT(*) FROM orders WHERE ...
 *
 * WHY AGGREGATE IN THE DB, NOT IN JAVASCRIPT:
 * If you have 100,000 orders, fetching all of them into Node.js to count
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
 * SQL equivalent:
 *   SELECT warehouseId, COUNT(*) as orderCount FROM orders
 *   WHERE deletedAt IS NULL
 *   GROUP BY warehouseId
 *   ORDER BY orderCount DESC
 *   LIMIT 5
 *
 * We then JOIN to the warehouse name in the service layer.
 */
export const getTopWarehousesByOrderCount = async (limit = 5) => {
  return prisma.order.groupBy({
    by: ["warehouseId"],
    where: { deletedAt: null },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });
  // Returns: [{ warehouseId: "...", _count: { id: 45 } }, ...]
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
