/**
 * vehicle.repository.ts — All DB operations for the vehicle module.
 *
 * Key difference from warehouse: plate number is @unique in the schema.
 * The service uses findByPlate to check for duplicates before creating.
 */

import { prisma } from "../../prisma/client";
import type { CreateVehicleInput, UpdateVehicleInput } from "./vehicle.schemas";

export type VehicleRecord = {
  id: string;
  plateNumber: string;
  type: string;
  capacityKg: number;
  fuelType: string;
  createdAt: Date;
  updatedAt: Date;
};

const vehicleSelect = {
  id: true,
  plateNumber: true,
  type: true,
  capacityKg: true,
  fuelType: true,
  createdAt: true,
  updatedAt: true,
};

export const createVehicle = async (
  data: CreateVehicleInput
): Promise<VehicleRecord> => {
  return prisma.vehicle.create({ data, select: vehicleSelect });
};

export const findAllVehicles = async (): Promise<VehicleRecord[]> => {
  return prisma.vehicle.findMany({
    where: { deletedAt: null },
    select: vehicleSelect,
    orderBy: { createdAt: "desc" },
  });
};

export const findVehicleById = async (
  id: string
): Promise<VehicleRecord | null> => {
  return prisma.vehicle.findFirst({
    where: { id, deletedAt: null },
    select: vehicleSelect,
  });
};

export const findVehicleByPlate = async (
  plateNumber: string,
  excludeId?: string
): Promise<VehicleRecord | null> => {
  return prisma.vehicle.findFirst({
    where: {
      plateNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: vehicleSelect,
  });
};

export const updateVehicle = async (
  id: string,
  data: UpdateVehicleInput
): Promise<VehicleRecord> => {
  return prisma.vehicle.update({ where: { id }, data, select: vehicleSelect });
};

export const softDeleteVehicle = async (id: string): Promise<void> => {
  await prisma.vehicle.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
