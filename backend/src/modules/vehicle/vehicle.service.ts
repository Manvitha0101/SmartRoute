/**
 * vehicle.service.ts — Business logic for vehicles.
 *
 * BUSINESS RULES:
 * 1. Plate numbers must be unique (case-normalized to uppercase in schema)
 * 2. Cannot delete a vehicle that is currently assigned to an IN_PROGRESS route
 *    (the driver is actively using it — yanking it would corrupt live route data)
 * 3. Can delete a vehicle assigned to a PLANNED route — dispatcher needs to fix
 *    the route assignment, but we don't silently block it
 */

import { AppError } from "../../utils/AppError";
import * as vehicleRepo from "./vehicle.repository";
import type { CreateVehicleInput, UpdateVehicleInput } from "./vehicle.schemas";

export const createVehicle = async (data: CreateVehicleInput) => {
  // Rule: plate numbers are unique per vehicle
  const existing = await vehicleRepo.findVehicleByPlate(data.plateNumber);
  if (existing) {
    throw AppError.conflict(
      `Vehicle with plate "${data.plateNumber}" already exists`,
      "PLATE_NUMBER_TAKEN"
    );
  }
  return vehicleRepo.createVehicle(data);
};

export const getAllVehicles = async () => {
  return vehicleRepo.findAllVehicles();
};

export const getVehicleById = async (id: string) => {
  const vehicle = await vehicleRepo.findVehicleById(id);
  if (!vehicle) {
    throw AppError.notFound("Vehicle not found", "VEHICLE_NOT_FOUND");
  }
  return vehicle;
};

export const updateVehicle = async (id: string, data: UpdateVehicleInput) => {
  await getVehicleById(id); // 404 guard

  if (data.plateNumber) {
    const duplicate = await vehicleRepo.findVehicleByPlate(
      data.plateNumber,
      id
    );
    if (duplicate) {
      throw AppError.conflict(
        `Vehicle with plate "${data.plateNumber}" already exists`,
        "PLATE_NUMBER_TAKEN"
      );
    }
  }

  return vehicleRepo.updateVehicle(id, data);
};

export const deleteVehicle = async (id: string) => {
  await getVehicleById(id); // 404 guard

  // Rule: can't delete vehicle on an active (IN_PROGRESS) route
  const { prisma } = await import("../../prisma/client");
  const activeRoute = await prisma.route.findFirst({
    where: {
      vehicleId: id,
      status: "IN_PROGRESS",
    },
    select: { id: true },
  });

  if (activeRoute) {
    throw AppError.badRequest(
      "Cannot delete a vehicle that is currently on an active route",
      "VEHICLE_IN_ACTIVE_ROUTE"
    );
  }

  await vehicleRepo.softDeleteVehicle(id);
};
