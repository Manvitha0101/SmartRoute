import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouse.schemas";
import * as warehouseController from "./warehouse.controller";

const router = Router();
const staff = authorize("ADMIN", "DISPATCHER");
const adminOnly = authorize("ADMIN");

router
  .route("/")
  .get(authenticate, staff, warehouseController.getAllWarehouses)
  .post(
    authenticate,
    staff,
    validateBody(createWarehouseSchema),
    warehouseController.createWarehouse
  );

router
  .route("/:id")
  .get(authenticate, staff, warehouseController.getWarehouseById)
  .patch(
    authenticate,
    staff,
    validateBody(updateWarehouseSchema),
    warehouseController.updateWarehouse
  )
  .delete(authenticate, adminOnly, warehouseController.deleteWarehouse);

export default router;
