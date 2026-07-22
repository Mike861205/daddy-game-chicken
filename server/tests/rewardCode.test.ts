import { describe, it, expect } from 'vitest';
import { generateRewardCode } from '../src/services/rewardCode.service.js';

describe('generateRewardCode', () => {
  it('starts with the DADDY- prefix', () => {
    expect(generateRewardCode()).toMatch(/^DADDY-[A-Z0-9]{6}$/u);
  });

  it('respects the requested length', () => {
    expect(generateRewardCode(8)).toMatch(/^DADDY-[A-Z0-9]{8}$/u);
  });

  it('does not contain ambiguous characters (I, O, 0, 1)', () => {
    for (let i = 0; i < 50; i += 1) {
      const suffix = generateRewardCode().replace('DADDY-', '');
      expect(suffix).not.toMatch(/[IO01]/u);
    }
  });

  it('produces distinct codes across many calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      codes.add(generateRewardCode());
    }
    // Collisions should be extremely unlikely.
    expect(codes.size).toBeGreaterThan(190);
  });
});
