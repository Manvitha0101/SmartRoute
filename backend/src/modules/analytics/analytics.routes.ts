import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as analyticsController from "./analytics.controller";

const router = Router();

router.get(
  "/summary",
  authenticate,
  authorize("ADMIN"),
  analyticsController.getSummary
);

router.get(
  "/dispatcher/live",
  authenticate,
  authorize("ADMIN", "DISPATCHER"),
  analyticsController.getDispatcherLive
);

export default router;
