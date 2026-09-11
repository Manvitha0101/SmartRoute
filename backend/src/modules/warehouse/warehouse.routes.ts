/**
 * warehouse.routes.ts — Route definitions for the warehouse module.
 *
 * MIDDLEWARE CHAIN (read left to right):
 *   authenticate  → verifies the JWT, injects req.user
 *   validateBody  → validates req.body against Zod schema, rejects bad input
 *   controller    → calls service, returns response
 *
 * WHY ALL ROUTES REQUIRE AUTHENTICATION:
 * Warehouse data is operational — it contains hub locations, addresses.
 * Anonymous access has no legitimate use case. Every endpoint requires a
 * valid JWT. Role-based restriction (ADMIN only) is omitted for now — both
 * ADMINs and DISPATCHERs need to view and manage warehouses in the dispatcher UI.
 * If that changes, we add `authorize(["ADMIN"])` between authenticate and validateBody.
 *
 * WHY router.route() CHAINING:
 * Instead of writing `router.get(...)` and `router.post(...)` separately,
 * `.route('/path').get(...).post(...)` groups operations on the same path
 * together — visually clear, one place to see all verbs for a URL.
 */

import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouse.schemas";
import * as warehouseController from "./warehouse.controller";

const router = Router();

// /api/v1/warehouses
router
  .route("/")
  .get(authenticate, warehouseController.getAllWarehouses)
  .post(
    authenticate,
    validateBody(createWarehouseSchema),
    warehouseController.createWarehouse
  );

// /api/v1/warehouses/:id
router
  .route("/:id")
  .get(authenticate, warehouseController.getWarehouseById)
  .patch(
    authenticate,
    validateBody(updateWarehouseSchema),
    warehouseController.updateWarehouse
  )
  .delete(authenticate, warehouseController.deleteWarehouse);

export default router;
