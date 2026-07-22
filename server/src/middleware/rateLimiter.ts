import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Global rate limiter applied to the API. Limits requests per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
    },
  },
});

/**
 * Stricter limiter for write-heavy endpoints (submitting sessions / rewards).
 */
export const writeRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: Math.max(10, Math.floor(env.rateLimitMax / 3)),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Demasiados envíos. Intenta de nuevo en un momento.',
    },
  },
});
