import { prisma } from "../../prisma/client";
import type { CreateDriverInput, UpdateDriverInput } from "./driver.schemas";

export type DriverRecord = {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  vehicleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const driverSelect = {
  id: true,
  name: true,
  phone: true,
  licenseNumber: true,
  vehicleId: true,
  createdAt: true,
  updatedAt: true,
};

export const createDriver = async (data: CreateDriverInput): Promise<DriverRecord> => {
  return prisma.driver.create({ data, select: driverSelect });
};

export const findAllDrivers = async (): Promise<DriverRecord[]> => {
  return prisma.driver.findMany({
    where: { deletedAt: null },
    select: driverSelect,
    orderBy: { createdAt: "desc" },
  });
};

export const findDriverById = async (id: string): Promise<DriverRecord | null> => {
  return prisma.driver.findFirst({
    where: { id, deletedAt: null },
    select: driverSelect,
  });
};

export const findDriverByPhone = async (
  phone: string,
  excludeId?: string
): Promise<DriverRecord | null> => {
  return prisma.driver.findFirst({
    where: {
      phone,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: driverSelect,
  });
};

export const findDriverByLicense = async (
  licenseNumber: string,
  excludeId?: string
): Promise<DriverRecord | null> => {
  return prisma.driver.findFirst({
    where: {
      licenseNumber,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: driverSelect,
  });
};

export const updateDriver = async (
  id: string,
  data: UpdateDriverInput
): Promise<DriverRecord> => {
  return prisma.driver.update({ where: { id }, data, select: driverSelect });
};

export const softDeleteDriver = async (id: string): Promise<void> => {
  await prisma.driver.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
