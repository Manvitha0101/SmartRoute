/**
 * errorHandler.ts — global error handling middleware.
 *
 * This is the LAST middleware registered in app.ts. Express identifies it as
 * an error handler because it has 4 parameters: (err, req, res, next).
 * All errors forwarded via next(error) or thrown in asyncHandler land here.
 *
 * Responsibilities:
 *   1. Distinguish operational errors (AppError) from bugs (unexpected errors)
 *   2. Build the standard error response envelope
 *   3. Log unexpected errors for debugging
 *   4. Never leak internal error details to the client in production
 */

import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { ValidationError } from "./validate";
import { errorResponse } from "../utils/apiResponse";
import { env } from "../config/env";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // next is required in the signature even if unused — Express needs 4 params
  // to identify this as an error handler
  _next: NextFunction
) => {
  // ── Case 1: Validation errors (Zod field errors) ──────────────────────────
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        details: err.details,
      },
    });
  }

  // ── Case 2: Operational errors (AppError) ─────────────────────────────────
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json(
      errorResponse(err.code, err.message)
    );
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientKnownRequestError ||
    /database server|SQLITE_|Can't reach database/i.test(err.message)
  ) {
    console.error("DATABASE ERROR:", err.message);
    return res.status(503).json(
      errorResponse("DATABASE_UNAVAILABLE", "The database is unavailable. Try again in a moment.")
    );
  }

  // ── Case 3: Unexpected errors (bugs, network failures, etc.) ──────────────
  // Always log these — they need to be investigated
  console.error("UNEXPECTED ERROR:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  // In development, include the error message so you can debug
  // In production, never reveal internal error details
  const message = env.isProduction
    ? "An unexpected error occurred"
    : err.message;

  return res.status(500).json(errorResponse("INTERNAL_ERROR", message));
};
