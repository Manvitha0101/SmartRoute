import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as analyticsService from "./analytics.service";

/**
 * GET /api/v1/analytics/summary
 * Returns aggregated system metrics for the dispatcher dashboard.
 */
export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await analyticsService.getSummary();
  res.status(200).json(successResponse(summary));
});
