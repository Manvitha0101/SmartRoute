-- SmartRoute PostgreSQL Schema Definition

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DISPATCHER', 'DRIVER');
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE', 'CAR', 'VAN', 'TRUCK');
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'ELECTRIC', 'CNG');
CREATE TYPE "OrderPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ASSIGNED', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE "TimeWindowStatus" AS ENUM ('NONE', 'AT_RISK', 'VIOLATED');
CREATE TYPE "RouteStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "ViolationType" AS ENUM ('PROJECTED', 'ACTUAL');

CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DISPATCHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "plateNumber" TEXT NOT NULL UNIQUE,
    "type" "VehicleType" NOT NULL,
    "capacityKg" DOUBLE PRECISION NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

CREATE TABLE "drivers" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL UNIQUE,
    "licenseNumber" TEXT NOT NULL UNIQUE,
    "vehicleId" TEXT REFERENCES "vehicles"("id"),
    "userId" TEXT UNIQUE REFERENCES "users"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "customerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "priority" "OrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "earliestDelivery" TIMESTAMP(3),
    "latestDelivery" TIMESTAMP(3),
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "timeWindowStatus" "TimeWindowStatus" NOT NULL DEFAULT 'NONE',
    "warehouseId" TEXT NOT NULL REFERENCES "warehouses"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_warehouseId_idx" ON "orders"("warehouseId");
CREATE INDEX "orders_priority_idx" ON "orders"("priority");

CREATE TABLE "routes" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "driverId" TEXT NOT NULL REFERENCES "drivers"("id"),
    "vehicleId" TEXT NOT NULL REFERENCES "vehicles"("id"),
    "warehouseId" TEXT NOT NULL REFERENCES "warehouses"("id"),
    "status" "RouteStatus" NOT NULL DEFAULT 'PLANNED',
    "totalDistanceKm" DOUBLE PRECISION,
    "estimatedDurationMin" INTEGER,
    "plannedDepartureAt" TIMESTAMP(3),
    "actualDepartureAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "routes_driverId_idx" ON "routes"("driverId");
CREATE INDEX "routes_status_idx" ON "routes"("status");

CREATE TABLE "route_stops" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "routeId" TEXT NOT NULL REFERENCES "routes"("id"),
    "orderId" TEXT NOT NULL REFERENCES "orders"("id"),
    "stopSequence" INTEGER NOT NULL,
    "projectedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "route_stops_routeId_orderId_key" UNIQUE ("routeId", "orderId"),
    CONSTRAINT "route_stops_routeId_stopSequence_key" UNIQUE ("routeId", "stopSequence")
);

CREATE INDEX "route_stops_routeId_idx" ON "route_stops"("routeId");
CREATE INDEX "route_stops_orderId_idx" ON "route_stops"("orderId");

CREATE TABLE "time_window_violations" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL REFERENCES "orders"("id"),
    "routeStopId" TEXT NOT NULL UNIQUE REFERENCES "route_stops"("id"),
    "routeId" TEXT NOT NULL REFERENCES "routes"("id"),
    "projectedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "violationType" "ViolationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "time_window_violations_routeId_idx" ON "time_window_violations"("routeId");
CREATE INDEX "time_window_violations_orderId_idx" ON "time_window_violations"("orderId");
CREATE INDEX "time_window_violations_createdAt_idx" ON "time_window_violations"("createdAt");

CREATE TABLE "eta_predictions" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "routeStopId" TEXT NOT NULL UNIQUE REFERENCES "route_stops"("id"),
    "predictedEtaMin" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "trafficZone" TEXT NOT NULL,
    "modelConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

