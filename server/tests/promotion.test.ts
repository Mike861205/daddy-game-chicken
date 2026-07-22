import { describe, it, expect } from 'vitest';
import { resolvePromotion, DEFAULT_PROMOTION_TIERS } from '../src/services/promotion.service.js';

describe('resolvePromotion', () => {
  it('returns "SIGUE INTENTANDO" for scores below 1000', () => {
    const result = resolvePromotion(500);
    expect(result.label).toBe('SIGUE INTENTANDO');
    expect(result.grantsReward).toBe(false);
    expect(result.rewardType).toBe('NONE');
  });

  it('returns 5% discount between 1000 and 2499', () => {
    expect(resolvePromotion(1000).discountPercentage).toBe(5);
    expect(resolvePromotion(2499).discountPercentage).toBe(5);
    expect(resolvePromotion(1500).grantsReward).toBe(true);
  });

  it('returns 10% discount between 2500 and 4999', () => {
    expect(resolvePromotion(2500).discountPercentage).toBe(10);
    expect(resolvePromotion(4999).discountPercentage).toBe(10);
  });

  it('returns special promotion for 5000 or more', () => {
    const result = resolvePromotion(5000);
    expect(result.rewardType).toBe('SPECIAL');
    expect(result.grantsReward).toBe(true);
  });

  it('treats negative or invalid scores as 0', () => {
    expect(resolvePromotion(-100).label).toBe('SIGUE INTENTANDO');
    expect(resolvePromotion(Number.NaN).label).toBe('SIGUE INTENTANDO');
  });

  it('uses the provided custom tiers', () => {
    const custom = DEFAULT_PROMOTION_TIERS.map((tier) => ({ ...tier }));
    custom[1].discountPercentage = 7;
    expect(resolvePromotion(1200, custom).discountPercentage).toBe(7);
  });
});
