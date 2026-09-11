import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as vehicleService from "./vehicle.service";
import type { CreateVehicleInput, UpdateVehicleInput } from "./vehicle.schemas";

export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await vehicleService.createVehicle(req.body as CreateVehicleInput);
  res.status(201).json(successResponse(vehicle));
});

export const getAllVehicles = asyncHandler(async (_req: Request, res: Response) => {
  const vehicles = await vehicleService.getAllVehicles();
  res.status(200).json(successResponse(vehicles));
});

export const getVehicleById = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await vehicleService.getVehicleById(req.params.id);
  res.status(200).json(successResponse(vehicle));
});

export const updateVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await vehicleService.updateVehicle(
    req.params.id,
    req.body as UpdateVehicleInput
  );
  res.status(200).json(successResponse(vehicle));
});

export const deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
  await vehicleService.deleteVehicle(req.params.id);
  res.status(204).send();
});
