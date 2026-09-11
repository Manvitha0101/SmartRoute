import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { createDriverSchema, updateDriverSchema } from "./driver.schemas";
import * as driverController from "./driver.controller";

const router = Router();

router
  .route("/")
  .get(authenticate, driverController.getAllDrivers)
  .post(authenticate, validateBody(createDriverSchema), driverController.createDriver);

router
  .route("/:id")
  .get(authenticate, driverController.getDriverById)
  .patch(authenticate, validateBody(updateDriverSchema), driverController.updateDriver)
  .delete(authenticate, driverController.deleteDriver);

export default router;
