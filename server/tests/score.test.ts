import { describe, it, expect } from 'vitest';
import { validateScore } from '../src/services/score.service.js';

describe('validateScore', () => {
  it('accepts a plausible score', () => {
    const result = validateScore({ score: 5000, durationSeconds: 60 });
    expect(result.valid).toBe(true);
  });

  it('rejects negative scores', () => {
    const result = validateScore({ score: -1, durationSeconds: 60 });
    expect(result.valid).toBe(false);
  });

  it('rejects non-integer scores', () => {
    const result = validateScore({ score: 10.5, durationSeconds: 60 });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid durations', () => {
    expect(validateScore({ score: 100, durationSeconds: 0 }).valid).toBe(false);
    expect(validateScore({ score: 100, durationSeconds: -5 }).valid).toBe(false);
  });

  it('rejects durations above the maximum', () => {
    const result = validateScore({ score: 100, durationSeconds: 999 });
    expect(result.valid).toBe(false);
  });

  it('rejects impossible scores for the given duration', () => {
    // 60s * 500 max = 30000 max. 40000 is impossible.
    const result = validateScore({ score: 40000, durationSeconds: 60 });
    expect(result.valid).toBe(false);
  });

  it('respects a custom configuration', () => {
    const result = validateScore(
      { score: 2000, durationSeconds: 10 },
      { maxScorePerSecond: 100, maxDurationSeconds: 60 },
    );
    // 10s * 100 = 1000 max, 2000 is impossible.
    expect(result.valid).toBe(false);
  });
});
