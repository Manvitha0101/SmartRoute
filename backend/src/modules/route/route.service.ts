/**
 * route.service.ts — Business logic for the route module.
 *
 * This service coordinates between the repository and the optimizer.
 * The optimizer is a pure function — it doesn't know about Prisma.
 * The service feeds it data from the DB and saves its output back.
 *
 * BUSINESS RULES:
 *
 * OPTIMIZE:
 * 1. Warehouse must exist
 * 2. All vehicleIds must exist and not be deleted
 * 3. All driverIds must exist and not be deleted
 * 4. Must be at least one PENDING order for this warehouse
 * 5. No vehicle can be on an existing IN_PROGRESS route (it's already deployed)
 *
 * STATUS TRANSITIONS:
 *   PLANNED     → IN_PROGRESS (start)
 *   IN_PROGRESS → COMPLETED   (complete)
 *   PLANNED     → CANCELLED   (cancel — only before departure)
 *
 * A route can't go: COMPLETED → anything, CANCELLED → anything (terminal states)
 */

import { AppError } from "../../utils/AppError";
import * as routeRepo from "./route.repository";
import { optimizeRoutes } from "./route.optimizer";
import type { OptimizeRouteInput } from "./route.schemas";

// ─── Optimize ──────────────────────────────────────────────────────────────────

export const optimize = async (data: OptimizeRouteInput) => {
  const { prisma } = await import("../../prisma/client");

  // Rule 1: Warehouse must exist
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

  // Rule 2: All vehicles must exist and not be on an active route
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

  // Rule: Check no vehicle is already on an active route
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

  // Rule 3: All drivers must exist
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

  // Rule 4: Must have pending orders
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

  // Build vehicle+driver pairs for the optimizer
  // vehicleIds[0] pairs with driverIds[0], etc.
  const vehiclesForOptimizer = vehicles.map((v, index) => ({
    id: v.id,
    driverId: data.driverIds[index],
    capacityKg: v.capacityKg,
  }));

  // ── Run the optimizer ──────────────────────────────────────────────────────
  const result = optimizeRoutes(
    pendingOrders as any,
    vehiclesForOptimizer,
    { latitude: warehouse.latitude, longitude: warehouse.longitude }
  );

  // ── Save results to DB ─────────────────────────────────────────────────────
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
    // Surface a warning if some orders couldn't be assigned
    warning:
      result.unassignedOrderIds.length > 0
        ? `${result.unassignedOrderIds.length} order(s) could not be assigned — vehicles may be at full capacity. Add more vehicles or increase capacity.`
        : null,
  };
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export const getAllRoutes = async () => {
  return routeRepo.findAllRoutes();
};

export const getRouteById = async (id: string) => {
  const route = await routeRepo.findRouteById(id);
  if (!route) {
    throw AppError.notFound("Route not found", "ROUTE_NOT_FOUND");
  }
  return route;
};

// ─── Status transitions ────────────────────────────────────────────────────────

/**
 * Start a route (PLANNED → IN_PROGRESS).
 * Records the actual departure time.
 */
export const startRoute = async (id: string) => {
  const route = await getRouteById(id);

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

/**
 * Complete a route (IN_PROGRESS → COMPLETED).
 * Records the completion time.
 */
export const completeRoute = async (id: string) => {
  const route = await getRouteById(id);

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

/**
 * Cancel a route (PLANNED → CANCELLED).
 * When cancelled, all ASSIGNED orders in this route revert to PENDING
 * so they can be picked up in the next optimization run.
 *
 * WHY REVERT ORDERS TO PENDING:
 * If a route is cancelled before departure, the orders are stranded.
 * They'd stay ASSIGNED forever, invisible to the next optimization run
 * (which only picks PENDING orders). Reverting them makes them available again.
 */
export const cancelRoute = async (id: string) => {
  const route = await getRouteById(id);

  if (route.status !== "PLANNED") {
    throw AppError.badRequest(
      `Cannot cancel route — current status is "${route.status}". Only PLANNED routes can be cancelled.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const { prisma } = await import("../../prisma/client");

  // Revert all orders in this route back to PENDING
  const orderIds = route.stops.map((s) => s.orderId);

  await prisma.$transaction([
    // Cancel the route
    prisma.route.update({
      where: { id },
      data: { status: "CANCELLED" },
    }),
    // Revert orders to PENDING so they're available for the next run
    prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: "PENDING" },
    }),
  ]);

  return { message: `Route cancelled. ${orderIds.length} order(s) reverted to PENDING.` };
};
