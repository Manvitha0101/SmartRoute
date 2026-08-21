/**
 * auth.controller.ts — HTTP orchestration for auth.
 *
 * ONLY responsibilities:
 *   1. Call the appropriate service method
 *   2. Handle cookies (HttpOnly refresh token)
 *   3. Shape the HTTP response
 *
 * It does NOT:
 *   - Contain business logic
 *   - Touch Prisma
 *   - Validate inputs (that's middleware)
 *   - Handle hashing or tokens (that's the service)
 */

import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";

// Cookie configuration — centralized so it's consistent across set/clear
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,   // JS cannot read this cookie — prevents XSS theft
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: "strict" as const, // Prevents CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/api/v1/auth", // Cookie only sent to auth routes
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  // req.body is already validated + typed by validateBody middleware
  const user = await authService.register(req.body);

  res.status(201).json(successResponse(user));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body);

  // Set refresh token in HttpOnly cookie — invisible to JavaScript
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json(
    successResponse({ accessToken, user })
  );
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  // Cookie is read by Express automatically (requires cookie-parser middleware)
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    // Return early — authService.refresh also checks, but this gives a cleaner message
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Refresh token cookie missing" },
    });
  }

  const { accessToken } = await authService.refresh(refreshToken);

  res.status(200).json(successResponse({ accessToken }));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  // Attempt to delete from DB — service handles the case where it's missing
  if (refreshToken && req.user) {
    await authService.logout(req.user.id, refreshToken);
  }

  // Clear the cookie regardless — even if DB delete failed
  res.clearCookie("refreshToken", { path: "/api/v1/auth" });

  res.status(200).json(successResponse({ message: "Logged out successfully" }));
});
