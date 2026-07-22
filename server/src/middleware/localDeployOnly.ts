import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function localDeployOnly(req: Request, _res: Response, next: NextFunction): void {
  if (!env.localDeployEnabled || env.isProduction || !LOOPBACK_ADDRESSES.has(req.ip ?? '')) {
    next(AppError.notFound('El despliegue solo esta disponible desde el entorno local.'));
    return;
  }
  next();
}
