import type { PromotionTier } from '../types.js';

export interface PromotionOutcome {
  label: string;
  rewardType: 'NONE' | 'DISCOUNT' | 'SPECIAL';
  discountPercentage: number | null;
}

/**
 * Resolve which promotion a score qualifies for, mirroring the server logic.
 * Used only for immediate UI feedback; the server remains the source of truth.
 */
export function resolvePromotion(score: number, tiers: PromotionTier[]): PromotionOutcome {
  const safeScore = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
  const matched = tiers.find((tier) => {
    const aboveMin = safeScore >= tier.minScore;
    const belowMax = tier.maxScore === null ? true : safeScore <= tier.maxScore;
    return aboveMin && belowMax;
  });
  const tier = matched ?? tiers[0];
  return {
    label: tier?.label ?? 'SIGUE INTENTANDO',
    rewardType: tier?.rewardType ?? 'NONE',
    discountPercentage: tier?.discountPercentage ?? null,
  };
}
