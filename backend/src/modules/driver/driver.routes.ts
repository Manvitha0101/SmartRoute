import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate";
import { createDriverSchema, updateDriverSchema } from "./driver.schemas";
import * as driverController from "./driver.controller";

const router = Router();
const staff = authorize("ADMIN", "DISPATCHER");
const staffOrDriver = authorize("ADMIN", "DISPATCHER", "DRIVER");
const adminOnly = authorize("ADMIN");

// Logged-in driver's own profile — must be before /:id
router.get("/me", authenticate, staffOrDriver, driverController.getMyDriverProfile);

router
  .route("/")
  .get(authenticate, staff, driverController.getAllDrivers)
  .post(authenticate, staff, validateBody(createDriverSchema), driverController.createDriver);

router
  .route("/:id")
  .get(authenticate, staff, driverController.getDriverById)
  .patch(authenticate, staff, validateBody(updateDriverSchema), driverController.updateDriver)
  .delete(authenticate, adminOnly, driverController.deleteDriver);

export default router;
