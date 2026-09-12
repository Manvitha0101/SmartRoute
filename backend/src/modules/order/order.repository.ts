/**
 * order.repository.ts — All database operations for the order module.
 *
 * NEW CONCEPT: FILTERING / QUERYING with query params
 *
 * The GET /orders endpoint supports filters:
 *   ?status=PENDING
 *   ?priority=HIGH
 *   ?warehouseId=<uuid>
 *
 * These filters come in as optional query parameters. In Prisma, we build
 * the `where` clause dynamically — only include a filter if it was provided.
 * This is the "dynamic where" pattern.
 *
 * WHY THREE DB INDEXES ON ORDER:
 *   @@index([status])      — dispatchers filter by status constantly ("show me PENDING orders")
 *   @@index([warehouseId]) — each warehouse only sees its own orders
 *   @@index([priority])    — optimizer sorts/filters by priority
 * Without these indexes, every filter = full table scan = slow as data grows.
 */

import { prisma } from "../../prisma/client";
import { OrderStatus } from "@prisma/client";
import type { CreateOrderInput, UpdateOrderInput } from "./order.schemas";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OrderRecord = {
  id: string;
  customerName: string;
  address: string;
  latitude: number;
  longitude: number;
  priority: string;
  earliestDelivery: Date | null;
  latestDelivery: Date | null;
  weightKg: number;
  status: string;
  timeWindowStatus: string;
  warehouseId: string;
  createdAt: Date;
  updatedAt: Date;
};

// Shared select — same fields returned from every query
const orderSelect = {
  id: true,
  customerName: true,
  address: true,
  latitude: true,
  longitude: true,
  priority: true,
  earliestDelivery: true,
  latestDelivery: true,
  weightKg: true,
  status: true,
  timeWindowStatus: true,
  warehouseId: true,
  createdAt: true,
  updatedAt: true,
};

// ─── Filter type for GET /orders ───────────────────────────────────────────────

export type OrderFilters = {
  status?: OrderStatus;
  priority?: "HIGH" | "MEDIUM" | "LOW";
  warehouseId?: string;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

export const createOrder = async (
  data: CreateOrderInput
): Promise<OrderRecord> => {
  return prisma.order.create({ data, select: orderSelect });
};

/**
 * Find all active orders with optional filters.
 *
 * DYNAMIC WHERE PATTERN:
 * We spread the filters object into the where clause.
 * If status is undefined, Prisma ignores it — no filter applied.
 * If status is "PENDING", Prisma adds WHERE status = 'PENDING'.
 *
 * This is cleaner than: if (status) where.status = status
 */
export const findAllOrders = async (
  filters: OrderFilters = {}
): Promise<OrderRecord[]> => {
  return prisma.order.findMany({
    where: {
      deletedAt: null,
      // Spread only defined filters — undefined keys are ignored by Prisma
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
    },
    select: orderSelect,
    orderBy: [
      // Primary sort: priority (HIGH first)
      // Prisma doesn't support enum-aware sorting natively,
      // so we sort by createdAt as secondary to keep it stable
      { createdAt: "desc" },
    ],
  });
};

export const findOrderById = async (
  id: string
): Promise<OrderRecord | null> => {
  return prisma.order.findFirst({
    where: { id, deletedAt: null },
    select: orderSelect,
  });
};

export const updateOrder = async (
  id: string,
  data: UpdateOrderInput
): Promise<OrderRecord> => {
  return prisma.order.update({ where: { id }, data, select: orderSelect });
};

/**
 * Update just the status of an order.
 * Used by the service for cancel and status-transition operations.
 * Separate from updateOrder so the status field isn't part of the public
 * update API (dispatchers shouldn't manually set status to DELIVERED).
 */
export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<OrderRecord> => {
  return prisma.order.update({
    where: { id },
    data: { status },
    select: orderSelect,
  });
};

export const softDeleteOrder = async (id: string): Promise<void> => {
  await prisma.order.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

/**
 * Count PENDING orders for a warehouse.
 * Used by the route optimizer (Feature 4) to decide whether optimization
 * is worth triggering — no point running the algorithm with 0 orders.
 */
export const countPendingOrdersByWarehouse = async (
  warehouseId: string
): Promise<number> => {
  return prisma.order.count({
    where: {
      warehouseId,
      status: "PENDING",
      deletedAt: null,
    },
  });
};
