/**
 * vehicle.schemas.ts — Zod validation schemas for vehicle endpoints.
 *
 * VehicleType and FuelType must match the Prisma enums exactly.
 * z.enum([...]) enforces this at the HTTP boundary — invalid values
 * are rejected before they reach the DB layer.
 */

import { z } from "zod";

export const createVehicleSchema = z.object({
  plateNumber: z
    .string()
    .min(4, "Plate number must be at least 4 characters")
    .max(15, "Plate number too long")
    .toUpperCase(), // Normalize: "mh12ab1234" → "MH12AB1234"

  type: z.enum(["MOTORCYCLE", "CAR", "VAN", "TRUCK"], {
    errorMap: () => ({
      message: "Type must be one of: MOTORCYCLE, CAR, VAN, TRUCK",
    }),
  }),

  capacityKg: z
    .number({ invalid_type_error: "capacityKg must be a number" })
    .positive("Capacity must be greater than 0")
    .max(30000, "Capacity exceeds maximum (30,000 kg)"),

  fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "CNG"], {
    errorMap: () => ({
      message: "Fuel type must be one of: PETROL, DIESEL, ELECTRIC, CNG",
    }),
  }),
});

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
