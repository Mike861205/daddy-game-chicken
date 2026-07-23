import type { Request, Response } from 'express';
import {
  createGameSessionSchema,
  leaderboardQuerySchema,
} from '../validators/gameSession.validator.js';
import {
  createGameSession,
  getApproximatePosition,
} from '../services/gameSession.service.js';
import { getLeaderboard } from '../services/leaderboard.service.js';
import { hashIp } from '../utils/hash.js';

/**
 * POST /api/game-sessions - store a finished game session.
 */
export async function submitGameSession(req: Request, res: Response): Promise<void> {
  const input = createGameSessionSchema.parse(req.body);
  const ipHash = hashIp(req.ip);

  const session = await createGameSession({ ...input, ipHash });
  const position = await getApproximatePosition(session.bestScore);

  res.status(201).json({
    data: {
      id: session.id,
      nickname: session.nickname,
      score: session.score,
      selectedBranch: session.selectedBranch,
      clientSessionId: session.clientSessionId,
      isPersonalBest: session.isPersonalBest,
      bestScore: session.bestScore,
      approximatePosition: position,
      createdAt: session.createdAt,
    },
  });
}

/**
 * GET /api/leaderboard - top scores, optionally filtered by branch.
 */
export async function getLeaderboardHandler(req: Request, res: Response): Promise<void> {
  const query = leaderboardQuerySchema.parse(req.query);
  const leaderboard = await getLeaderboard(query);
  res.status(200).json({
    data: leaderboard.entries,
    pagination: leaderboard.pagination,
  });
}
