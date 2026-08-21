/**
 * server.ts — HTTP server entry point.
 *
 * The only responsibility of this file is to:
 *   1. Import the configured Express app
 *   2. Start listening on the configured port
 *   3. Handle graceful shutdown (SIGTERM)
 *
 * Everything else (middleware, routes, error handling) is in app.ts.
 */

import app from "./src/app";
import { env } from "./src/config/env";
import { prisma } from "./src/prisma/client";

const server = app.listen(env.PORT, () => {
  console.log(`SmartRoute API running on http://localhost:${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
// WHY: When Docker or the OS sends SIGTERM (process termination signal),
// we want to finish in-flight requests before closing. Without this, active
// requests get cut off mid-response.

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    // Disconnect Prisma so DB connections are released cleanly
    await prisma.$disconnect();
    console.log("Database connections closed. Process exiting.");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C in terminal
