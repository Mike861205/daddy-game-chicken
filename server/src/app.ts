import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp(): Express {
  const app = express();

  // Trust the first proxy (Nginx) so req.ip reflects the real client IP.
  app.set('trust proxy', 1);

  // Security headers.
  app.use(helmet());

  // CORS limited to configured origins.
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser tools (no origin) and configured origins.
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origen no permitido por CORS.'));
      },
      methods: ['GET', 'POST'],
      credentials: false,
    }),
  );

  // Body parsing with a strict size limit.
  app.use(express.json({ limit: '16kb' }));

  // Rate limiting for the whole API.
  app.use('/api', apiRateLimiter);

  // Routes.
  app.use('/api', apiRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 + error handling.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
