import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized error handler. Never leaks stack traces or credentials to clients.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos.',
        details: error.flatten().fieldErrors,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation.
    if (error.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'DUPLICATE',
          message: 'El registro ya existe.',
        },
      });
      return;
    }
  }

  // Unknown error: log internally, respond generically.
  logger.error('Unhandled error', {
    message: error instanceof Error ? error.message : 'unknown',
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado.',
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado.',
    },
  });
}
