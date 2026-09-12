/**
 * order.controller.ts — HTTP layer for order endpoints.
 *
 * NEW CONCEPT: QUERY PARAMETERS
 *
 * GET /api/v1/orders?status=PENDING&priority=HIGH&warehouseId=<uuid>
 *
 * Query params come from req.query (not req.body or req.params).
 * They're always strings from Express — even numbers come in as "30".
 * We cast and validate them before passing to the service.
 *
 * WHY NOT VALIDATE QUERY PARAMS WITH ZOD HERE:
 * For simplicity, we do lightweight manual validation in the controller.
 * In a larger production API, you'd use a separate query schema and a
 * validateQuery middleware (same factory pattern as validateBody).
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as orderService from "./order.service";
import { OrderStatus } from "@prisma/client";
import type { CreateOrderInput, UpdateOrderInput } from "./order.schemas";
import type { OrderFilters } from "./order.repository";

/**
 * POST /api/v1/orders
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.body as CreateOrderInput);
  res.status(201).json(successResponse(order));
});

/**
 * GET /api/v1/orders
 * Supports query params: ?status=PENDING&priority=HIGH&warehouseId=<uuid>
 */
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  // Extract and validate query params
  const { status, priority, warehouseId } = req.query;

  const filters: OrderFilters = {};

  // Validate status if provided — must be a valid OrderStatus enum value
  if (status) {
    const validStatuses = ["PENDING", "ASSIGNED", "DELIVERED", "FAILED", "CANCELLED"];
    if (!validStatuses.includes(status as string)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILTER",
          message: `Invalid status filter. Must be one of: ${validStatuses.join(", ")}`,
        },
      });
      return;
    }
    filters.status = status as OrderStatus;
  }

  // Validate priority if provided
  if (priority) {
    const validPriorities = ["HIGH", "MEDIUM", "LOW"];
    if (!validPriorities.includes(priority as string)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILTER",
          message: `Invalid priority filter. Must be one of: ${validPriorities.join(", ")}`,
        },
      });
      return;
    }
    filters.priority = priority as "HIGH" | "MEDIUM" | "LOW";
  }

  if (warehouseId) {
    filters.warehouseId = warehouseId as string;
  }

  const orders = await orderService.getAllOrders(filters);
  res.status(200).json(successResponse(orders));
});

/**
 * GET /api/v1/orders/:id
 */
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(req.params.id);
  res.status(200).json(successResponse(order));
});

/**
 * PATCH /api/v1/orders/:id
 * Update order details (only for PENDING orders).
 */
export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateOrder(
    req.params.id,
    req.body as UpdateOrderInput
  );
  res.status(200).json(successResponse(order));
});

/**
 * PATCH /api/v1/orders/:id/cancel
 * Cancel an order. Separate endpoint from PATCH /:id because:
 * - Cancellation is a STATE TRANSITION, not a data update
 * - No request body needed — just the intent to cancel
 * - Cleaner REST semantics: PATCH /orders/:id/cancel vs PATCH /orders/:id {status:"CANCELLED"}
 *
 * WHY NOT PUT/DELETE: PUT replaces the resource. DELETE removes it.
 * Cancellation is neither — it changes state while keeping the record intact.
 * PATCH /resource/action is a common REST pattern for state transitions.
 */
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.cancelOrder(req.params.id);
  res.status(200).json(successResponse(result));
});

/**
 * DELETE /api/v1/orders/:id
 * Soft delete (only PENDING or CANCELLED orders).
 */
export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  await orderService.deleteOrder(req.params.id);
  res.status(204).send();
});
