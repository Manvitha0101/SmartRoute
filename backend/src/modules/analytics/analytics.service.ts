/**
 * analytics.service.ts — Combines raw DB data into the analytics response shapes.
 */

import * as analyticsRepo from "./analytics.repository";

// ─── Admin summary ─────────────────────────────────────────────────────────────

export const getSummary = async () => {
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
    avgDistanceKm: Math.round(avgDistanceKm * 100) / 100,
  };

  const attempted = orders.delivered + orders.failed;
  const deliverySuccessRate =
    attempted === 0
      ? null
      : Math.round((orders.delivered / attempted) * 10000) / 100;

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

// ─── Dispatcher live feed ──────────────────────────────────────────────────────

export const getDispatcherLive = async () => {
  const [activeRoutes, plannedRoutes, pendingOrderCount, availableDriverCount] =
    await Promise.all([
      analyticsRepo.getActiveRoutes(),
      analyticsRepo.getPlannedRoutes(),
      analyticsRepo.getPendingOrderCount(),
      analyticsRepo.getAvailableDriverCount(),
    ]);

  return {
    pendingOrderCount,
    availableDriverCount,
    activeRoutes: activeRoutes.map((r) => ({
      id: r.id,
      driverName: r.driver?.name ?? "Unknown",
      driverPhone: r.driver?.phone ?? "",
      vehiclePlate: r.vehicle?.plateNumber ?? "",
      vehicleType: r.vehicle?.type ?? "",
      warehouseName: r.warehouse?.name ?? "Unknown",
      totalStops: r._count.stops,
      totalDistanceKm: r.totalDistanceKm,
      estimatedDurationMin: r.estimatedDurationMin,
      actualDepartureAt: r.actualDepartureAt,
    })),
    plannedRoutes: plannedRoutes.map((r) => ({
      id: r.id,
      driverName: r.driver?.name ?? "Unknown",
      driverPhone: r.driver?.phone ?? "",
      vehiclePlate: r.vehicle?.plateNumber ?? "",
      vehicleType: r.vehicle?.type ?? "",
      warehouseName: r.warehouse?.name ?? "Unknown",
      totalStops: r._count.stops,
      totalDistanceKm: r.totalDistanceKm,
      estimatedDurationMin: r.estimatedDurationMin,
      plannedDepartureAt: r.plannedDepartureAt,
    })),
  };
};
