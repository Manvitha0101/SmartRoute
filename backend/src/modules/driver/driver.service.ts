/**
 * driver.service.ts — Business logic for drivers.
 *
 * BUSINESS RULES:
 * 1. Phone numbers must be unique — a phone is a driver identifier
 * 2. License numbers must be unique — legally can't share a license
 * 3. If vehicleId is provided, the vehicle must actually exist (referential check)
 * 4. Cannot delete a driver currently assigned to an IN_PROGRESS route
 */

import { AppError } from "../../utils/AppError";
import * as driverRepo from "./driver.repository";
import type { CreateDriverInput, UpdateDriverInput } from "./driver.schemas";

export const createDriver = async (data: CreateDriverInput) => {
  // Rule 1: Unique phone
  const existingPhone = await driverRepo.findDriverByPhone(data.phone);
  if (existingPhone) {
    throw AppError.conflict(
      `A driver with phone "${data.phone}" already exists`,
      "PHONE_TAKEN"
    );
  }

  // Rule 2: Unique license
  const existingLicense = await driverRepo.findDriverByLicense(data.licenseNumber);
  if (existingLicense) {
    throw AppError.conflict(
      `A driver with license "${data.licenseNumber}" already exists`,
      "LICENSE_TAKEN"
    );
  }

  // Rule 3: vehicleId must point to a real, non-deleted vehicle
  if (data.vehicleId) {
    const { prisma } = await import("../../prisma/client");
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) {
      throw AppError.badRequest(
        `Vehicle with ID "${data.vehicleId}" does not exist`,
        "VEHICLE_NOT_FOUND"
      );
    }
  }

  return driverRepo.createDriver(data);
};

export const getAllDrivers = async () => {
  return driverRepo.findAllDrivers();
};

export const getDriverById = async (id: string) => {
  const driver = await driverRepo.findDriverById(id);
  if (!driver) {
    throw AppError.notFound("Driver not found", "DRIVER_NOT_FOUND");
  }
  return driver;
};

export const updateDriver = async (id: string, data: UpdateDriverInput) => {
  await getDriverById(id); // 404 guard

  if (data.phone) {
    const dup = await driverRepo.findDriverByPhone(data.phone, id);
    if (dup) throw AppError.conflict(`Phone "${data.phone}" already in use`, "PHONE_TAKEN");
  }

  if (data.licenseNumber) {
    const dup = await driverRepo.findDriverByLicense(data.licenseNumber, id);
    if (dup) throw AppError.conflict(`License "${data.licenseNumber}" already in use`, "LICENSE_TAKEN");
  }

  if (data.vehicleId) {
    const { prisma } = await import("../../prisma/client");
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) {
      throw AppError.badRequest(
        `Vehicle with ID "${data.vehicleId}" does not exist`,
        "VEHICLE_NOT_FOUND"
      );
    }
  }

  return driverRepo.updateDriver(id, data);
};

export const deleteDriver = async (id: string) => {
  await getDriverById(id); // 404 guard

  // Rule 4: Can't delete driver on active route
  const { prisma } = await import("../../prisma/client");
  const activeRoute = await prisma.route.findFirst({
    where: { driverId: id, status: "IN_PROGRESS" },
    select: { id: true },
  });

  if (activeRoute) {
    throw AppError.badRequest(
      "Cannot delete a driver currently assigned to an active route",
      "DRIVER_IN_ACTIVE_ROUTE"
    );
  }

  await driverRepo.softDeleteDriver(id);
};
