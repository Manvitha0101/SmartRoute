/**
 * order.routes.ts — Route definitions for the order module.
 *
 * ROUTE DESIGN NOTE — /cancel sub-action:
 *
 * PATCH /:id/cancel is registered BEFORE /:id
 * This matters because Express matches routes top-to-bottom.
 * If /:id is registered first, "cancel" would be treated as the :id value
 * and hit the update handler instead of the cancel handler.
 *
 * Order of route registration:
 *   1. /         → collection operations (GET all, POST create)
 *   2. /:id/cancel → specific sub-action (must be before /:id)
 *   3. /:id        → single resource operations (GET, PATCH, DELETE)
 */

import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { createOrderSchema, updateOrderSchema } from "./order.schemas";
import * as orderController from "./order.controller";

const router = Router();

// Collection: GET all orders (with optional filters), POST create
router
  .route("/")
  .get(authenticate, orderController.getAllOrders)
  .post(
    authenticate,
    validateBody(createOrderSchema),
    orderController.createOrder
  );

// Sub-action: cancel a specific order
// MUST be registered BEFORE /:id — see comment above
router.patch("/:id/cancel", authenticate, orderController.cancelOrder);

// Single resource: GET, PATCH update, DELETE
router
  .route("/:id")
  .get(authenticate, orderController.getOrderById)
  .patch(
    authenticate,
    validateBody(updateOrderSchema),
    orderController.updateOrder
  )
  .delete(authenticate, orderController.deleteOrder);

export default router;
