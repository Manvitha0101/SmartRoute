import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as routeService from "./route.service";
import type { OptimizeRouteInput, UpdateStopStatusInput } from "./route.schemas";

export const optimizeRoutes = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await routeService.optimize(req.body as OptimizeRouteInput);
    res.status(201).json(successResponse(result));
  }
);

export const getAllRoutes = asyncHandler(
  async (_req: Request, res: Response) => {
    const routes = await routeService.getAllRoutes();
    res.status(200).json(successResponse(routes));
  }
);

export const getRouteById = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await routeService.getRouteById(req.params.id);
    res.status(200).json(successResponse(route));
  }
);

export const startRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await routeService.startRoute(req.params.id);
    res.status(200).json(successResponse(route));
  }
);

export const completeRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const route = await routeService.completeRoute(req.params.id);
    res.status(200).json(successResponse(route));
  }
);

export const cancelRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await routeService.cancelRoute(req.params.id);
    res.status(200).json(successResponse(result));
  }
);

export const updateStopStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id, stopId } = req.params;
    const result = await routeService.updateStopStatus(id, stopId, req.body as UpdateStopStatusInput);
    res.status(200).json(successResponse(result));
  }
);
