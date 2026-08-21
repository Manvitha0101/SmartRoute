/**
 * authenticate.ts — JWT verification middleware.
 *
 * This middleware runs on every protected route. It:
 *   1. Reads the Authorization header
 *   2. Extracts the Bearer token
 *   3. Verifies its signature using JWT_SECRET
 *   4. Checks it hasn't expired (JWT library does this automatically)
 *   5. Injects the decoded payload as req.user
 *
 * If any step fails → throws 401 Unauthorized. The request never reaches
 * the controller.
 *
 * WHY NOT CHECK THE DB: Access tokens are stateless. We verify the signature
 * only — no DB query. This is the performance advantage of JWT. The DB is only
 * hit during refresh (to validate the refresh token).
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

interface JwtAccessPayload {
  id: string;
  email: string;
  role: "ADMIN" | "DISPATCHER";
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  // 1. Read the Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      AppError.unauthorized("Access token missing or malformed")
    );
  }

  // 2. Extract the token (remove "Bearer " prefix)
  const token = authHeader.split(" ")[1];

  try {
    // 3 & 4. Verify signature + expiry in one call
    // jwt.verify throws if: signature invalid, token expired, malformed
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtAccessPayload;

    // 5. Inject decoded user into req — available in all downstream middleware/controllers
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    // Don't leak details about why verification failed (helps attackers)
    if (error instanceof jwt.TokenExpiredError) {
      return next(AppError.unauthorized("Access token expired"));
    }
    return next(AppError.unauthorized("Invalid access token"));
  }
};
