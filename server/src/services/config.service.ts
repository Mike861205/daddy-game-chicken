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
  { id: 'lomas-del-sol', name: 'Daddy Lomas del Sol' },
  { id: 'auroras', name: 'Daddy Auroras' },
  { id: 'san-jose-del-cabo', name: 'Daddy San José del Cabo' },
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

/**
 * Build the public configuration served to the game client.
 */
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

  return {
    durationSeconds: duration.durationSeconds,
    startingLives: duration.startingLives,
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

/**
 * Resolve promotion tiers from configuration (with fallback).
 */
export async function getPromotionTiers(): Promise<PromotionTier[]> {
  const promotions = await readConfig('game.promotions', {
    tiers: DEFAULT_PROMOTION_TIERS,
    rewardExpiryHours: 168,
  });
  return promotions.tiers;
}

/**
 * Resolve reward expiry window in hours.
 */
export async function getRewardExpiryHours(): Promise<number> {
  const promotions = await readConfig('game.promotions', {
    tiers: DEFAULT_PROMOTION_TIERS,
    rewardExpiryHours: 168,
  });
  return promotions.rewardExpiryHours ?? 168;
}

/**
 * Resolve the server-side score validation configuration.
 */
export async function getScoreValidationConfig(): Promise<ScoreValidationConfig> {
  const scoring = await readConfig('game.scoring', {
    maxScorePerSecond: DEFAULT_SCORE_CONFIG.maxScorePerSecond,
  });
  return {
    maxScorePerSecond: scoring.maxScorePerSecond ?? DEFAULT_SCORE_CONFIG.maxScorePerSecond,
    maxDurationSeconds: DEFAULT_SCORE_CONFIG.maxDurationSeconds,
  };
}
