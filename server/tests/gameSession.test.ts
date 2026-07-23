import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client used across services.
const prismaMock = {
  gameSession: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  gameConfiguration: {
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

vi.mock('../src/config/prisma.js', () => ({
  prisma: prismaMock,
}));

// Import after the mock is registered.
const { createGameSession } = await import('../src/services/gameSession.service.js');
const { getLeaderboard } = await import('../src/services/leaderboard.service.js');

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no configuration rows -> services fall back to defaults.
  prismaMock.gameConfiguration.findUnique.mockResolvedValue(null);
  prismaMock.gameSession.findFirst.mockResolvedValue(null);
});

describe('createGameSession - duplicate prevention', () => {
  const baseInput = {
    nickname: 'Tester',
    score: 1200,
    selectedBranch: 'san-jose' as const,
    durationSeconds: 60,
    caughtItems: 12,
    missedItems: 3,
    livesRemaining: 2,
    clientSessionId: '11111111-1111-1111-1111-111111111111',
    ipHash: null,
  };

  it('rejects a duplicate clientSessionId', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue({ id: 'existing-id' });

    await expect(createGameSession(baseInput)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.gameSession.create).not.toHaveBeenCalled();
  });

  it('creates a new session when clientSessionId is unique', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(null);
    prismaMock.gameSession.create.mockResolvedValue({
      id: 'new-id',
      nickname: baseInput.nickname,
      score: baseInput.score,
      selectedBranch: baseInput.selectedBranch,
      createdAt: new Date(),
      clientSessionId: baseInput.clientSessionId,
    });

    const result = await createGameSession(baseInput);
    expect(result.id).toBe('new-id');
    expect(result.isPersonalBest).toBe(true);
    expect(result.bestScore).toBe(baseInput.score);
    expect(prismaMock.gameSession.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous personal best when a lower score is submitted', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(null);
    prismaMock.gameSession.findFirst.mockResolvedValue({ score: 10_000 });
    prismaMock.gameSession.create.mockResolvedValue({
      id: 'lower-session',
      nickname: baseInput.nickname,
      score: baseInput.score,
      selectedBranch: baseInput.selectedBranch,
      createdAt: new Date(),
      clientSessionId: baseInput.clientSessionId,
    });

    const result = await createGameSession(baseInput);
    expect(result.isPersonalBest).toBe(false);
    expect(result.bestScore).toBe(10_000);
  });

  it('rejects an impossible score', async () => {
    prismaMock.gameSession.findUnique.mockResolvedValue(null);

    await expect(
      createGameSession({ ...baseInput, score: 999999, durationSeconds: 60 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('getLeaderboard', () => {
  it('returns a page of personal bests without phone numbers', async () => {
    const now = new Date();
    prismaMock.$queryRaw.mockResolvedValue([
      {
        nickname: 'Ana',
        score: 5000,
        selectedBranch: 'san-jose',
        createdAt: now,
        totalEntries: 2,
      },
      {
        nickname: 'Beto',
        score: 3000,
        selectedBranch: 'san-jose',
        createdAt: now,
        totalEntries: 2,
      },
    ]);

    const result = await getLeaderboard({ page: 1, limit: 50 });
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[0].premium).toBe(true);
    expect(result.entries[1].rank).toBe(2);
    expect(result.entries[0]).not.toHaveProperty('phone');
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 50,
      totalEntries: 2,
      totalPages: 1,
    });
  });
});
