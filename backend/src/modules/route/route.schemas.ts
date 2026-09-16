/**
 * route.schemas.ts — Zod validation schemas for route endpoints.
 *
 * OPTIMIZE REQUEST:
 * The dispatcher picks:
 *   - which warehouse to dispatch from
 *   - which vehicles are available today
 *   - which drivers are assigned to those vehicles
 *
 * vehicleIds and driverIds must have matching lengths — each vehicle
 * needs exactly one driver. We enforce this with .refine().
 *
 * WHY NOT AUTO-ASSIGN DRIVERS:
 * In our DB, a driver has an optional vehicleId — but one driver could
 * be temporarily assigned to a different vehicle. The dispatcher knows
 * the current actual assignments. We trust their input rather than
 * reading from the DB and potentially using stale assignments.
 */

import { z } from "zod";

export const optimizeRouteSchema = z
  .object({
    warehouseId: z.string().uuid("warehouseId must be a valid UUID"),

    // At least one vehicle required — can't optimize with no vehicles
    vehicleIds: z
      .array(z.string().uuid("Each vehicleId must be a valid UUID"))
      .min(1, "At least one vehicle is required"),

    // One driver per vehicle
    driverIds: z
      .array(z.string().uuid("Each driverId must be a valid UUID"))
      .min(1, "At least one driver is required"),
  })
  // Cross-field: vehicleIds.length must equal driverIds.length
  .refine((data) => data.vehicleIds.length === data.driverIds.length, {
    message: "Each vehicle must have exactly one driver (vehicleIds and driverIds must have the same length)",
    path: ["driverIds"],
  });

export type OptimizeRouteInput = z.infer<typeof optimizeRouteSchema>;
