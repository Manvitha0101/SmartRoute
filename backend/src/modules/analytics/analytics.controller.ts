import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as analyticsService from "./analytics.service";

/**
 * GET /api/v1/analytics/summary
 * Admin dashboard — aggregated system-wide metrics.
 */
export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await analyticsService.getSummary();
  res.status(200).json(successResponse(summary));
});

/**
 * GET /api/v1/analytics/dispatcher/live
 * Dispatcher dashboard — live operational data: active/planned routes, queue counts.
 */
export const getDispatcherLive = asyncHandler(async (_req: Request, res: Response) => {
  const live = await analyticsService.getDispatcherLive();
  res.status(200).json(successResponse(live));
});
