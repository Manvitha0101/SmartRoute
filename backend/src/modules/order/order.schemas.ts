/**
 * order.schemas.ts — Zod validation schemas for order endpoints.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. CROSS-FIELD VALIDATION with .refine():
 *    latestDelivery must come AFTER earliestDelivery.
 *    This can't be expressed on a single field — it requires both fields.
 *    .refine() lets you write a function that sees the whole object.
 *
 * 2. OPTIONAL TIME WINDOWS:
 *    Not every order has a strict delivery window. A bulk warehouse delivery
 *    might say "anytime today". So earliestDelivery and latestDelivery are
 *    optional. But if you provide latestDelivery, earliestDelivery is implied
 *    to be "now" (the optimizer handles this).
 *
 * 3. weightKg DEFAULT:
 *    Optional in the schema — defaults to 0 in Prisma schema.
 *    Some orders (documents, small parcels) are weight-negligible.
 *    The optimizer still needs to check total route weight vs vehicle capacity.
 */

import { z } from "zod";

export const createOrderSchema = z
  .object({
    customerName: z
      .string()
      .min(2, "Customer name must be at least 2 characters")
      .max(150),

    address: z
      .string()
      .min(5, "Delivery address must be at least 5 characters")
      .max(400),

    // GPS coordinates for the delivery location
    // The optimizer uses these — not the address string — for distance calculations
    latitude: z
      .number({ invalid_type_error: "Latitude must be a number" })
      .min(-90, "Latitude must be >= -90")
      .max(90, "Latitude must be <= 90"),

    longitude: z
      .number({ invalid_type_error: "Longitude must be a number" })
      .min(-180, "Longitude must be >= -180")
      .max(180, "Longitude must be <= 180"),

    priority: z
      .enum(["HIGH", "MEDIUM", "LOW"], {
        errorMap: () => ({ message: "Priority must be HIGH, MEDIUM, or LOW" }),
      })
      .default("MEDIUM"),

    // Time window: deliver no earlier than this
    earliestDelivery: z.coerce
      .date({
        invalid_type_error: "earliestDelivery must be a valid ISO date string",
      })
      .optional(),

    // Time window: deliver no later than this (SLA deadline)
    latestDelivery: z.coerce
      .date({
        invalid_type_error: "latestDelivery must be a valid ISO date string",
      })
      .optional(),

    // Weight of the package — optimizer checks against vehicle capacity
    weightKg: z
      .number({ invalid_type_error: "weightKg must be a number" })
      .min(0, "Weight cannot be negative")
      .max(30000, "Weight exceeds maximum (30,000 kg)")
      .default(0),

    // Which warehouse dispatches this order
    warehouseId: z.string().uuid("warehouseId must be a valid UUID"),
  })
  // Cross-field validation: latestDelivery must be after earliestDelivery
  // .refine() runs AFTER individual field validations pass
  .refine(
    (data) => {
      if (data.earliestDelivery && data.latestDelivery) {
        return data.latestDelivery > data.earliestDelivery;
      }
      return true; // If either is missing, no conflict possible
    },
    {
      message: "latestDelivery must be after earliestDelivery",
      path: ["latestDelivery"], // Which field the error appears on
    }
  )
  // Cross-field validation: latestDelivery should be in the future
  .refine(
    (data) => {
      if (data.latestDelivery) {
        return data.latestDelivery > new Date();
      }
      return true;
    },
    {
      message: "latestDelivery must be in the future",
      path: ["latestDelivery"],
    }
  );

// Update schema: all fields optional except warehouseId can't be changed
// (you can't reassign an order to a different warehouse — it would change the
// entire routing origin, breaking any existing route assignment)
export const updateOrderSchema = z
  .object({
    customerName: z.string().min(2).max(150).optional(),
    address: z.string().min(5).max(400).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    earliestDelivery: z.coerce.date().optional(),
    latestDelivery: z.coerce.date().optional(),
    weightKg: z.number().min(0).max(30000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })
  .refine(
    (data) => {
      if (data.earliestDelivery && data.latestDelivery) {
        return data.latestDelivery > data.earliestDelivery;
      }
      return true;
    },
    {
      message: "latestDelivery must be after earliestDelivery",
      path: ["latestDelivery"],
    }
  );

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
