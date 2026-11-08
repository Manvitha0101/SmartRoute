import app from "./src/app";
import { env } from "./src/config/env";
import { prisma } from "./src/prisma/client";
import { ensureDemoUsers, runSeed } from "./src/seed-runner";

async function main() {
  const orders = await prisma.order.count();
  if (orders === 0) {
    console.log("Loading demo data...");
    await runSeed(prisma);
  } else {
    await ensureDemoUsers(prisma);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`SmartRoute API running on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
