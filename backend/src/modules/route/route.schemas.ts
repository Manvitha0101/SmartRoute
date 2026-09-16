/**
 * route.schemas.ts — Zod validation schemas for route endpoints.
 */

import { z } from "zod";

export const optimizeRouteSchema = z
  .object({
    warehouseId: z.string().uuid("warehouseId must be a valid UUID"),
    vehicleIds: z
      .array(z.string().uuid("Each vehicleId must be a valid UUID"))
      .min(1, "At least one vehicle is required"),
    driverIds: z
      .array(z.string().uuid("Each driverId must be a valid UUID"))
      .min(1, "At least one driver is required"),
  })
  .refine((data) => data.vehicleIds.length === data.driverIds.length, {
    message: "Each vehicle must have exactly one driver (vehicleIds and driverIds must have the same length)",
    path: ["driverIds"],
  });

export const updateStopStatusSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "SKIPPED"]),
  actualArrival: z.string().optional(),
});

export type OptimizeRouteInput = z.infer<typeof optimizeRouteSchema>;
export type UpdateStopStatusInput = z.infer<typeof updateStopStatusSchema>;
