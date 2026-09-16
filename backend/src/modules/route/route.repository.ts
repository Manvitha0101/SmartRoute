/**
 * route.repository.ts — All DB operations for the route module.
 *
 * KEY DIFFERENCE from previous repositories:
 * Routes are complex — they JOIN to RouteStops, which JOIN to Orders.
 * The `include` clause in Prisma fetches related records in one query
 * (a SQL JOIN under the hood), avoiding N+1 queries.
 *
 * N+1 PROBLEM (what we're avoiding):
 * Bad: fetch 10 routes → for each route, fetch its stops → 11 DB queries
 * Good: fetch 10 routes WITH stops in one query → 1 DB query
 * `include: { stops: true }` does the JOIN for us.
 */

import { prisma } from "../../prisma/client";
import { RouteStatus } from "@prisma/client";
import type { OptimizedRoute } from "./route.optimizer";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RouteRecord = {
  id: string;
  driverId: string;
  vehicleId: string;
  warehouseId: string;
  status: string;
  totalDistanceKm: number | null;
  estimatedDurationMin: number | null;
  plannedDepartureAt: Date | null;
  actualDepartureAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RouteWithStops = RouteRecord & {
  stops: {
    id: string;
    orderId: string;
    stopSequence: number;
    projectedArrival: Date | null;
    actualArrival: Date | null;
    status: string;
  }[];
};

// ─── Batch route creation (called by optimizer service) ───────────────────────

/**
 * Create all routes and their stops in a single Prisma transaction.
 *
 * WHY TRANSACTION:
 * Creating 3 routes with 10 stops each = 13 DB writes.
 * If stop #7 fails (e.g. constraint violation), without a transaction
 * we'd have partial data: 3 routes created but only 6 stops.
 * The route would reference orders that were never properly assigned.
 *
 * prisma.$transaction([...]) wraps all operations in one atomic unit:
 * ALL succeed, or ALL roll back. No partial state.
 *
 * WHY NOT prisma.$transaction(async (tx) => {...}):
 * That's the interactive transaction style — needed when later operations
 * depend on the result of earlier ones (e.g. you need the created route ID
 * to create its stops). We do need that here, so we use the callback style.
 */
export const createRoutesWithStops = async (
  optimizedRoutes: OptimizedRoute[],
  warehouseId: string
): Promise<RouteRecord[]> => {
  // Use interactive transaction — we need the route ID to create its stops
  const createdRoutes = await prisma.$transaction(async (tx) => {
    const results: RouteRecord[] = [];

    for (const optimized of optimizedRoutes) {
      // Step 1: Create the Route record
      const route = await tx.route.create({
        data: {
          driverId: optimized.driverId,
          vehicleId: optimized.vehicleId,
          warehouseId,
          status: "PLANNED",
          totalDistanceKm: optimized.totalDistanceKm,
          // Estimate duration: distance ÷ 30 km/h → hours → minutes
          estimatedDurationMin: Math.round((optimized.totalDistanceKm / 30) * 60),
        },
        select: {
          id: true,
          driverId: true,
          vehicleId: true,
          warehouseId: true,
          status: true,
          totalDistanceKm: true,
          estimatedDurationMin: true,
          plannedDepartureAt: true,
          actualDepartureAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Step 2: Create RouteStop records for this route
      await tx.routeStop.createMany({
        data: optimized.stops.map((stop) => ({
          routeId: route.id,
          orderId: stop.orderId,
          stopSequence: stop.sequence,
          projectedArrival: stop.projectedArrival,
          status: "PENDING",
        })),
      });

      // Step 3: Mark all assigned orders as ASSIGNED
      await tx.order.updateMany({
        where: { id: { in: optimized.stops.map((s) => s.orderId) } },
        data: { status: "ASSIGNED" },
      });

      results.push(route);
    }

    return results;
  });

  return createdRoutes;
};

// ─── Read operations ───────────────────────────────────────────────────────────

export const findAllRoutes = async (): Promise<RouteRecord[]> => {
  return prisma.route.findMany({
    select: {
      id: true,
      driverId: true,
      vehicleId: true,
      warehouseId: true,
      status: true,
      totalDistanceKm: true,
      estimatedDurationMin: true,
      plannedDepartureAt: true,
      actualDepartureAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

export const findRouteById = async (
  id: string
): Promise<RouteWithStops | null> => {
  return prisma.route.findUnique({
    where: { id },
    select: {
      id: true,
      driverId: true,
      vehicleId: true,
      warehouseId: true,
      status: true,
      totalDistanceKm: true,
      estimatedDurationMin: true,
      plannedDepartureAt: true,
      actualDepartureAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      // JOIN: include all stops for this route, ordered by sequence
      stops: {
        select: {
          id: true,
          orderId: true,
          stopSequence: true,
          projectedArrival: true,
          actualArrival: true,
          status: true,
        },
        orderBy: { stopSequence: "asc" }, // Stop 1 first, then 2, then 3...
      },
    },
  });
};

export const updateRouteStatus = async (
  id: string,
  status: RouteStatus,
  extra?: {
    actualDepartureAt?: Date;
    completedAt?: Date;
  }
): Promise<RouteRecord> => {
  return prisma.route.update({
    where: { id },
    data: { status, ...extra },
    select: {
      id: true,
      driverId: true,
      vehicleId: true,
      warehouseId: true,
      status: true,
      totalDistanceKm: true,
      estimatedDurationMin: true,
      plannedDepartureAt: true,
      actualDepartureAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};
