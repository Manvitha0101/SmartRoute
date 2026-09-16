import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import * as analyticsController from "./analytics.controller";

const router = Router();

// GET /api/v1/analytics/summary
router.get("/summary", authenticate, analyticsController.getSummary);

export default router;
