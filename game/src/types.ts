import type { PowerType } from './config/items.js';

export interface Branch {
  id: string;
  name: string;
}

export interface PromotionTier {
  levelName?: string;
  minScore: number;
  maxScore: number | null;
  label: string;
  rewardType: 'NONE' | 'DISCOUNT' | 'SPECIAL';
  discountPercentage: number | null;
}

export interface PublicConfig {
  durationSeconds: number;
  startingLives: number;
  difficultyLevel: number;
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

export interface GameResult {
  score: number;
  caughtItems: number;
  missedItems: number;
  livesRemaining: number;
  durationSeconds: number;
  selectedBranch: string;
  clientSessionId: string;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  selectedBranch: string;
  createdAt: string;
}

export interface SubmitResponse {
  id: string;
  nickname: string;
  score: number;
  selectedBranch: string;
  clientSessionId: string;
  approximatePosition: number;
  createdAt: string;
}

export interface RewardResponse {
  granted: boolean;
  label: string;
  code?: string;
  rewardType: string;
  discountPercentage: number | null;
  expiresAt?: string;
}

export interface ActivePower {
  power: PowerType;
  expiresAt: number;
}
