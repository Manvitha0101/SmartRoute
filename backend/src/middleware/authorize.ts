/**
 * authorize.ts — role-based access control middleware factory.
 *
 * Runs AFTER authenticate (which sets req.user). Checks if the user's role
 * is in the allowed roles list. If not → 403 Forbidden.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export type Role = "ADMIN" | "DISPATCHER" | "DRIVER";

export const authorize =
  (...allowedRoles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
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
