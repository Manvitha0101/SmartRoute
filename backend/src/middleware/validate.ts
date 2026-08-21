/**
 * validate.ts — middleware factory for Zod request validation.
 *
 * WHY A FACTORY: Different routes need different Zod schemas. Instead of
 * writing a new middleware function for each route, we write one function
 * that takes a schema and returns the middleware. This is the factory pattern.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), authController.login)
 *
 * What it does:
 *   1. Parses req.body against the provided Zod schema
 *   2. If valid: replaces req.body with the parsed (type-safe) data, calls next()
 *   3. If invalid: throws a 400 AppError with the Zod field errors as details
 *
 * WHY replace req.body: Zod's .parse() returns the validated + transformed
 * data (e.g., it strips unknown fields, coerces types). The original req.body
 * might have extra fields an attacker injected. The parsed result is clean.
 */

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError } from "../utils/AppError";

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Format Zod's errors into a readable array:
      // [{ field: "email", message: "Invalid email" }, ...]
      const details = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return next(
        new AppError("Validation failed", 400, "VALIDATION_ERROR")
      );
      // Note: we attach details via a workaround in errorHandler
      // A cleaner approach is a custom ValidationError class — shown below
    }

    // Replace req.body with the clean, validated, type-safe version
    req.body = result.data;
    next();
  };

// Cleaner approach — custom error that carries validation details
export class ValidationError extends AppError {
  public readonly details: { field: string; message: string }[];

  constructor(zodError: ZodError) {
    super("Validation failed", 400, "VALIDATION_ERROR");
    this.details = zodError.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export const validateBody =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new ValidationError(result.error));
    }

    req.body = result.data;
    next();
  };
