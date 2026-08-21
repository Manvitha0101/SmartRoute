/**
 * asyncHandler.ts — wraps async Express route handlers to catch thrown errors.
 *
 * WHY THIS IS NECESSARY:
 * Express 4 does not catch errors thrown from async functions. If you do:
 *
 *   app.get('/users', async (req, res) => {
 *     throw new Error('something went wrong'); // Express never sees this
 *   });
 *
 * The request hangs forever — no response, no error. The client times out.
 *
 * With asyncHandler:
 *   app.get('/users', asyncHandler(async (req, res) => {
 *     throw new Error('something');  // Caught → forwarded to next(error)
 *   }));
 *
 * Express sees it via next(error) and routes it to the errorHandler middleware.
 *
 * NOTE: Express 5 handles this natively. Since we're on Express 4, this
 * wrapper is essential. This is a common interview gotcha.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Execute the async function, catch any rejection, forward to Express
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
