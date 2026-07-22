import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load the root .env file (monorepo shares a single .env at the repository root).
loadEnv({ path: resolve(process.cwd(), '.env') });
// Also allow a server-local .env to override when present.
loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().optional().default(''),
  DIRECT_URL: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_GAME_URL: z.string().default('http://localhost:5173'),
  REWARD_SECRET: z.string().default('change-me-in-production'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Do not print secret values, only the invalid keys.
  const invalidKeys = Object.keys(parsed.error.flatten().fieldErrors);
  throw new Error(`Invalid environment configuration for keys: ${invalidKeys.join(', ')}`);
}

const data = parsed.data;

export const env = {
  nodeEnv: data.NODE_ENV,
  port: data.PORT,
  databaseUrl: data.DATABASE_URL,
  directUrl: data.DIRECT_URL,
  corsOrigins: data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  publicGameUrl: data.PUBLIC_GAME_URL,
  rewardSecret: data.REWARD_SECRET,
  rateLimitWindowMs: data.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: data.RATE_LIMIT_MAX,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
};

export type Env = typeof env;
