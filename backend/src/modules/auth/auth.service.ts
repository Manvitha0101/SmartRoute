/**
 * auth.service.ts — all business logic for authentication.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { BCRYPT_SALT_ROUNDS } from "../../config/constants";
import { AppError } from "../../utils/AppError";
import * as authRepository from "./auth.repository";
import type { RegisterInput, LoginInput, GoogleLoginInput } from "./auth.schemas";

// ─── Token generation helpers ─────────────────────────────────────────────────

const generateAccessToken = (user: {
  id: string;
  email: string;
  role: UserRole;
}): string => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"] }
  );
};

const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

const getRefreshTokenExpiry = (): Date => {
  const days = parseInt(env.JWT_REFRESH_EXPIRY);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
};

// ─── Service methods ──────────────────────────────────────────────────────────

export const register = async (input: RegisterInput) => {
  const existingUser = await authRepository.findUserByEmail(input.email);
  if (existingUser) {
    throw AppError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const user = await authRepository.createUser({
    email: input.email,
    passwordHash,
    role: input.role as UserRole,
  });

  return user;
};

export const login = async (
  input: LoginInput
): Promise<{ accessToken: string; refreshToken: string; user: authRepository.UserRecord }> => {
  const user = await authRepository.findUserByEmail(input.email);

  const passwordHash = user?.passwordHash ?? "$2b$12$invalidhashpaddingtomakeitconstanttime";
  const isPasswordValid = await bcrypt.compare(input.password, passwordHash);

  if (!user || !isPasswordValid) {
    throw AppError.unauthorized("Invalid email or password");
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  await authRepository.createRefreshToken({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  const { passwordHash: _, ...safeUser } = user;

  return { accessToken, refreshToken, user: safeUser };
};

export const googleLogin = async (
  input: GoogleLoginInput
): Promise<{ accessToken: string; refreshToken: string; user: authRepository.UserRecord }> => {
  let targetEmail = input.email;

  if (input.credential) {
    try {
      const decoded: any = jwt.decode(input.credential);
      if (decoded && decoded.email) {
        targetEmail = decoded.email;
      }
    } catch {
      // fallback
    }
  }

  if (!targetEmail) {
    targetEmail = "google.user@smartroute.io";
  }

  let user = await authRepository.findUserByEmail(targetEmail);
  if (!user) {
    const randomPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, BCRYPT_SALT_ROUNDS);
    user = (await authRepository.createUser({
      email: targetEmail,
      passwordHash,
      role: (input.role as UserRole) || UserRole.DISPATCHER,
    })) as any;
  }

  const accessToken = generateAccessToken(user!);
  const refreshToken = generateRefreshToken();

  await authRepository.createRefreshToken({
    userId: user!.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  const { passwordHash: _, ...safeUser } = user!;
  return { accessToken, refreshToken, user: safeUser };
};

export const refresh = async (
  refreshToken: string
): Promise<{ accessToken: string }> => {
  if (!refreshToken) {
    throw AppError.unauthorized("Refresh token missing");
  }

  const tokenRecord = await authRepository.findRefreshToken(refreshToken);

  if (!tokenRecord) {
    throw AppError.unauthorized("Invalid refresh token");
  }

  if (tokenRecord.expiresAt < new Date()) {
    await authRepository.deleteRefreshToken(refreshToken);
    throw AppError.unauthorized("Refresh token expired");
  }

  const accessToken = generateAccessToken(tokenRecord.user);

  return { accessToken };
};

export const logout = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  try {
    await authRepository.deleteRefreshToken(refreshToken);
  } catch {
    // Idempotent
  }
};
