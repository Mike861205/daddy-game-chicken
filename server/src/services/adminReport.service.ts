import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { AdminPlayerReportQuery } from '../validators/adminReport.validator.js';

const PAGE_SIZE = 20;

interface SummaryRow {
  totalPlayers: number;
  totalSessions: number;
  totalDurationSeconds: number;
  totalRewards: number;
  returningPlayers: number;
  rewardedPlayers: number;
}

interface PlayerReportRow {
  id: string;
  createdAt: Date;
  name: string | null;
  nickname: string;
  phone: string | null;
  gameCount: number;
  totalDurationSeconds: number;
  bestScore: number;
  rewardCount: number;
  rewardLabels: string | null;
  lastPlayedAt: Date | null;
}

export interface AdminPlayerReport {
  summary: SummaryRow & {
    rewardRate: number;
  };
  players: PlayerReportRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalPlayers: number;
    totalPages: number;
  };
  appliedRange: {
    from: string | null;
    to: string | null;
  };
}

function createReportCte(query: AdminPlayerReportQuery): Prisma.Sql {
  const dateFilter =
    query.from && query.to
      ? Prisma.sql`
          AND gs."createdAt" >= ${new Date(query.from)}
          AND gs."createdAt" < ${new Date(query.to)}
        `
      : Prisma.empty;

  return Prisma.sql`
    WITH filtered_sessions AS (
      SELECT
        gs."id",
        gs."playerId",
        gs."score",
        gs."durationSeconds",
        gs."createdAt"
      FROM "game_sessions" gs
      WHERE gs."playerId" IS NOT NULL
      ${dateFilter}
    ),
    session_metrics AS (
      SELECT
        fs."playerId",
        COUNT(*)::int AS "gameCount",
        COALESCE(SUM(fs."durationSeconds"), 0)::double precision AS "totalDurationSeconds",
        COALESCE(MAX(fs."score"), 0)::int AS "bestScore",
        MAX(fs."createdAt") AS "lastPlayedAt"
      FROM filtered_sessions fs
      GROUP BY fs."playerId"
    ),
    reward_metrics AS (
      SELECT
        fs."playerId",
        COUNT(DISTINCT r."id")::int AS "rewardCount",
        STRING_AGG(DISTINCT r."label", ' • ' ORDER BY r."label") AS "rewardLabels"
      FROM filtered_sessions fs
      INNER JOIN "rewards" r ON r."gameSessionId" = fs."id"
      GROUP BY fs."playerId"
    )
  `;
}

function playerJoin(query: AdminPlayerReportQuery): Prisma.Sql {
  return query.from && query.to
    ? Prisma.sql`INNER JOIN session_metrics sm ON sm."playerId" = p."id"`
    : Prisma.sql`LEFT JOIN session_metrics sm ON sm."playerId" = p."id"`;
}

function searchFilter(query: AdminPlayerReportQuery): Prisma.Sql {
  if (!query.search) {
    return Prisma.empty;
  }
  const pattern = `%${query.search}%`;
  return Prisma.sql`
    WHERE (
      p."nickname" ILIKE ${pattern}
      OR COALESCE(p."name", '') ILIKE ${pattern}
      OR COALESCE(p."phone", '') ILIKE ${pattern}
    )
  `;
}

function sortExpression(sortBy: AdminPlayerReportQuery['sortBy']): Prisma.Sql {
  const expressions: Record<AdminPlayerReportQuery['sortBy'], Prisma.Sql> = {
    createdAt: Prisma.sql`p."createdAt"`,
    nickname: Prisma.sql`LOWER(p."nickname")`,
    name: Prisma.sql`LOWER(COALESCE(p."name", ''))`,
    phone: Prisma.sql`COALESCE(p."phone", '')`,
    gameCount: Prisma.sql`COALESCE(sm."gameCount", 0)`,
    totalDurationSeconds: Prisma.sql`COALESCE(sm."totalDurationSeconds", 0)`,
    bestScore: Prisma.sql`COALESCE(sm."bestScore", 0)`,
    rewardCount: Prisma.sql`COALESCE(rm."rewardCount", 0)`,
    lastPlayedAt: Prisma.sql`sm."lastPlayedAt"`,
  };
  return expressions[sortBy];
}

/** Owner-only player activity report with server-side pagination and ordering. */
export async function getAdminPlayerReport(
  query: AdminPlayerReportQuery,
): Promise<AdminPlayerReport> {
  const cte = createReportCte(query);
  const join = playerJoin(query);
  const search = searchFilter(query);
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const orderBy = sortExpression(query.sortBy);
  const offset = (query.page - 1) * PAGE_SIZE;

  const summaryPromise = prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
    ${cte}
    SELECT
      COUNT(p."id")::int AS "totalPlayers",
      COALESCE(SUM(sm."gameCount"), 0)::int AS "totalSessions",
      COALESCE(SUM(sm."totalDurationSeconds"), 0)::double precision AS "totalDurationSeconds",
      COALESCE(SUM(rm."rewardCount"), 0)::int AS "totalRewards",
      COUNT(*) FILTER (WHERE COALESCE(sm."gameCount", 0) > 1)::int AS "returningPlayers",
      COUNT(*) FILTER (WHERE COALESCE(rm."rewardCount", 0) > 0)::int AS "rewardedPlayers"
    FROM "players" p
    ${join}
    LEFT JOIN reward_metrics rm ON rm."playerId" = p."id"
    ${search}
  `);

  const playersPromise = prisma.$queryRaw<PlayerReportRow[]>(Prisma.sql`
    ${cte}
    SELECT
      p."id",
      p."createdAt",
      p."name",
      p."nickname",
      p."phone",
      COALESCE(sm."gameCount", 0)::int AS "gameCount",
      COALESCE(sm."totalDurationSeconds", 0)::double precision AS "totalDurationSeconds",
      COALESCE(sm."bestScore", 0)::int AS "bestScore",
      COALESCE(rm."rewardCount", 0)::int AS "rewardCount",
      rm."rewardLabels",
      sm."lastPlayedAt"
    FROM "players" p
    ${join}
    LEFT JOIN reward_metrics rm ON rm."playerId" = p."id"
    ${search}
    ORDER BY ${orderBy} ${direction} NULLS LAST, p."id" ASC
    LIMIT ${PAGE_SIZE}
    OFFSET ${offset}
  `);

  const [summaryRows, players] = await Promise.all([summaryPromise, playersPromise]);
  const rawSummary = summaryRows[0] ?? {
    totalPlayers: 0,
    totalSessions: 0,
    totalDurationSeconds: 0,
    totalRewards: 0,
    returningPlayers: 0,
    rewardedPlayers: 0,
  };
  const rewardRate =
    rawSummary.totalPlayers > 0
      ? Math.round((rawSummary.rewardedPlayers / rawSummary.totalPlayers) * 1000) / 10
      : 0;

  return {
    summary: { ...rawSummary, rewardRate },
    players,
    pagination: {
      page: query.page,
      pageSize: PAGE_SIZE,
      totalPlayers: rawSummary.totalPlayers,
      totalPages: Math.max(1, Math.ceil(rawSummary.totalPlayers / PAGE_SIZE)),
    },
    appliedRange: {
      from: query.from ?? null,
      to: query.to ?? null,
    },
  };
}
