import { z } from 'zod';

/**
 * Allowed branch identifiers. Kept in sync with the seeded configuration.
 */
export const BRANCH_IDS = ['san-lucas', 'san-jose'] as const;

/**
 * Schema for submitting a finished game session.
 * The server does not fully trust these values and validates ranges.
 */
export const createGameSessionSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, 'El apodo es obligatorio.')
    .max(20, 'El apodo es demasiado largo.')
    .default('Jugador'),
  name: z.string().trim().max(40, 'El nombre es demasiado largo.').optional(),
  score: z.number().int().min(0, 'El puntaje no puede ser negativo.').max(1_000_000),
  selectedBranch: z.enum(BRANCH_IDS),
  durationSeconds: z.number().int().min(1).max(7200),
  caughtItems: z.number().int().min(0).max(10_000).default(0),
  missedItems: z.number().int().min(0).max(10_000).default(0),
  livesRemaining: z.number().int().min(0).max(5).default(0),
  clientSessionId: z.string().uuid('clientSessionId debe ser un UUID válido.'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/u, 'Teléfono inválido.')
    .optional(),
});

export type CreateGameSessionInput = z.infer<typeof createGameSessionSchema>;

/**
 * Schema for requesting a reward for a given game session.
 */
export const createRewardSchema = z.object({
  clientSessionId: z.string().uuid(),
});

export type CreateRewardInput = z.infer<typeof createRewardSchema>;

/**
 * Schema for validating a reward code.
 */
export const validateRewardSchema = z.object({
  code: z.string().trim().min(4).max(40),
});

export type ValidateRewardInput = z.infer<typeof validateRewardSchema>;

/**
 * Query schema for the leaderboard endpoint.
 */
export const leaderboardQuerySchema = z.object({
  branch: z.enum(BRANCH_IDS).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

/**
 * Query schema for looking up a returning player by phone number.
 */
export const playerLookupQuerySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,20}$/u, 'Teléfono inválido.'),
});

export type PlayerLookupQuery = z.infer<typeof playerLookupQuerySchema>;
