/**
 * route.repository.ts — All DB operations for the route module.
 */

import { prisma } from "../../prisma/client";
import { RouteStatus, RouteStopStatus } from "@prisma/client";
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
  driver: { name: string; phone: string };
  vehicle: { plateNumber: string; capacityKg: number; type: string };
  _count: { stops: number };
};

export type RouteWithStops = RouteRecord & {
  warehouse: { name: string; latitude: number; longitude: number };
  stops: {
    id: string;
    orderId: string;
    stopSequence: number;
    projectedArrival: Date | null;
    actualArrival: Date | null;
    status: string;
    order: {
      customerName: string;
      address: string;
      weightKg: number;
      priority: string;
      latestDelivery: Date | null;
      latitude: number;
      longitude: number;
    };
  }[];
};

export const createRoutesWithStops = async (
  optimizedRoutes: OptimizedRoute[],
  warehouseId: string
): Promise<RouteRecord[]> => {
  const createdRoutes = await prisma.$transaction(async (tx) => {
    const results: RouteRecord[] = [];

    for (const optimized of optimizedRoutes) {
      const route = await tx.route.create({
        data: {
          driverId: optimized.driverId,
          vehicleId: optimized.vehicleId,
          warehouseId,
          status: "PLANNED",
          totalDistanceKm: optimized.totalDistanceKm,
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
          driver: { select: { name: true, phone: true } },
          vehicle: { select: { plateNumber: true, capacityKg: true, type: true } },
          _count: { select: { stops: true } },
        },
      });

      await tx.routeStop.createMany({
        data: optimized.stops.map((stop) => ({
          routeId: route.id,
          orderId: stop.orderId,
          stopSequence: stop.sequence,
          projectedArrival: stop.projectedArrival,
          status: "PENDING",
        })),
      });

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
      driver: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, capacityKg: true, type: true } },
      _count: { select: { stops: true } },
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
      driver: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, capacityKg: true, type: true } },
      _count: { select: { stops: true } },
      warehouse: { select: { name: true, latitude: true, longitude: true } },
      stops: {
        select: {
          id: true,
          orderId: true,
          stopSequence: true,
          projectedArrival: true,
          actualArrival: true,
          status: true,
          order: {
            select: {
              customerName: true,
              address: true,
              weightKg: true,
              priority: true,
              latestDelivery: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { stopSequence: "asc" },
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
      driver: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, capacityKg: true, type: true } },
      _count: { select: { stops: true } },
    },
  });
};

export const updateRouteStopStatus = async (
  stopId: string,
  status: RouteStopStatus,
  actualArrival?: Date
) => {
  return prisma.$transaction(async (tx) => {
    const stop = await tx.routeStop.update({
      where: { id: stopId },
      data: {
        status,
        ...(status === "COMPLETED" ? { actualArrival: actualArrival ?? new Date() } : {}),
      },
    });

    if (status === "COMPLETED") {
      await tx.order.update({
        where: { id: stop.orderId },
        data: { status: "DELIVERED" },
      });
    } else if (status === "FAILED") {
      await tx.order.update({
        where: { id: stop.orderId },
        data: { status: "FAILED" },
      });
    }

    return stop;
  });
};
