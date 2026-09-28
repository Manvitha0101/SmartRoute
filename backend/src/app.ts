/**
 * app.ts — Express application setup.
 */

import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";

// Route modules
import authRoutes from "./modules/auth/auth.routes";
import warehouseRoutes from "./modules/warehouse/warehouse.routes";
import vehicleRoutes from "./modules/vehicle/vehicle.routes";
import driverRoutes from "./modules/driver/driver.routes";
import orderRoutes from "./modules/order/order.routes";
import routeRoutes from "./modules/route/route.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import { runSeed } from "./seed-runner";

// Middleware
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

// cors — allow requests from Vercel deployments, localhost, and custom frontend domains
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // Allow any .vercel.app domain, localhost, or custom domain
      if (
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin === process.env.CORS_ORIGIN
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// ─── Request parsing middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Demo seed endpoint (protected) ──────────────────────────────────────────
// POST /api/v1/seed?secret=<SEED_SECRET>  — populates all demo data
app.post("/api/v1/seed", async (req, res) => {
  const secret = (req.query.secret as string) || req.body?.secret;
  const expected = process.env.SEED_SECRET || "smartroute-seed-2024";
  if (secret !== expected) {
    return res.status(403).json({ success: false, error: "Forbidden — wrong secret" });
  }
  try {
    const { prisma } = await import("./prisma/client");
    const log = await runSeed(prisma);
    return res.status(200).json({ success: true, log });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ─── API routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/warehouses", warehouseRoutes);
app.use("/api/v1/vehicles", vehicleRoutes);
app.use("/api/v1/drivers", driverRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/routes", routeRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
