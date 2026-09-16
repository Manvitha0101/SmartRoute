/**
 * auth.routes.ts — maps HTTP verb + path to middleware chain + controller.
 */

import { Router } from "express";
import { validateBody } from "../../middleware/validate";
import { authenticate } from "../../middleware/authenticate";
import { registerSchema, loginSchema, googleLoginSchema } from "./auth.schemas";
import * as authController from "./auth.controller";

const router = Router();

// POST /api/v1/auth/register
router.post("/register", validateBody(registerSchema), authController.register);

// POST /api/v1/auth/login
router.post("/login", validateBody(loginSchema), authController.login);

// POST /api/v1/auth/google
router.post("/google", validateBody(googleLoginSchema), authController.googleLogin);

// POST /api/v1/auth/refresh
router.post("/refresh", authController.refresh);

// POST /api/v1/auth/logout
router.post("/logout", authenticate, authController.logout);

export default router;
