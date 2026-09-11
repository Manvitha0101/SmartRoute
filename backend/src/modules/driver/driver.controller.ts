import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as driverService from "./driver.service";
import type { CreateDriverInput, UpdateDriverInput } from "./driver.schemas";

export const createDriver = asyncHandler(async (req: Request, res: Response) => {
  const driver = await driverService.createDriver(req.body as CreateDriverInput);
  res.status(201).json(successResponse(driver));
});

export const getAllDrivers = asyncHandler(async (_req: Request, res: Response) => {
  const drivers = await driverService.getAllDrivers();
  res.status(200).json(successResponse(drivers));
});

export const getDriverById = asyncHandler(async (req: Request, res: Response) => {
  const driver = await driverService.getDriverById(req.params.id);
  res.status(200).json(successResponse(driver));
});

export const updateDriver = asyncHandler(async (req: Request, res: Response) => {
  const driver = await driverService.updateDriver(req.params.id, req.body as UpdateDriverInput);
  res.status(200).json(successResponse(driver));
});

export const deleteDriver = asyncHandler(async (req: Request, res: Response) => {
  await driverService.deleteDriver(req.params.id);
  res.status(204).send();
});
