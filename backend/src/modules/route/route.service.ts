/**
 * route.service.ts — Business logic for the route module.
 */

import { AppError } from "../../utils/AppError";
import * as routeRepo from "./route.repository";
import { optimizeRoutes } from "./route.optimizer";
import type { OptimizeRouteInput, UpdateStopStatusInput } from "./route.schemas";

type Actor = { id: string; role: "ADMIN" | "DISPATCHER" | "DRIVER" };

const resolveDriverIdForUser = async (userId: string): Promise<string> => {
  const { prisma } = await import("../../prisma/client");
  const driver = await prisma.driver.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  if (!driver) {
    throw AppError.forbidden("No driver profile linked to this account");
  }
  return driver.id;
};

const assertRouteAccess = async (routeId: string, actor?: Actor) => {
  const route = await routeRepo.findRouteById(routeId);
  if (!route) {
    throw AppError.notFound("Route not found", "ROUTE_NOT_FOUND");
  }
  if (actor?.role === "DRIVER") {
    const driverId = await resolveDriverIdForUser(actor.id);
    if (route.driverId !== driverId) {
      throw AppError.forbidden("You can only access your own routes");
    }
  }
  return route;
};

// ─── Optimize ──────────────────────────────────────────────────────────────────

export const optimize = async (data: OptimizeRouteInput) => {
  const { prisma } = await import("../../prisma/client");

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, deletedAt: null },
    select: { id: true, latitude: true, longitude: true, name: true },
  });
  if (!warehouse) {
    throw AppError.badRequest(
      `Warehouse with ID "${data.warehouseId}" does not exist`,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      id: { in: data.vehicleIds },
      deletedAt: null,
    },
    select: { id: true, capacityKg: true },
  });

  if (vehicles.length !== data.vehicleIds.length) {
    throw AppError.badRequest(
      "One or more vehicleIds are invalid or refer to deleted vehicles",
      "INVALID_VEHICLES"
    );
  }

  const activeRouteVehicle = await prisma.route.findFirst({
    where: {
      vehicleId: { in: data.vehicleIds },
      status: "IN_PROGRESS",
    },
    select: { vehicleId: true },
  });
  if (activeRouteVehicle) {
    throw AppError.badRequest(
      `Vehicle "${activeRouteVehicle.vehicleId}" is currently on an active route`,
      "VEHICLE_ALREADY_DEPLOYED"
    );
  }

  const drivers = await prisma.driver.findMany({
    where: {
      id: { in: data.driverIds },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (drivers.length !== data.driverIds.length) {
    throw AppError.badRequest(
      "One or more driverIds are invalid or refer to deleted drivers",
      "INVALID_DRIVERS"
    );
  }

  const pendingOrders = await prisma.order.findMany({
    where: {
      warehouseId: data.warehouseId,
      status: "PENDING",
      deletedAt: null,
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      weightKg: true,
      priority: true,
      earliestDelivery: true,
      latestDelivery: true,
    },
  });

  if (pendingOrders.length === 0) {
    throw AppError.badRequest(
      "No pending orders found for this warehouse. Create orders before optimizing.",
      "NO_PENDING_ORDERS"
    );
  }

  const vehiclesForOptimizer = vehicles.map((v, index) => ({
    id: v.id,
    driverId: data.driverIds[index],
    capacityKg: v.capacityKg,
  }));

  const result = optimizeRoutes(
    pendingOrders as any,
    vehiclesForOptimizer,
    { latitude: warehouse.latitude, longitude: warehouse.longitude }
  );

  if (result.routes.length === 0) {
    throw AppError.badRequest(
      "Optimization produced no routes — orders may be too heavy for available vehicles",
      "OPTIMIZATION_FAILED"
    );
  }

  const createdRoutes = await routeRepo.createRoutesWithStops(
    result.routes,
    data.warehouseId
  );

  return {
    routesCreated: createdRoutes.length,
    routes: createdRoutes,
    unassignedOrderCount: result.unassignedOrderIds.length,
    unassignedOrderIds: result.unassignedOrderIds,
    comparison: result.comparison,
    warning:
      result.unassignedOrderIds.length > 0
        ? `${result.unassignedOrderIds.length} order(s) could not be assigned — vehicles may be at full capacity. Add more vehicles or increase capacity.`
        : null,
  };
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export const getAllRoutes = async (actor?: Actor) => {
  if (actor?.role === "DRIVER") {
    const driverId = await resolveDriverIdForUser(actor.id);
    return routeRepo.findRoutesByDriverId(driverId);
  }
  return routeRepo.findAllRoutes();
};

export const getRouteById = async (id: string, actor?: Actor) => {
  return assertRouteAccess(id, actor);
};

// ─── Status transitions ────────────────────────────────────────────────────────

export const startRoute = async (id: string, actor?: Actor) => {
  const route = await assertRouteAccess(id, actor);

  if (route.status !== "PLANNED") {
    throw AppError.badRequest(
      `Cannot start route — current status is "${route.status}". Only PLANNED routes can be started.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  return routeRepo.updateRouteStatus(id, "IN_PROGRESS", {
    actualDepartureAt: new Date(),
  });
};

export const completeRoute = async (id: string, actor?: Actor) => {
  const route = await assertRouteAccess(id, actor);

  if (route.status !== "IN_PROGRESS") {
    throw AppError.badRequest(
      `Cannot complete route — current status is "${route.status}". Only IN_PROGRESS routes can be completed.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  return routeRepo.updateRouteStatus(id, "COMPLETED", {
    completedAt: new Date(),
  });
};

export const cancelRoute = async (id: string, actor?: Actor) => {
  const route = await assertRouteAccess(id, actor);

  if (route.status !== "PLANNED") {
    throw AppError.badRequest(
      `Cannot cancel route — current status is "${route.status}". Only PLANNED routes can be cancelled.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const { prisma } = await import("../../prisma/client");

  const orderIds = route.stops.map((s) => s.orderId);

  await prisma.$transaction([
    prisma.route.update({
      where: { id },
      data: { status: "CANCELLED" },
    }),
    prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: "PENDING" },
    }),
  ]);

  return { message: `Route cancelled. ${orderIds.length} order(s) reverted to PENDING.` };
};

export const updateStopStatus = async (
  routeId: string,
  stopId: string,
  data: UpdateStopStatusInput,
  actor?: Actor
) => {
  const route = await assertRouteAccess(routeId, actor);
  const stop = route.stops.find((s) => s.id === stopId);
  if (!stop) {
    throw AppError.notFound("Stop not found on this route", "STOP_NOT_FOUND");
  }

  const arrivalDate = data.actualArrival ? new Date(data.actualArrival) : undefined;
  return routeRepo.updateRouteStopStatus(stopId, data.status as any, arrivalDate);
};
