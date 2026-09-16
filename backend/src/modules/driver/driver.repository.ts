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
  vehicle?: {
    id: string;
    plateNumber: string;
    type: string;
    capacityKg: number;
    fuelType: string;
  } | null;
  routes?: {
    id: string;
    status: string;
    totalDistanceKm: number | null;
    estimatedDurationMin: number | null;
    warehouse: { name: string };
    stops: { id: string; status: string }[];
  }[];
};

const driverSelect = {
  id: true,
  name: true,
  phone: true,
  licenseNumber: true,
  vehicleId: true,
  createdAt: true,
  updatedAt: true,
  vehicle: {
    select: {
      id: true,
      plateNumber: true,
      type: true,
      capacityKg: true,
      fuelType: true,
    },
  },
  routes: {
    where: {
      status: { in: ["PLANNED", "IN_PROGRESS"] as any },
    },
    select: {
      id: true,
      status: true,
      totalDistanceKm: true,
      estimatedDurationMin: true,
      warehouse: { select: { name: true } },
      stops: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

export const createDriver = async (data: CreateDriverInput): Promise<DriverRecord> => {
  return prisma.driver.create({ data, select: driverSelect }) as any;
};

export const findAllDrivers = async (): Promise<DriverRecord[]> => {
  return prisma.driver.findMany({
    where: { deletedAt: null },
    select: driverSelect,
    orderBy: { createdAt: "asc" },
  }) as any;
};

export const findDriverById = async (id: string): Promise<DriverRecord | null> => {
  return prisma.driver.findFirst({
    where: { id, deletedAt: null },
    select: driverSelect,
  }) as any;
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
    select: {
      id: true,
      name: true,
      phone: true,
      licenseNumber: true,
      vehicleId: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as any;
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
    select: {
      id: true,
      name: true,
      phone: true,
      licenseNumber: true,
      vehicleId: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as any;
};

export const updateDriver = async (
  id: string,
  data: UpdateDriverInput
): Promise<DriverRecord> => {
  return prisma.driver.update({ where: { id }, data, select: driverSelect }) as any;
};

export const softDeleteDriver = async (id: string): Promise<void> => {
  await prisma.driver.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
