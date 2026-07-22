import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

/**
 * Health check. Confirms the API is up and whether the database is reachable,
 * without exposing any credentials.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch (error) {
    logger.warn('Health check: database unreachable', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: databaseConnected ? 'connected' : 'unavailable',
  });
}
