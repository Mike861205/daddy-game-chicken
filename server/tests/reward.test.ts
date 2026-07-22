import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  gameSession: {
    findUnique: vi.fn(),
  },
  reward: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  gameConfiguration: {
    findUnique: vi.fn(),
  },
};

vi.mock('../src/config/prisma.js', () => ({
  prisma: prismaMock,
}));

const { createRewardForSession, validateRewardCode } = await import(
  '../src/services/reward.service.js'
);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.gameConfiguration.findUnique.mockResolvedValue(null);
});

describe('createRewardForSession', () => {
  it('does not grant a reward for low scores', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue({ id: 's1', score: 500 });
    const result = await createRewardForSession('client-1');
    expect(result.granted).toBe(false);
    expect(prismaMock.reward.create).not.toHaveBeenCalled();
  });

  it('generates a reward code for a qualifying score', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue({ id: 's2', score: 3000 });
    prismaMock.reward.findFirst.mockResolvedValue(null);
    prismaMock.reward.create.mockImplementation(async ({ data }) => ({
      code: data.code,
      expiresAt: data.expiresAt,
    }));

    const result = await createRewardForSession('client-2');
    expect(result.granted).toBe(true);
    expect(result.code).toMatch(/^DADDY-/u);
    expect(prismaMock.reward.create).toHaveBeenCalledTimes(1);
  });

  it('does not create a second reward for the same session', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue({ id: 's3', score: 6000 });
    prismaMock.reward.findFirst.mockResolvedValue({
      code: 'DADDY-EXIST1',
      rewardType: 'SPECIAL',
      discountPercentage: null,
      expiresAt: new Date(),
    });

    const result = await createRewardForSession('client-3');
    expect(result.granted).toBe(true);
    expect(result.code).toBe('DADDY-EXIST1');
    expect(prismaMock.reward.create).not.toHaveBeenCalled();
  });

  it('throws when the session does not exist', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(null);
    await expect(createRewardForSession('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('validateRewardCode', () => {
  it('marks an available, non-expired code as valid', async () => {
    prismaMock.reward.findUnique.mockResolvedValue({
      code: 'DADDY-VALID1',
      status: 'AVAILABLE',
      rewardType: 'DISCOUNT',
      discountPercentage: 10,
      expiresAt: new Date(Date.now() + 100000),
    });
    const result = await validateRewardCode('DADDY-VALID1');
    expect(result.valid).toBe(true);
  });

  it('marks an expired code as invalid', async () => {
    prismaMock.reward.findUnique.mockResolvedValue({
      code: 'DADDY-OLD1',
      status: 'AVAILABLE',
      rewardType: 'DISCOUNT',
      discountPercentage: 10,
      expiresAt: new Date(Date.now() - 100000),
    });
    const result = await validateRewardCode('DADDY-OLD1');
    expect(result.valid).toBe(false);
  });
});
