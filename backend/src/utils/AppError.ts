/**
 * AppError.ts — custom error class for all operational errors in the app.
 *
 * WHY: The built-in Error class only has `message`. Our error handler needs
 * to know the HTTP status code (400, 401, 404...) and a machine-readable
 * code ("NOT_FOUND", "UNAUTHORIZED") to build the correct JSON response.
 * Extending Error gives us all of that in one throwable object.
 *
 * isOperational: true  → expected error (user fault) → send JSON response
 * isOperational: false → programming bug → log full stack, send generic 500
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    // Call the parent Error constructor — sets this.message and this.stack
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Maintains proper prototype chain when extending built-in classes in TS
    Object.setPrototypeOf(this, AppError.prototype);

    // Captures where this error was instantiated (not where it was thrown)
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Convenience factories ────────────────────────────────────────────────────
// Instead of: throw new AppError("Not found", 404, "NOT_FOUND")
// Write:       throw AppError.notFound("Driver not found")

AppError.notFound = (msg = "Resource not found") =>
  new AppError(msg, 404, "NOT_FOUND");

AppError.unauthorized = (msg = "Unauthorized") =>
  new AppError(msg, 401, "UNAUTHORIZED");

AppError.forbidden = (msg = "Forbidden") =>
  new AppError(msg, 403, "FORBIDDEN");

AppError.conflict = (msg: string, code = "CONFLICT") =>
  new AppError(msg, 409, code);

AppError.badRequest = (msg: string, code = "BAD_REQUEST") =>
  new AppError(msg, 400, code);

AppError.businessRule = (msg: string, code = "BUSINESS_RULE_VIOLATION") =>
  new AppError(msg, 409, code);

// Augment the class type to include static factory methods
declare module "./AppError" {
  interface AppError {}
  namespace AppError {
    function notFound(msg?: string): AppError;
    function unauthorized(msg?: string): AppError;
    function forbidden(msg?: string): AppError;
    function conflict(msg: string, code?: string): AppError;
    function badRequest(msg: string, code?: string): AppError;
    function businessRule(msg: string, code?: string): AppError;
  }
}
