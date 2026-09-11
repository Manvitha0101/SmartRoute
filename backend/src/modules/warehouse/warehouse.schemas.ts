/**
 * warehouse.schemas.ts — Zod validation schemas for warehouse endpoints.
 *
 * TWO SCHEMAS:
 *
 * createWarehouseSchema — all fields required on creation.
 * updateWarehouseSchema — all fields optional (partial update / PATCH semantics).
 *   The .refine() at the bottom ensures the client sends at least ONE field —
 *   an empty PATCH body is a client mistake, not a valid no-op.
 *
 * WHY SEPARATE CREATE AND UPDATE SCHEMAS:
 * PUT replaces the whole resource (all fields required).
 * PATCH updates specific fields (fields are optional).
 * We're using PATCH — so the update schema is a partial of the create schema.
 * z.object(...).partial() makes every field optional in one line.
 */

import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),

  address: z
    .string()
    .min(5, "Address must be at least 5 characters")
    .max(300, "Address too long"),

  // Latitude range: -90 to +90 (poles to poles)
  latitude: z
    .number({ invalid_type_error: "Latitude must be a number" })
    .min(-90, "Latitude must be >= -90")
    .max(90, "Latitude must be <= 90"),

  // Longitude range: -180 to +180 (west to east)
  longitude: z
    .number({ invalid_type_error: "Longitude must be a number" })
    .min(-180, "Longitude must be >= -180")
    .max(180, "Longitude must be <= 180"),
});

// .partial() makes every field Optional<T> — for PATCH requests
// .refine() adds a cross-field rule: body can't be completely empty
export const updateWarehouseSchema = createWarehouseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// TypeScript types inferred from Zod — no manual duplication
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
