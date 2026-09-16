/**
 * route.routes.ts — Route definitions for the route module.
 */

import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { optimizeRouteSchema, updateStopStatusSchema } from "./route.schemas";
import * as routeController from "./route.controller";

const router = Router();

// Collection + optimize action
router.get("/", authenticate, routeController.getAllRoutes);
router.post(
  "/optimize",
  authenticate,
  validateBody(optimizeRouteSchema),
  routeController.optimizeRoutes
);

// Stop actions — before /:id
router.patch(
  "/:id/stops/:stopId",
  authenticate,
  validateBody(updateStopStatusSchema),
  routeController.updateStopStatus
);

// Sub-actions — MUST be before /:id
router.patch("/:id/start",    authenticate, routeController.startRoute);
router.patch("/:id/complete", authenticate, routeController.completeRoute);
router.patch("/:id/cancel",   authenticate, routeController.cancelRoute);

// Single resource
router.get("/:id", authenticate, routeController.getRouteById);

export default router;
