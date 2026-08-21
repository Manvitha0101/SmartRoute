/**
 * auth.repository.ts — ALL database operations for the auth module.
 *
 * WHY A REPOSITORY: This is the only layer allowed to import Prisma.
 * If you ever swap Prisma for another ORM (Drizzle, TypeORM), you change
 * ONLY this file. The service layer doesn't know or care about Prisma — it
 * calls repository methods and gets back plain objects.
 *
 * WHAT IT RETURNS: Plain objects (not raw Prisma models). The `select` clauses
 * deliberately exclude `passwordHash` — the DB layer itself prevents hash leakage,
 * not just the controller.
 */

import { prisma } from "../../prisma/client";
import { UserRole } from "@prisma/client";

// ─── Types returned by this repository ────────────────────────────────────────
// These are the shapes the service layer works with

export type UserRecord = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

export type UserWithHash = UserRecord & {
  passwordHash: string;
};

// ─── User operations ──────────────────────────────────────────────────────────

export const findUserByEmail = async (
  email: string
): Promise<UserWithHash | null> => {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null, // Never return soft-deleted users
    },
    select: {
      id: true,
      email: true,
      passwordHash: true, // Needed here for bcrypt.compare in service
      role: true,
      createdAt: true,
    },
  });
};

export const findUserById = async (
  id: string
): Promise<UserRecord | null> => {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      // passwordHash intentionally omitted
    },
  });
};

export const createUser = async (data: {
  email: string;
  passwordHash: string;
  role: UserRole;
}): Promise<UserRecord> => {
  return prisma.user.create({
    data,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      // passwordHash intentionally omitted — never return it
    },
  });
};

// ─── Refresh token operations ─────────────────────────────────────────────────

export const createRefreshToken = async (data: {
  userId: string;
  token: string;
  expiresAt: Date;
}) => {
  return prisma.refreshToken.create({ data });
};

export const findRefreshToken = async (token: string) => {
  return prisma.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
};

export const deleteRefreshToken = async (token: string) => {
  return prisma.refreshToken.delete({ where: { token } });
};

export const deleteAllUserRefreshTokens = async (userId: string) => {
  // Used when a user logs out of all devices
  return prisma.refreshToken.deleteMany({ where: { userId } });
};
