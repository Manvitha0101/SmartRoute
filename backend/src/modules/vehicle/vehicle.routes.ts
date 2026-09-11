import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { createVehicleSchema, updateVehicleSchema } from "./vehicle.schemas";
import * as vehicleController from "./vehicle.controller";

const router = Router();

router
  .route("/")
  .get(authenticate, vehicleController.getAllVehicles)
  .post(authenticate, validateBody(createVehicleSchema), vehicleController.createVehicle);

router
  .route("/:id")
  .get(authenticate, vehicleController.getVehicleById)
  .patch(authenticate, validateBody(updateVehicleSchema), vehicleController.updateVehicle)
  .delete(authenticate, vehicleController.deleteVehicle);

export default router;
