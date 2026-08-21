/**
 * app.ts — Express application setup.
 *
 * This file configures the Express app: mounts global middleware, registers
 * all route groups, and attaches the error handler.
 *
 * WHY SEPARATE FROM server.ts:
 * server.ts starts the HTTP listener (app.listen). app.ts builds the app.
 * This separation lets you import the app in tests without starting a server.
 * Integration tests call: import app from './app' → supertest(app).get('/')
 * No port conflicts, no dangling servers in test suites.
 */

import "dotenv/config"; // Load .env before anything reads process.env
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env"; // This validates all env vars at import time

// Route modules
import authRoutes from "./modules/auth/auth.routes";

// Middleware
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────

// helmet sets HTTP security headers:
// X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, etc.
// One line eliminates a dozen common web security vulnerabilities.
app.use(helmet());

// cors — only allow requests from the React frontend origin
app.use(
  cors({
    origin: env.isProduction
      ? ["https://your-frontend-domain.com"] // Lock down in prod
      : ["http://localhost:5173", "http://localhost:3001"], // Vite default port
    credentials: true, // Required for cookies to be sent cross-origin
  })
);

// ─── Request parsing middleware ────────────────────────────────────────────────

app.use(express.json()); // Parse JSON bodies — populates req.body
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(cookieParser()); // Parse cookies — populates req.cookies (needed for refresh token)

// ─── Health check ─────────────────────────────────────────────────────────────

// Simple endpoint to verify the server is running — used by Docker health checks
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API routes ────────────────────────────────────────────────────────────────

app.use("/api/v1/auth", authRoutes);
// Future features mount here:
// app.use("/api/v1/warehouses", warehouseRoutes);
// app.use("/api/v1/vehicles", vehicleRoutes);
// app.use("/api/v1/drivers", driverRoutes);
// app.use("/api/v1/orders", orderRoutes);
// app.use("/api/v1/routes", routeRoutes);
// app.use("/api/v1/analytics", analyticsRoutes);

// ─── 404 handler (unmatched routes) ───────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// MUST be registered LAST — Express identifies error handlers by 4 parameters
app.use(errorHandler);

export default app;
