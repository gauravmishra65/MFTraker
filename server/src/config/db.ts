import { PrismaClient } from "@prisma/client";

declare global {
  // Allow `globalThis.prisma` for hot-reload in dev to avoid creating multiple
  // PrismaClient instances when tsx watch reloads the module.
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
