import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate";
import { createVehicleSchema, updateVehicleSchema } from "./vehicle.schemas";
import * as vehicleController from "./vehicle.controller";

const router = Router();
const staff = authorize("ADMIN", "DISPATCHER");
const adminOnly = authorize("ADMIN");

router
  .route("/")
  .get(authenticate, staff, vehicleController.getAllVehicles)
  .post(authenticate, staff, validateBody(createVehicleSchema), vehicleController.createVehicle);

router
  .route("/:id")
  .get(authenticate, staff, vehicleController.getVehicleById)
  .patch(authenticate, staff, validateBody(updateVehicleSchema), vehicleController.updateVehicle)
  .delete(authenticate, adminOnly, vehicleController.deleteVehicle);

export default router;
