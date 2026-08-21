/**
 * client.ts — singleton Prisma client.
 *
 * WHY A SINGLETON: PrismaClient manages a connection pool internally. If you
 * call `new PrismaClient()` in every file that needs DB access, you create
 * multiple pools — wasting connections and eventually exhausting the DB's
 * connection limit.
 *
 * The global variable trick: In development, tsx/ts-node reloads modules on
 * file changes. Without the global cache, each reload creates a new
 * PrismaClient instance. In production (Node.js), modules are cached
 * naturally, so a module-level singleton already works. The global pattern
 * handles both environments correctly.
 */

import { PrismaClient } from "@prisma/client";

// The cast through unknown is necessary because TypeScript doesn't know
// that we're adding a property to the global object
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
