import { prisma } from "../src/prisma/client";
import { runSeed } from "../src/seed-runner";

runSeed(prisma)
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
