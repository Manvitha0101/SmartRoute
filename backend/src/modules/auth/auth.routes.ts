/**
 * auth.routes.ts — maps HTTP verb + path to middleware chain + controller.
 *
 * This file is ONLY configuration. No logic lives here.
 * Read each route as: "when THIS HTTP verb hits THIS path, run THESE in order"
 *
 * Middleware chains run left-to-right. If any middleware calls next(error),
 * the remaining handlers are skipped and the error handler runs.
 */

import { Router } from "express";
import { validateBody } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { registerSchema, loginSchema } from "./auth.schemas";
import * as authController from "./auth.controller";

const router = Router();

// POST /api/v1/auth/register
// Chain: validate body → register controller
router.post("/register", validateBody(registerSchema), authController.register);

// POST /api/v1/auth/login
// Chain: validate body → login controller
router.post("/login", validateBody(loginSchema), authController.login);

// POST /api/v1/auth/refresh
// Chain: refresh controller (reads cookie internally — no JWT auth needed)
router.post("/refresh", authController.refresh);

// POST /api/v1/auth/logout
// Chain: verify JWT (must be logged in to log out) → logout controller
router.post("/logout", authenticate, authController.logout);

export default router;
