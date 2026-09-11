/**
 * warehouse.controller.ts — HTTP request/response handling for warehouses.
 *
 * CONTROLLER RULE: No business logic here. The controller's only jobs are:
 *   1. Extract what it needs from req (params, body, user)
 *   2. Call the service
 *   3. Send the response with the right status code
 *
 * WHY asyncHandler WRAPS EVERY FUNCTION:
 * Express doesn't catch async errors by default. Without asyncHandler, an
 * unhandled promise rejection in an async controller hangs the request forever.
 * asyncHandler wraps the function in .catch(next) — any thrown AppError
 * automatically reaches the global errorHandler middleware.
 *
 * HTTP STATUS CODES USED HERE:
 *   201 Created  — resource successfully created (POST)
 *   200 OK       — successful read or update (GET, PATCH)
 *   204 No Content — successful delete (DELETE, no body returned)
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as warehouseService from "./warehouse.service";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "./warehouse.schemas";

/**
 * POST /api/v1/warehouses
 * Create a new warehouse.
 */
export const createWarehouse = asyncHandler(
  async (req: Request, res: Response) => {
    // req.body is already validated and typed by the validateBody middleware
    const data = req.body as CreateWarehouseInput;
    const warehouse = await warehouseService.createWarehouse(data);
    res.status(201).json(successResponse(warehouse));
  }
);

/**
 * GET /api/v1/warehouses
 * List all active warehouses.
 */
export const getAllWarehouses = asyncHandler(
  async (_req: Request, res: Response) => {
    const warehouses = await warehouseService.getAllWarehouses();
    res.status(200).json(successResponse(warehouses));
  }
);

/**
 * GET /api/v1/warehouses/:id
 * Get a single warehouse. Returns 404 if not found (thrown by service).
 */
export const getWarehouseById = asyncHandler(
  async (req: Request, res: Response) => {
    const warehouse = await warehouseService.getWarehouseById(req.params.id);
    res.status(200).json(successResponse(warehouse));
  }
);

/**
 * PATCH /api/v1/warehouses/:id
 * Partial update — only provided fields are changed.
 */
export const updateWarehouse = asyncHandler(
  async (req: Request, res: Response) => {
    const data = req.body as UpdateWarehouseInput;
    const warehouse = await warehouseService.updateWarehouse(req.params.id, data);
    res.status(200).json(successResponse(warehouse));
  }
);

/**
 * DELETE /api/v1/warehouses/:id
 * Soft-delete a warehouse. Returns 204 — no body on delete responses.
 *
 * WHY 204 AND NOT 200:
 * 200 implies a response body. 204 (No Content) explicitly signals
 * "success, nothing to return." Clients should handle both, but 204
 * is the correct semantic for delete operations.
 */
export const deleteWarehouse = asyncHandler(
  async (req: Request, res: Response) => {
    await warehouseService.deleteWarehouse(req.params.id);
    res.status(204).send(); // No body on delete
  }
);
