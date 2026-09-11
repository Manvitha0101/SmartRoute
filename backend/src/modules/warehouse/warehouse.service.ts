/**
 * warehouse.service.ts — Business logic for the warehouse module.
 *
 * THIS LAYER OWNS ALL BUSINESS RULES:
 * - No two active warehouses can share the same name
 * - A warehouse with active (non-delivered) orders cannot be deleted
 * - Finding a non-existent warehouse throws a 404, not a null
 *
 * WHY NOT IN THE CONTROLLER:
 * Controllers handle HTTP — they read req, call service, write res.
 * If business rules live in controllers, you can't reuse them (e.g. another
 * service calling warehouse logic internally would need to duplicate the checks).
 * Services are HTTP-agnostic — they throw AppErrors, not res.status(404).
 *
 * WHY NOT IN THE REPOSITORY:
 * Repositories are dumb data access — they don't know about business rules.
 * "Can't delete a warehouse with active orders" requires checking the Order table.
 * That's a cross-model business rule → it belongs in the service.
 */

import { AppError } from "../../utils/AppError";
import * as warehouseRepo from "./warehouse.repository";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "./warehouse.schemas";

// ─── Service functions ─────────────────────────────────────────────────────────

/**
 * Create a warehouse.
 *
 * Business rule: warehouse names must be unique (case-insensitive).
 * If a warehouse named "Mumbai Hub" already exists, creating "mumbai hub" is rejected.
 */
export const createWarehouse = async (data: CreateWarehouseInput) => {
  // Rule 1: No duplicate names
  const existing = await warehouseRepo.findWarehouseByName(data.name);
  if (existing) {
    throw AppError.conflict(
      `A warehouse named "${data.name}" already exists`,
      "WAREHOUSE_NAME_TAKEN"
    );
  }

  return warehouseRepo.createWarehouse(data);
};

/**
 * Get all active warehouses.
 * No business rules here — just pass through to the repository.
 * (A service function that's just a pass-through is still correct —
 * it keeps the layer boundary intact if rules are added later.)
 */
export const getAllWarehouses = async () => {
  return warehouseRepo.findAllWarehouses();
};

/**
 * Get a single warehouse by ID.
 * Throws 404 if not found — the controller doesn't have to handle null.
 */
export const getWarehouseById = async (id: string) => {
  const warehouse = await warehouseRepo.findWarehouseById(id);
  if (!warehouse) {
    throw AppError.notFound("Warehouse not found", "WAREHOUSE_NOT_FOUND");
  }
  return warehouse;
};

/**
 * Update a warehouse (partial PATCH).
 *
 * Business rule: if the name is being changed, the new name must not
 * already belong to another warehouse.
 *
 * The `excludeId` parameter prevents the warehouse from being flagged
 * as a duplicate of itself during a no-change update.
 */
export const updateWarehouse = async (
  id: string,
  data: UpdateWarehouseInput
) => {
  // Confirm the warehouse exists first (throws 404 if not)
  await getWarehouseById(id);

  // Rule: if name is being changed, check it's not already taken
  if (data.name) {
    const duplicate = await warehouseRepo.findWarehouseByName(data.name, id);
    if (duplicate) {
      throw AppError.conflict(
        `A warehouse named "${data.name}" already exists`,
        "WAREHOUSE_NAME_TAKEN"
      );
    }
  }

  return warehouseRepo.updateWarehouse(id, data);
};

/**
 * Soft-delete a warehouse.
 *
 * Business rule: cannot delete a warehouse that has PENDING or ASSIGNED orders.
 * Deleting such a warehouse would leave active orders without a valid origin hub —
 * the optimizer would have no departure point for those orders.
 *
 * DELIVERED, FAILED, CANCELLED orders are fine — they're historical, not active.
 */
export const deleteWarehouse = async (id: string) => {
  // Confirm the warehouse exists (throws 404 if not)
  const warehouse = await getWarehouseById(id);

  // Check for active orders that would be stranded
  // We import prisma here only to do the cross-model check that the repository
  // can't cleanly own. In a larger codebase, this would go through an OrderRepository.
  const { prisma } = await import("../../prisma/client");

  const activeOrderCount = await prisma.order.count({
    where: {
      warehouseId: id,
      status: { in: ["PENDING", "ASSIGNED"] },
      deletedAt: null,
    },
  });

  if (activeOrderCount > 0) {
    throw AppError.badRequest(
      `Cannot delete warehouse "${warehouse.name}" — it has ${activeOrderCount} active order(s). Reassign or cancel them first.`,
      "WAREHOUSE_HAS_ACTIVE_ORDERS"
    );
  }

  await warehouseRepo.softDeleteWarehouse(id);
};
