import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Resolve from this module instead of process.cwd(). PM2 runs with cwd=server,
// while the monorepo's shared .env lives one directory above it. This works
// from both src/config (development) and dist/config (production builds).
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
// Load the optional server-local file first so its values take precedence over
// the shared file without overriding variables supplied by PM2 or the shell.
loadEnv({ path: resolve(projectRoot, 'server', '.env') });
loadEnv({ path: resolve(projectRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().optional().default(''),
  DIRECT_URL: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PUBLIC_GAME_URL: z.string().default('http://localhost:5173'),
  REWARD_SECRET: z.string().default('change-me-in-production'),
  ADMIN_SESSION_SECRET: z.string().min(24).default('change-admin-session-secret'),
  ADMIN_USERNAME: z.string().min(3).max(80).default('mike'),
  ADMIN_PASSWORD: z.string().min(8).max(200).default('mike1986'),
  LOCAL_DEPLOY_ENABLED: z.enum(['true', 'false']).default('false'),
  DEPLOY_SSH_HOST: z.string().regex(/^[A-Za-z0-9.-]+$/u).default('50.28.103.1'),
  DEPLOY_SSH_PORT: z.coerce.number().int().min(1).max(65535).default(22),
  DEPLOY_SSH_USER: z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/u).default('root'),
  DEPLOY_REMOTE_DIR: z.string().regex(/^\/[A-Za-z0-9._/-]+$/u).default('/var/www/daddy-game-chicken'),
  DEPLOY_BRANCH: z.string().regex(/^[A-Za-z0-9._/-]+$/u).default('main'),
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

if (
  data.NODE_ENV === 'production' &&
  data.ADMIN_SESSION_SECRET === 'change-admin-session-secret'
) {
  throw new Error('ADMIN_SESSION_SECRET debe configurarse en producción.');
}

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
  adminSessionSecret: data.ADMIN_SESSION_SECRET,
  adminUsername: data.ADMIN_USERNAME,
  adminPassword: data.ADMIN_PASSWORD,
  localDeployEnabled: data.LOCAL_DEPLOY_ENABLED === 'true' && data.NODE_ENV === 'development',
  deploySshHost: data.DEPLOY_SSH_HOST,
  deploySshPort: data.DEPLOY_SSH_PORT,
  deploySshUser: data.DEPLOY_SSH_USER,
  deployRemoteDir: data.DEPLOY_REMOTE_DIR,
  deployBranch: data.DEPLOY_BRANCH,
  rateLimitWindowMs: data.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: data.RATE_LIMIT_MAX,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
};

export type Env = typeof env;
