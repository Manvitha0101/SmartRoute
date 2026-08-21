/**
 * auth.service.ts — all business logic for authentication.
 *
 * This is the most important layer. It:
 *   - Hashes passwords (bcrypt)
 *   - Compares passwords on login
 *   - Generates access + refresh tokens (JWT)
 *   - Verifies refresh tokens against the DB
 *   - Enforces business rules (no duplicate emails, etc.)
 *
 * It knows NOTHING about HTTP — no req, no res, no status codes.
 * It throws AppError for invalid states. The controller catches these
 * and maps them to HTTP responses.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { BCRYPT_SALT_ROUNDS } from "../../config/constants";
import { AppError } from "../../utils/AppError";
import * as authRepository from "./auth.repository";
import type { RegisterInput, LoginInput } from "./auth.schemas";

// ─── Token generation helpers ─────────────────────────────────────────────────

/**
 * generateAccessToken — creates a short-lived signed JWT.
 *
 * Payload contains: id, email, role
 * WHY NOT include sensitive data: JWTs are base64-encoded, not encrypted.
 * Anyone can decode the payload. Never put passwordHash, SSN, etc. in a JWT.
 */
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

/**
 * generateRefreshToken — creates a cryptographically random opaque token.
 *
 * WHY NOT a JWT for refresh: The refresh token's only job is to be compared
 * against the DB. An opaque random string is simpler, shorter, and gives no
 * information to an attacker who intercepts it (unlike a JWT which reveals
 * the user ID in its payload).
 */
const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

const getRefreshTokenExpiry = (): Date => {
  // Parse "7d" → 7 days from now
  const days = parseInt(env.JWT_REFRESH_EXPIRY); // "7d" → 7
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
};

// ─── Service methods ──────────────────────────────────────────────────────────

export const register = async (input: RegisterInput) => {
  // 1. Check for duplicate email — fail fast before hashing (hashing is expensive)
  const existingUser = await authRepository.findUserByEmail(input.email);
  if (existingUser) {
    throw AppError.conflict(
      "An account with this email already exists"
    );
  }

  // 2. Hash the password
  // bcrypt.hash(password, saltRounds) — the salt is generated + embedded in the hash
  // The hash looks like: $2b$12$<22-char-salt><31-char-hash>
  // bcrypt.compare later extracts the salt from the stored hash automatically
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  // 3. Create the user — returns record WITHOUT passwordHash (enforced by repository)
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
  // 1. Find user — must include passwordHash for comparison
  const user = await authRepository.findUserByEmail(input.email);

  // 2. Compare password — DO THIS EVEN IF USER NOT FOUND
  // WHY: If you return immediately when user not found, the response is faster
  // than when the user exists (bcrypt takes ~100ms). An attacker can use response
  // timing to enumerate valid emails. Always run bcrypt.compare.
  const passwordHash = user?.passwordHash ?? "$2b$12$invalidhashpaddingtomakeitconstanttime";
  const isPasswordValid = await bcrypt.compare(input.password, passwordHash);

  if (!user || !isPasswordValid) {
    // Never tell the user WHICH field was wrong
    throw AppError.unauthorized("Invalid email or password");
  }

  // 3. Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();

  // 4. Persist refresh token in DB
  await authRepository.createRefreshToken({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  // 5. Return — strip passwordHash from user object
  const { passwordHash: _, ...safeUser } = user;

  return { accessToken, refreshToken, user: safeUser };
};

export const refresh = async (
  refreshToken: string
): Promise<{ accessToken: string }> => {
  if (!refreshToken) {
    throw AppError.unauthorized("Refresh token missing");
  }

  // 1. Look up token in DB — if not found, it was already used or never existed
  const tokenRecord = await authRepository.findRefreshToken(refreshToken);

  if (!tokenRecord) {
    throw AppError.unauthorized("Invalid refresh token");
  }

  // 2. Check expiry — the DB stores this, unlike JWT which self-verifies
  if (tokenRecord.expiresAt < new Date()) {
    // Clean up the expired token
    await authRepository.deleteRefreshToken(refreshToken);
    throw AppError.unauthorized("Refresh token expired");
  }

  // 3. Issue new access token
  const accessToken = generateAccessToken(tokenRecord.user);

  return { accessToken };
};

export const logout = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  // Delete the specific refresh token — other sessions remain active
  // For "logout all devices", use deleteAllUserRefreshTokens(userId) instead
  try {
    await authRepository.deleteRefreshToken(refreshToken);
  } catch {
    // If the token doesn't exist (already deleted), that's fine — logout is idempotent
  }
};
