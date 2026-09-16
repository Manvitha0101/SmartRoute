/**
 * AppError.ts — custom error class for all operational errors in the app.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Convenience factories ────────────────────────────────────────────────────

AppError.notFound = (msg = "Resource not found", code = "NOT_FOUND") =>
  new AppError(msg, 404, code);

AppError.unauthorized = (msg = "Unauthorized", code = "UNAUTHORIZED") =>
  new AppError(msg, 401, code);

AppError.forbidden = (msg = "Forbidden", code = "FORBIDDEN") =>
  new AppError(msg, 403, code);

AppError.conflict = (msg: string, code = "CONFLICT") =>
  new AppError(msg, 409, code);

AppError.badRequest = (msg: string, code = "BAD_REQUEST") =>
  new AppError(msg, 400, code);

AppError.businessRule = (msg: string, code = "BUSINESS_RULE_VIOLATION") =>
  new AppError(msg, 409, code);

declare module "./AppError" {
  interface AppError {}
  namespace AppError {
    function notFound(msg?: string, code?: string): AppError;
    function unauthorized(msg?: string, code?: string): AppError;
    function forbidden(msg?: string, code?: string): AppError;
    function conflict(msg: string, code?: string): AppError;
    function badRequest(msg: string, code?: string): AppError;
    function businessRule(msg: string, code?: string): AppError;
  }
}
