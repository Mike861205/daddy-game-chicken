import { prisma } from '../config/prisma.js';
import { DEFAULT_PROMOTION_TIERS, type PromotionTier } from './promotion.service.js';
import { DEFAULT_SCORE_CONFIG, type ScoreValidationConfig } from './score.service.js';

export interface Branch {
  id: string;
  name: string;
}

export interface PublicConfig {
  durationSeconds: number;
  startingLives: number;
  difficultyLevel: number;
  campaign: {
    bossArrivalSeconds: number;
    worldCount: number;
  };
  scoring: {
    normalItemPoints: number;
    specialItemPoints: number;
    combo3Multiplier: number;
    combo5Multiplier: number;
  };
  branches: Branch[];
  promotions: PromotionTier[];
  scoreLimits: {
    maxScorePerSecond: number;
  };
  contact: {
    businessPhone: string;
  };
}

const DEFAULT_BRANCHES: Branch[] = [
  { id: 'san-lucas', name: 'Daddy San Lucas' },
  { id: 'san-jose', name: 'Daddy San José' },
];

async function readConfig<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.gameConfiguration.findUnique({ where: { key } });
    if (row && row.value !== null) {
      return row.value as T;
    }
  } catch {
    // Database unavailable: fall back to defaults so the game still works.
  }
  return fallback;
}

/** Build the public configuration served to the game client. */
export async function getPublicConfig(): Promise<PublicConfig> {
  const duration = await readConfig('game.duration', { durationSeconds: 60, startingLives: 3 });
  const scoring = await readConfig('game.scoring', {
    normalItemPoints: 100,
    specialItemPoints: 200,
    combo3Multiplier: 2,
    combo5Multiplier: 3,
    maxScorePerSecond: DEFAULT_SCORE_CONFIG.maxScorePerSecond,
  });
  const branches = await readConfig<Branch[]>('game.branches', DEFAULT_BRANCHES);
  const promotions = await readConfig('game.promotions', {
    tiers: DEFAULT_PROMOTION_TIERS,
    rewardExpiryHours: 168,
  });
  const contact = await readConfig('game.contact', { businessPhone: '6241548148' });
  const difficulty = await readConfig('game.difficulty', { level: 5 });
  const campaign = await readConfig('game.campaign', { bossArrivalSeconds: 120, worldCount: 5 });

  return {
    durationSeconds: duration.durationSeconds,
    startingLives: duration.startingLives,
    difficultyLevel: normalizeDifficulty(difficulty.level),
    campaign: {
      bossArrivalSeconds: normalizeBossArrival(campaign.bossArrivalSeconds),
      worldCount: 5,
    },
    scoring: {
      normalItemPoints: scoring.normalItemPoints,
      specialItemPoints: scoring.specialItemPoints,
      combo3Multiplier: scoring.combo3Multiplier,
      combo5Multiplier: scoring.combo5Multiplier,
    },
    branches,
    promotions: promotions.tiers,
    scoreLimits: {
      maxScorePerSecond: scoring.maxScorePerSecond ?? DEFAULT_SCORE_CONFIG.maxScorePerSecond,
    },
    contact: {
      businessPhone: contact.businessPhone,
    },
  };
}

/** Resolve promotion tiers from configuration (with fallback). */
export async function getPromotionTiers(): Promise<PromotionTier[]> {
  const promotions = await readConfig('game.promotions', {
    tiers: DEFAULT_PROMOTION_TIERS,
    rewardExpiryHours: 168,
  });
  return promotions.tiers;
}

/** Resolve reward expiry window in hours. */
export async function getRewardExpiryHours(): Promise<number> {
  const promotions = await readConfig('game.promotions', {
    tiers: DEFAULT_PROMOTION_TIERS,
    rewardExpiryHours: 168,
  });
  return promotions.rewardExpiryHours ?? 168;
}

/** Return the owner-editable contact, difficulty and promotion settings. */
export async function getAdminGameConfig(): Promise<{
  businessPhone: string;
  rewardExpiryHours: number;
  difficultyLevel: number;
  bossArrivalSeconds: number;
  tiers: PromotionTier[];
}> {
  const promotions = await readConfig('game.promotions', {
    tiers: DEFAULT_PROMOTION_TIERS,
    rewardExpiryHours: 168,
  });
  const contact = await readConfig('game.contact', { businessPhone: '6241548148' });
  const difficulty = await readConfig('game.difficulty', { level: 5 });
  const campaign = await readConfig('game.campaign', { bossArrivalSeconds: 120, worldCount: 5 });

  return {
    businessPhone: contact.businessPhone,
    rewardExpiryHours: promotions.rewardExpiryHours ?? 168,
    difficultyLevel: normalizeDifficulty(difficulty.level),
    bossArrivalSeconds: normalizeBossArrival(campaign.bossArrivalSeconds),
    tiers: promotions.tiers,
  };
}

/** Resolve the server-side score validation configuration. */
export async function getScoreValidationConfig(): Promise<ScoreValidationConfig> {
  const scoring = await readConfig('game.scoring', {
    maxScorePerSecond: DEFAULT_SCORE_CONFIG.maxScorePerSecond,
  });
  return {
    maxScorePerSecond: scoring.maxScorePerSecond ?? DEFAULT_SCORE_CONFIG.maxScorePerSecond,
    maxDurationSeconds: DEFAULT_SCORE_CONFIG.maxDurationSeconds,
  };
}

function normalizeDifficulty(level: unknown): number {
  const numericLevel = typeof level === 'number' && Number.isFinite(level) ? level : 5;
  return Math.max(0, Math.min(10, Math.round(numericLevel)));
}

function normalizeBossArrival(seconds: unknown): number {
  const numericSeconds = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 120;
  return Math.max(30, Math.min(600, Math.round(numericSeconds)));
}
