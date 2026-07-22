import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * Single shared Prisma client instance.
 * In development we keep it on the global object to avoid exhausting
 * database connections due to hot reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
