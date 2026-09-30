import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate";
import { createOrderSchema, updateOrderSchema } from "./order.schemas";
import * as orderController from "./order.controller";

const router = Router();
const staff = authorize("ADMIN", "DISPATCHER");

router
  .route("/")
  .get(authenticate, staff, orderController.getAllOrders)
  .post(
    authenticate,
    staff,
    validateBody(createOrderSchema),
    orderController.createOrder
  );

router.patch("/:id/cancel", authenticate, staff, orderController.cancelOrder);

router
  .route("/:id")
  .get(authenticate, staff, orderController.getOrderById)
  .patch(
    authenticate,
    staff,
    validateBody(updateOrderSchema),
    orderController.updateOrder
  )
  .delete(authenticate, staff, orderController.deleteOrder);

export default router;
