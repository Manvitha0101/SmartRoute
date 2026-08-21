/**
 * apiResponse.ts — builds the standard JSON response envelope.
 *
 * Every response from this API has this shape:
 *   Success: { success: true, data: { ... } }
 *   Error:   { success: false, error: { code, message, details? } }
 *
 * WHY: Without this, each controller builds its own response shape. After 10
 * controllers, you have 10 different shapes and the frontend has to handle
 * all of them. One utility, one shape, always.
 */

export const successResponse = <T>(data: T) => ({
  success: true as const,
  data,
});

export const errorResponse = (
  code: string,
  message: string,
  details?: unknown
) => ({
  success: false as const,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});
