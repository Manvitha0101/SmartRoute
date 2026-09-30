/**
 * route.routes.ts — Route definitions for the route module.
 */

import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate";
import { optimizeRouteSchema, updateStopStatusSchema } from "./route.schemas";
import * as routeController from "./route.controller";

const router = Router();
const staff = authorize("ADMIN", "DISPATCHER");
const staffOrDriver = authorize("ADMIN", "DISPATCHER", "DRIVER");

router.get("/", authenticate, staffOrDriver, routeController.getAllRoutes);
router.post(
  "/optimize",
  authenticate,
  staff,
  validateBody(optimizeRouteSchema),
  routeController.optimizeRoutes
);

router.patch(
  "/:id/stops/:stopId",
  authenticate,
  staffOrDriver,
  validateBody(updateStopStatusSchema),
  routeController.updateStopStatus
);

router.patch("/:id/start", authenticate, staffOrDriver, routeController.startRoute);
router.patch("/:id/complete", authenticate, staffOrDriver, routeController.completeRoute);
router.patch("/:id/cancel", authenticate, staff, routeController.cancelRoute);

router.get("/:id", authenticate, staffOrDriver, routeController.getRouteById);

export default router;
