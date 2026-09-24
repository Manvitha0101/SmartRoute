import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import * as analyticsController from "./analytics.controller";

const router = Router();

// GET /api/v1/analytics/summary  — Admin strategic overview
router.get("/summary", authenticate, analyticsController.getSummary);

// GET /api/v1/analytics/dispatcher/live — Dispatcher real-time operations
router.get("/dispatcher/live", authenticate, analyticsController.getDispatcherLive);

export default router;
