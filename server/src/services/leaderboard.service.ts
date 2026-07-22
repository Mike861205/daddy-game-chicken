import { prisma } from '../config/prisma.js';
import type { LeaderboardQuery } from '../validators/gameSession.validator.js';

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  selectedBranch: string;
  createdAt: Date;
}

/**
 * Return the top scores. Phone numbers are never included.
 */
export async function getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
  const sessions = await prisma.gameSession.findMany({
    where: query.branch ? { selectedBranch: query.branch } : undefined,
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: query.limit,
    select: {
      nickname: true,
      score: true,
      selectedBranch: true,
      createdAt: true,
    },
  });

  return sessions.map((session, index) => ({
    rank: index + 1,
    nickname: session.nickname,
    score: session.score,
    selectedBranch: session.selectedBranch,
    createdAt: session.createdAt,
  }));
}
