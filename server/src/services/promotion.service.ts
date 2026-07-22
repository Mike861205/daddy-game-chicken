/**
 * Pure promotion logic. Kept free of I/O so it can be unit tested easily.
 */

export interface PromotionTier {
  levelName?: string;
  minScore: number;
  maxScore: number | null;
  label: string;
  rewardType: 'NONE' | 'DISCOUNT' | 'SPECIAL';
  discountPercentage: number | null;
}

export interface PromotionResult {
  levelName: string;
  label: string;
  rewardType: PromotionTier['rewardType'];
  discountPercentage: number | null;
  grantsReward: boolean;
}

/**
 * Default promotion tiers, used as a fallback if the database configuration
 * is unavailable. Real values are configurable server-side.
 */
export const DEFAULT_PROMOTION_TIERS: PromotionTier[] = [
  { levelName: 'Principiante', minScore: 0, maxScore: 999, label: 'SIGUE INTENTANDO', rewardType: 'NONE', discountPercentage: null },
  { levelName: 'Bronce', minScore: 1000, maxScore: 2499, label: 'GANASTE 5% DE DESCUENTO', rewardType: 'DISCOUNT', discountPercentage: 5 },
  { levelName: 'Plata', minScore: 2500, maxScore: 4999, label: 'GANASTE 10% DE DESCUENTO', rewardType: 'DISCOUNT', discountPercentage: 10 },
  { levelName: 'Daddy Supremo', minScore: 5000, maxScore: null, label: 'GANASTE UNA PROMOCIÓN ESPECIAL', rewardType: 'SPECIAL', discountPercentage: null },
];

/**
 * Resolve which promotion a score qualifies for.
 */
export function resolvePromotion(
  score: number,
  tiers: PromotionTier[] = DEFAULT_PROMOTION_TIERS,
): PromotionResult {
  const safeScore = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;

  const matchedIndex = tiers.findIndex((tier) => {
    const aboveMin = safeScore >= tier.minScore;
    const belowMax = tier.maxScore === null ? true : safeScore <= tier.maxScore;
    return aboveMin && belowMax;
  });

  const tier = matchedIndex >= 0 ? tiers[matchedIndex] : DEFAULT_PROMOTION_TIERS[0];

  return {
    levelName: tier.levelName?.trim() || `Nivel ${matchedIndex >= 0 ? matchedIndex + 1 : 1}`,
    label: tier.label,
    rewardType: tier.rewardType,
    discountPercentage: tier.discountPercentage,
    grantsReward: tier.rewardType !== 'NONE',
  };
}
