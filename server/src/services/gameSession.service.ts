import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import type { CreateGameSessionInput } from '../validators/gameSession.validator.js';
import { getScoreValidationConfig } from './config.service.js';
import { validateScore } from './score.service.js';

export interface CreateGameSessionParams extends CreateGameSessionInput {
  ipHash: string | null;
}

/**
 * Persist a finished game session after validating it server-side.
 * Duplicate clientSessionId values are rejected to prevent replay/duplication.
 */
export async function createGameSession(params: CreateGameSessionParams) {
  const scoreConfig = await getScoreValidationConfig();

  const scoreCheck = validateScore(
    { score: params.score, durationSeconds: params.durationSeconds },
    scoreConfig,
  );

  if (!scoreCheck.valid) {
    throw AppError.badRequest(scoreCheck.reason ?? 'Puntaje inválido.');
  }

  // Reject duplicate submissions early with a clear message.
  const existing = await prisma.gameSession.findUnique({
    where: { clientSessionId: params.clientSessionId },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict('Esta partida ya fue registrada.');
  }

  // Link or create a Player when a phone number is provided so that repeat
  // players can be recognized across sessions.
  let playerId: string | null = null;
  if (params.phone) {
    const player = await prisma.player.findFirst({
      where: { phone: params.phone },
      select: { id: true },
    });
    if (player) {
      await prisma.player.update({
        where: { id: player.id },
        data: { nickname: params.nickname, ...(params.name ? { name: params.name } : {}) },
      });
      playerId = player.id;
    } else {
      const created = await prisma.player.create({
        data: {
          nickname: params.nickname,
          phone: params.phone,
          ...(params.name ? { name: params.name } : {}),
        },
        select: { id: true },
      });
      playerId = created.id;
    }
  }

  const currentBest = await prisma.gameSession.findFirst({
    where: playerId
      ? { playerId }
      : { nickname: { equals: params.nickname, mode: 'insensitive' } },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    select: { score: true },
  });
  const isPersonalBest = !currentBest || params.score > currentBest.score;
  const bestScore = Math.max(currentBest?.score ?? 0, params.score);

  const session = await prisma.gameSession.create({
    data: {
      playerId,
      nickname: params.nickname,
      score: params.score,
      selectedBranch: params.selectedBranch,
      durationSeconds: params.durationSeconds,
      caughtItems: params.caughtItems,
      missedItems: params.missedItems,
      livesRemaining: params.livesRemaining,
      clientSessionId: params.clientSessionId,
      ipHash: params.ipHash,
    },
    select: {
      id: true,
      nickname: true,
      score: true,
      selectedBranch: true,
      createdAt: true,
      clientSessionId: true,
    },
  });

  return { ...session, isPersonalBest, bestScore };
}

/**
 * Compute an approximate leaderboard position for a given score.
 * Position = number of sessions with a strictly higher score + 1.
 */
export async function getApproximatePosition(score: number): Promise<number> {
  const higher = await prisma.gameSession.count({
    where: { score: { gt: score } },
  });
  return higher + 1;
}

/**
 * Fetch a session by its clientSessionId.
 */
export async function getSessionByClientId(clientSessionId: string) {
  return prisma.gameSession.findUnique({
    where: { clientSessionId },
    select: {
      id: true,
      score: true,
      nickname: true,
      selectedBranch: true,
    },
  });
}
