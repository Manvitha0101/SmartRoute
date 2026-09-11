/**
 * warehouse.repository.ts — ALL database operations for the warehouse module.
 *
 * RULE: This is the only file in the warehouse module that imports Prisma.
 * The service layer calls these functions and gets back plain objects.
 * If we ever switch from Prisma to Drizzle or raw SQL — only this file changes.
 *
 * SOFT DELETE PATTERN:
 * We never physically delete warehouses. A warehouse that dispatched 500 orders
 * historically must stay in the DB or those orders lose their warehouseId reference.
 * Instead, we set deletedAt to the current timestamp.
 * Every query filters `deletedAt: null` — deleted records are invisible to the API.
 */

import { prisma } from "../../prisma/client";
import type { CreateWarehouseInput, UpdateWarehouseInput } from "./warehouse.schemas";

// ─── Return type ───────────────────────────────────────────────────────────────
// The shape every warehouse function returns — a clean object without Prisma metadata

export type WarehouseRecord = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Create a new warehouse.
 * Returns the created record (excluding deletedAt — clients never need to see it).
 */
export const createWarehouse = async (
  data: CreateWarehouseInput
): Promise<WarehouseRecord> => {
  return prisma.warehouse.create({
    data,
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
      // deletedAt intentionally excluded — clients don't need tombstone timestamps
    },
  });
};

/**
 * Get all active (non-deleted) warehouses.
 * Ordered by creation date descending — newest first in the dispatcher UI.
 */
export const findAllWarehouses = async (): Promise<WarehouseRecord[]> => {
  return prisma.warehouse.findMany({
    where: { deletedAt: null }, // Soft delete filter
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Find a single warehouse by ID.
 * Returns null if not found OR if soft-deleted — treated the same way (404).
 */
export const findWarehouseById = async (
  id: string
): Promise<WarehouseRecord | null> => {
  return prisma.warehouse.findFirst({
    where: {
      id,
      deletedAt: null, // Soft-deleted warehouses are "not found"
    },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * Partial update — only updates the fields that are provided.
 * Prisma's `update` with a partial `data` object naturally handles this —
 * fields not included in `data` are not touched in the DB.
 */
export const updateWarehouse = async (
  id: string,
  data: UpdateWarehouseInput
): Promise<WarehouseRecord> => {
  return prisma.warehouse.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

/**
 * Soft delete — sets deletedAt to now().
 * The record stays in the DB; all queries filter it out via `deletedAt: null`.
 *
 * WHY NOT HARD DELETE:
 * Orders reference warehouseId. If we hard-delete a warehouse, those orders
 * become orphaned (foreign key violation) or lose their context. Soft delete
 * preserves the referential integrity and the audit trail.
 */
export const softDeleteWarehouse = async (id: string): Promise<void> => {
  await prisma.warehouse.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};

/**
 * Check if a warehouse name already exists (case-insensitive).
 * Used by the service to prevent duplicate warehouse names.
 *
 * WHY NOT RELY ON A DB UNIQUE CONSTRAINT FOR NAME:
 * Warehouse names aren't globally unique by business rule — two cities could
 * theoretically have a "Main Warehouse". We check for duplicates in the service
 * layer as a soft business rule, not a hard DB constraint.
 */
export const findWarehouseByName = async (
  name: string,
  excludeId?: string // Used during updates — don't flag the warehouse as its own duplicate
): Promise<WarehouseRecord | null> => {
  return prisma.warehouse.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" }, // Case-insensitive match
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }), // Exclude self during updates
    },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};
