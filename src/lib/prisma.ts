/**
 * Prisma client singleton. In dev, Next's hot-reload would otherwise spawn a new
 * client on every reload and exhaust Postgres connections, so we stash one on
 * globalThis. DATABASE_URL is read from the env (Railway provides it at runtime).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
