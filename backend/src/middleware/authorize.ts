/**
 * authorize.ts — role-based access control middleware factory.
 *
 * Runs AFTER authenticate (which sets req.user). Checks if the user's role
 * is in the allowed roles list. If not → 403 Forbidden.
 *
 * Usage:
 *   router.delete('/warehouses/:id',
 *     authenticate,
 *     authorize('ADMIN'),
 *     warehouseController.delete
 *   )
 *
 * WHY SEPARATE FROM authenticate:
 * Authentication (who are you?) and authorization (what can you do?) are
 * separate concerns. Some routes need auth but no role restriction. Keeping
 * them separate lets you compose them independently.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

type Role = "ADMIN" | "DISPATCHER";

export const authorize =
  (...allowedRoles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    // authenticate must have run first — if req.user is missing, it's a
    // misconfigured route (programmer error), not a user error
    if (!req.user) {
      return next(AppError.unauthorized("Not authenticated"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `This action requires one of the following roles: ${allowedRoles.join(", ")}`
        )
      );
    }

    next();
  };
