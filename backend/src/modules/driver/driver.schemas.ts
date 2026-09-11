/**
 * driver.schemas.ts — Zod validation schemas for driver endpoints.
 *
 * The `vehicleId` field is optional (a driver can be registered without
 * a vehicle assignment). But if provided, it must be a valid UUID —
 * we don't check if it exists in the DB here (that's the service's job),
 * but we do check the format so a garbage string can't reach the DB.
 */

import { z } from "zod";

export const createDriverSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),

  phone: z
    .string()
    .regex(
      /^\+?[0-9\s\-()]{7,15}$/,
      "Phone number must be 7-15 digits (optionally with +, spaces, dashes)"
    ),

  licenseNumber: z
    .string()
    .min(5, "License number must be at least 5 characters")
    .max(30, "License number too long")
    .toUpperCase(), // Normalize to uppercase

  // Optional: only provided when assigning to a vehicle at registration time
  vehicleId: z.string().uuid("vehicleId must be a valid UUID").optional(),
});

export const updateDriverSchema = createDriverSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
