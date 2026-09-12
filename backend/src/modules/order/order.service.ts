/**
 * order.service.ts — Business logic for orders.
 *
 * BUSINESS RULES:
 *
 * 1. CREATE:
 *    - warehouseId must point to an existing, non-deleted warehouse
 *    - weightKg must not exceed the maximum single-vehicle capacity (30,000 kg)
 *      (can't create an order no vehicle in the fleet can carry)
 *
 * 2. UPDATE:
 *    - Only PENDING orders can be updated
 *    - ASSIGNED orders are locked — they're already part of a planned route.
 *      Changing the address or lat/lng mid-planning corrupts the route.
 *    - DELIVERED, FAILED, CANCELLED orders are terminal — never editable.
 *
 * 3. CANCEL:
 *    - PENDING and ASSIGNED orders can be cancelled
 *    - DELIVERED orders cannot be cancelled (delivery already happened)
 *    - If order is ASSIGNED (part of a route), the route system will need
 *      to handle the gap — flagged in the response but not auto-handled here
 *
 * 4. DELETE (soft):
 *    - Only PENDING or CANCELLED orders can be soft-deleted
 *    - ASSIGNED/DELIVERED orders must not be deleted — audit trail required
 *
 * ORDER STATUS LIFECYCLE:
 *   PENDING → ASSIGNED (when added to a route in Feature 4)
 *           → CANCELLED (dispatcher cancels it)
 *   ASSIGNED → DELIVERED (driver marks stop complete)
 *            → FAILED (driver marks stop failed)
 *            → CANCELLED (dispatcher cancels from route)
 */

import { AppError } from "../../utils/AppError";
import * as orderRepo from "./order.repository";
import type { CreateOrderInput, UpdateOrderInput } from "./order.schemas";
import type { OrderFilters } from "./order.repository";

// ─── Service functions ─────────────────────────────────────────────────────────

export const createOrder = async (data: CreateOrderInput) => {
  // Rule 1: Warehouse must exist and be active
  const { prisma } = await import("../../prisma/client");
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, deletedAt: null },
    select: { id: true, name: true },
  });

  if (!warehouse) {
    throw AppError.badRequest(
      `Warehouse with ID "${data.warehouseId}" does not exist`,
      "WAREHOUSE_NOT_FOUND"
    );
  }

  return orderRepo.createOrder(data);
};

export const getAllOrders = async (filters: OrderFilters) => {
  return orderRepo.findAllOrders(filters);
};

export const getOrderById = async (id: string) => {
  const order = await orderRepo.findOrderById(id);
  if (!order) {
    throw AppError.notFound("Order not found", "ORDER_NOT_FOUND");
  }
  return order;
};

/**
 * Update order details.
 *
 * RULE: Only PENDING orders are updatable.
 * Once an order is ASSIGNED to a route, the optimizer has already computed
 * distances and sequence based on the current lat/lng and address.
 * Changing them invalidates the computed route — the route would need
 * to be recomputed from scratch. We prevent this at the API level.
 */
export const updateOrder = async (id: string, data: UpdateOrderInput) => {
  const order = await getOrderById(id); // 404 guard

  if (order.status !== "PENDING") {
    throw AppError.badRequest(
      `Cannot update order — current status is "${order.status}". Only PENDING orders can be updated.`,
      "ORDER_NOT_EDITABLE"
    );
  }

  return orderRepo.updateOrder(id, data);
};

/**
 * Cancel an order.
 *
 * Separate from delete — cancellation is a STATUS CHANGE, not a data removal.
 * A cancelled order stays visible in the system for audit/reporting.
 * (A dispatcher needs to know "we had 50 orders today, 3 were cancelled".)
 *
 * RULE: Cannot cancel a DELIVERED order — the delivery already happened.
 */
export const cancelOrder = async (id: string) => {
  const order = await getOrderById(id);

  // Terminal states — can't be cancelled
  if (order.status === "DELIVERED") {
    throw AppError.badRequest(
      "Cannot cancel an order that has already been delivered",
      "ORDER_ALREADY_DELIVERED"
    );
  }

  if (order.status === "CANCELLED") {
    throw AppError.badRequest(
      "Order is already cancelled",
      "ORDER_ALREADY_CANCELLED"
    );
  }

  // If the order was ASSIGNED, it was part of a route.
  // We cancel the order but note that the route now has a gap.
  // Feature 4 (route management) will handle recalculating the route.
  const wasAssigned = order.status === "ASSIGNED";

  const updated = await orderRepo.updateOrderStatus(id, "CANCELLED");

  return {
    ...updated,
    // Flag for the frontend to show a warning:
    // "This order was part of a route — the route may need to be updated."
    routeAffected: wasAssigned,
  };
};

/**
 * Soft-delete an order.
 *
 * RULE: Only PENDING or CANCELLED orders can be deleted.
 * ASSIGNED/DELIVERED/FAILED orders are part of the operational record —
 * deleting them would corrupt route history and delivery analytics.
 */
export const deleteOrder = async (id: string) => {
  const order = await getOrderById(id);

  const deletableStatuses = ["PENDING", "CANCELLED"];
  if (!deletableStatuses.includes(order.status)) {
    throw AppError.badRequest(
      `Cannot delete order with status "${order.status}". Only PENDING or CANCELLED orders can be deleted.`,
      "ORDER_NOT_DELETABLE"
    );
  }

  await orderRepo.softDeleteOrder(id);
};
