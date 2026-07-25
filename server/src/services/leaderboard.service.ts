import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { LeaderboardQuery } from '../validators/gameSession.validator.js';

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  selectedBranch: string;
  createdAt: Date;
  premium: boolean;
  membershipPlan: 'daddy-plus' | 'daddy-elite' | null;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalEntries: number;
    totalPages: number;
  };
}

interface LeaderboardRow {
  playerId: string | null;
  nickname: string;
  score: number;
  selectedBranch: string;
  createdAt: Date;
  totalEntries: number;
  membershipPlan: 'DADDY_PLUS' | 'DADDY_ELITE' | null;
}

/**
 * Return one personal best per player, 50 places at a time.
 * Registered players are grouped by their private player id; legacy entries
 * without one are grouped by normalized avatar. Phone numbers are never read.
 */
export async function getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardPage> {
  const offset = (query.page - 1) * query.limit;
  const branchFilter = query.branch
    ? Prisma.sql`WHERE "selectedBranch" = ${query.branch}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<LeaderboardRow[]>(Prisma.sql`
    WITH ranked_sessions AS (
      SELECT
        "playerId",
        "nickname",
        "score",
        "selectedBranch",
        "createdAt",
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(
            "playerId"::text,
            'avatar:' || LOWER(TRIM("nickname"))
          )
          ORDER BY "score" DESC, "createdAt" ASC
        ) AS "personalRank"
      FROM "game_sessions"
      ${branchFilter}
    ),
    personal_bests AS (
      SELECT
        "playerId",
        "nickname",
        "score",
        "selectedBranch",
        "createdAt",
        COUNT(*) OVER()::int AS "totalEntries"
      FROM ranked_sessions
      WHERE "personalRank" = 1
    )
    SELECT
      pb."playerId",
      pb."nickname",
      pb."score",
      pb."selectedBranch",
      pb."createdAt",
      pb."totalEntries",
      m."plan" AS "membershipPlan"
    FROM personal_bests pb
    LEFT JOIN "memberships" m
      ON m."playerId" = pb."playerId"
      AND m."status" = 'ACTIVE'
    ORDER BY pb."score" DESC, pb."createdAt" ASC
    LIMIT ${query.limit}
    OFFSET ${offset}
  `);

  const totalEntries = rows[0]?.totalEntries ?? 0;
  const entries: LeaderboardEntry[] = rows.map((session, index) => {
    const rank = offset + index + 1;
    return {
      rank,
      nickname: session.nickname,
      score: session.score,
      selectedBranch: session.selectedBranch,
      createdAt: session.createdAt,
      premium: rank <= 10,
      membershipPlan:
        session.membershipPlan === 'DADDY_ELITE'
          ? 'daddy-elite'
          : session.membershipPlan === 'DADDY_PLUS'
            ? 'daddy-plus'
            : null,
    };
  });

  return {
    entries,
    pagination: {
      page: query.page,
      pageSize: query.limit,
      totalEntries,
      totalPages: Math.max(1, Math.ceil(totalEntries / query.limit)),
    },
  };
}
