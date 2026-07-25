import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { AdminMembershipReportQuery } from '../validators/adminReport.validator.js';

const PAGE_SIZE = 20;

interface MembershipSummaryRow {
  totalMembers: number;
  activeMembers: number;
  plusMembers: number;
  eliteMembers: number;
  attentionMembers: number;
  monthlyRevenue: number;
  totalSessions: number;
  totalDurationSeconds: number;
  totalPoints: number;
}

interface MembershipReportRow {
  id: string;
  joinedAt: Date;
  updatedAt: Date;
  name: string | null;
  nickname: string;
  phone: string | null;
  plan: 'DADDY_PLUS' | 'DADDY_ELITE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  gameCount: number;
  totalDurationSeconds: number;
  totalPoints: number;
  bestScore: number;
  lastPlayedAt: Date | null;
  benefitsGenerated: number;
  benefitsRedeemed: number;
}

export interface AdminMembershipReport {
  summary: MembershipSummaryRow;
  members: MembershipReportRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalMembers: number;
    totalPages: number;
  };
}

function membershipCte(): Prisma.Sql {
  return Prisma.sql`
    WITH session_metrics AS (
      SELECT
        gs."playerId",
        COUNT(*)::int AS "gameCount",
        COALESCE(SUM(gs."durationSeconds"), 0)::double precision AS "totalDurationSeconds",
        COALESCE(SUM(gs."score"), 0)::double precision AS "totalPoints",
        COALESCE(MAX(gs."score"), 0)::int AS "bestScore",
        MAX(gs."createdAt") AS "lastPlayedAt"
      FROM "game_sessions" gs
      WHERE gs."playerId" IS NOT NULL
      GROUP BY gs."playerId"
    ),
    benefit_metrics AS (
      SELECT
        mb."membershipId",
        COUNT(*)::int AS "benefitsGenerated",
        COUNT(*) FILTER (WHERE mb."redeemedAt" IS NOT NULL)::int AS "benefitsRedeemed"
      FROM "membership_monthly_benefits" mb
      GROUP BY mb."membershipId"
    )
  `;
}

function membershipFilter(query: AdminMembershipReportQuery): Prisma.Sql {
  const search = query.search
    ? Prisma.sql`
        AND (
          p."nickname" ILIKE ${`%${query.search}%`}
          OR COALESCE(p."name", '') ILIKE ${`%${query.search}%`}
          OR COALESCE(p."phone", '') ILIKE ${`%${query.search}%`}
        )
      `
    : Prisma.empty;
  const plan = query.plan === 'all'
    ? Prisma.empty
    : Prisma.sql`AND m."plan" = CAST(${query.plan} AS "MembershipPlan")`;
  const status = query.status === 'all'
    ? Prisma.empty
    : Prisma.sql`AND m."status" = CAST(${query.status} AS "MembershipStatus")`;
  return Prisma.sql`WHERE TRUE ${search} ${plan} ${status}`;
}

function sortExpression(sortBy: AdminMembershipReportQuery['sortBy']): Prisma.Sql {
  const expressions: Record<AdminMembershipReportQuery['sortBy'], Prisma.Sql> = {
    joinedAt: Prisma.sql`m."createdAt"`,
    plan: Prisma.sql`m."plan"`,
    status: Prisma.sql`m."status"`,
    nickname: Prisma.sql`LOWER(p."nickname")`,
    name: Prisma.sql`LOWER(COALESCE(p."name", ''))`,
    phone: Prisma.sql`COALESCE(p."phone", '')`,
    gameCount: Prisma.sql`COALESCE(sm."gameCount", 0)`,
    totalDurationSeconds: Prisma.sql`COALESCE(sm."totalDurationSeconds", 0)`,
    totalPoints: Prisma.sql`COALESCE(sm."totalPoints", 0)`,
    bestScore: Prisma.sql`COALESCE(sm."bestScore", 0)`,
    lastPlayedAt: Prisma.sql`sm."lastPlayedAt"`,
  };
  return expressions[sortBy];
}

/** Owner-only membership roster with engagement and subscription metrics. */
export async function getAdminMembershipReport(
  query: AdminMembershipReportQuery,
): Promise<AdminMembershipReport> {
  const cte = membershipCte();
  const filter = membershipFilter(query);
  const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const orderBy = sortExpression(query.sortBy);
  const offset = (query.page - 1) * PAGE_SIZE;

  const summaryPromise = prisma.$queryRaw<MembershipSummaryRow[]>(Prisma.sql`
    ${cte}
    SELECT
      COUNT(*)::int AS "totalMembers",
      COUNT(*) FILTER (WHERE m."status" = 'ACTIVE')::int AS "activeMembers",
      COUNT(*) FILTER (
        WHERE m."status" = 'ACTIVE' AND m."plan" = 'DADDY_PLUS'
      )::int AS "plusMembers",
      COUNT(*) FILTER (
        WHERE m."status" = 'ACTIVE' AND m."plan" = 'DADDY_ELITE'
      )::int AS "eliteMembers",
      COUNT(*) FILTER (
        WHERE m."status" IN ('PAST_DUE', 'INCOMPLETE')
      )::int AS "attentionMembers",
      (
        COUNT(*) FILTER (
          WHERE m."status" = 'ACTIVE' AND m."plan" = 'DADDY_PLUS'
        ) * 99
        + COUNT(*) FILTER (
          WHERE m."status" = 'ACTIVE' AND m."plan" = 'DADDY_ELITE'
        ) * 149
      )::double precision AS "monthlyRevenue",
      COALESCE(SUM(sm."gameCount"), 0)::int AS "totalSessions",
      COALESCE(SUM(sm."totalDurationSeconds"), 0)::double precision
        AS "totalDurationSeconds",
      COALESCE(SUM(sm."totalPoints"), 0)::double precision AS "totalPoints"
    FROM "memberships" m
    INNER JOIN "players" p ON p."id" = m."playerId"
    LEFT JOIN session_metrics sm ON sm."playerId" = p."id"
    ${filter}
  `);

  const membersPromise = prisma.$queryRaw<MembershipReportRow[]>(Prisma.sql`
    ${cte}
    SELECT
      m."id",
      m."createdAt" AS "joinedAt",
      m."updatedAt",
      p."name",
      p."nickname",
      p."phone",
      m."plan",
      m."status",
      m."currentPeriodEnd",
      m."cancelAtPeriodEnd",
      COALESCE(sm."gameCount", 0)::int AS "gameCount",
      COALESCE(sm."totalDurationSeconds", 0)::double precision AS "totalDurationSeconds",
      COALESCE(sm."totalPoints", 0)::double precision AS "totalPoints",
      COALESCE(sm."bestScore", 0)::int AS "bestScore",
      sm."lastPlayedAt",
      COALESCE(bm."benefitsGenerated", 0)::int AS "benefitsGenerated",
      COALESCE(bm."benefitsRedeemed", 0)::int AS "benefitsRedeemed"
    FROM "memberships" m
    INNER JOIN "players" p ON p."id" = m."playerId"
    LEFT JOIN session_metrics sm ON sm."playerId" = p."id"
    LEFT JOIN benefit_metrics bm ON bm."membershipId" = m."id"
    ${filter}
    ORDER BY ${orderBy} ${direction} NULLS LAST, m."id" ASC
    LIMIT ${PAGE_SIZE}
    OFFSET ${offset}
  `);

  const [summaryRows, members] = await Promise.all([summaryPromise, membersPromise]);
  const summary = summaryRows[0] ?? {
    totalMembers: 0,
    activeMembers: 0,
    plusMembers: 0,
    eliteMembers: 0,
    attentionMembers: 0,
    monthlyRevenue: 0,
    totalSessions: 0,
    totalDurationSeconds: 0,
    totalPoints: 0,
  };

  return {
    summary,
    members,
    pagination: {
      page: query.page,
      pageSize: PAGE_SIZE,
      totalMembers: summary.totalMembers,
      totalPages: Math.max(1, Math.ceil(summary.totalMembers / PAGE_SIZE)),
    },
  };
}
