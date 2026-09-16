import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as routeService from "./route.service";
import type { OptimizeRouteInput } from "./route.schemas";

/**
 * POST /api/v1/routes/optimize
 * Runs the optimization algorithm and creates routes.
 * This is the flagship endpoint — the most complex operation in the system.
 */
export const optimizeRoutes = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await routeService.optimize(req.body as OptimizeRouteInput);
    res.status(201).json(successResponse(result));
  }
);

/**
 * GET /api/v1/routes
 */
export const getAllRoutes = asyncHandler(
  async (_req: Request, res: Response) => {
    const routes = await routeService.getAllRoutes();
    res.status(200).json(successResponse(routes));
  }
);

/**
 * GET /api/v1/routes/:id
 * Returns the route WITH its stops (full detail view for dispatcher).
 */
export const getRouteById = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await routeService.getRouteById(req.params.id);
    res.status(200).json(successResponse(route));
  }
);

/**
 * PATCH /api/v1/routes/:id/start
 * PLANNED → IN_PROGRESS. Records actual departure time.
 */
export const startRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await routeService.startRoute(req.params.id);
    res.status(200).json(successResponse(route));
  }
);

/**
 * PATCH /api/v1/routes/:id/complete
 * IN_PROGRESS → COMPLETED. Records completion time.
 */
export const completeRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await routeService.completeRoute(req.params.id);
    res.status(200).json(successResponse(route));
  }
);

/**
 * PATCH /api/v1/routes/:id/cancel
 * PLANNED → CANCELLED. Reverts assigned orders to PENDING.
 */
export const cancelRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await routeService.cancelRoute(req.params.id);
    res.status(200).json(successResponse(result));
  }
);
