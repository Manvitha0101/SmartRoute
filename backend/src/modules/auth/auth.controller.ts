/**
 * auth.controller.ts — HTTP orchestration for auth.
 */

import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";

// Cookie configuration
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/api/v1/auth",
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.register(req.body);
  res.status(201).json(successResponse(user));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body);

  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(200).json(successResponse({ accessToken, user }));
});

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await authService.googleLogin(req.body);

  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(200).json(successResponse({ accessToken, user }));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
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

  if (refreshToken && req.user) {
    await authService.logout(req.user.id, refreshToken);
  }

  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
  res.status(200).json(successResponse({ message: "Logged out successfully" }));
});
