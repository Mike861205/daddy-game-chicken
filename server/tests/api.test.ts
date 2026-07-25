import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const prismaMock = {
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  gameConfiguration: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  gameSession: {
    findMany: vi.fn(),
  },
  player: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  membership: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock('../src/config/prisma.js', () => ({
  prisma: prismaMock,
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.gameConfiguration.findUnique.mockResolvedValue(null);
  prismaMock.gameConfiguration.upsert.mockResolvedValue({});
  prismaMock.player.findFirst.mockResolvedValue(null);
  prismaMock.player.create.mockResolvedValue({
    id: '4c22f8bc-b48a-4de0-8b07-2a4b12bf5f58',
  });
  prismaMock.player.update.mockResolvedValue({
    id: '4c22f8bc-b48a-4de0-8b07-2a4b12bf5f58',
  });
  prismaMock.membership.upsert.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (operations) => Promise.all(operations));
});

describe('Super Admin', () => {
  it('blocks configuration access without an owner session', async () => {
    const response = await request(app).get('/api/admin/configuration');
    expect(response.status).toBe(401);
  });

  it('blocks player reports without an owner session', async () => {
    const response = await request(app).get('/api/admin/reports/players');
    expect(response.status).toBe(401);
  });

  it('rejects an incorrect owner password', async () => {
    const response = await request(app).post('/api/admin/login').send({
      username: 'mike',
      password: 'incorrect-password',
    });
    expect(response.status).toBe(401);
  });

  it('accepts the fixed owner credentials', async () => {
    const response = await request(app).post('/api/admin/login').send({
      username: 'mike',
      password: 'mike1986',
    });
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('saves an owner-selected difficulty from 0 to 10', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ username: 'mike', password: 'mike1986' });

    const response = await agent.put('/api/admin/configuration').send({
      businessPhone: '6241548148',
      rewardExpiryHours: 168,
      difficultyLevel: 8,
      bossArrivalSeconds: 120,
      tiers: [
        {
          levelName: 'Nivel manual',
          minScore: 0,
          maxScore: null,
          label: 'PREMIO DE PRUEBA',
          rewardType: 'SPECIAL',
          discountPercentage: null,
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.data.difficultyLevel).toBe(8);
    expect(response.body.data.bossArrivalSeconds).toBe(120);
    expect(response.body.data.tiers[0].levelName).toBe('Nivel manual');
    expect(prismaMock.gameConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'game.difficulty' } }),
    );
    expect(prismaMock.gameConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'game.campaign' } }),
    );
  });

  it('rejects difficulty values outside the allowed scale', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ username: 'mike', password: 'mike1986' });
    const response = await agent.put('/api/admin/configuration').send({
      businessPhone: '6241548148',
      rewardExpiryHours: 168,
      difficultyLevel: 11,
      bossArrivalSeconds: 120,
      tiers: [
        {
          levelName: 'Nivel fuera de rango',
          minScore: 0,
          maxScore: null,
          label: 'PREMIO DE PRUEBA',
          rewardType: 'SPECIAL',
          discountPercentage: null,
        },
      ],
    });
    expect(response.status).toBe(400);
  });

  it('keeps deployment disabled outside local development', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({
      username: 'mike',
      password: 'mike1986',
    });

    const status = await agent.get('/api/admin/deployment');
    expect(status.status).toBe(200);
    expect(status.body.data.enabled).toBe(false);

    const start = await agent.post('/api/admin/deployment').send({
      message: 'Should never run in tests',
    });
    expect(start.status).toBe(404);
  });

  it('returns paginated player activity and success metrics', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ username: 'mike', password: 'mike1986' });
    const now = new Date();
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          totalPlayers: 1,
          totalSessions: 3,
          totalDurationSeconds: 5400,
          totalRewards: 2,
          returningPlayers: 1,
          rewardedPlayers: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'player-1',
          createdAt: now,
          name: 'Ana López',
          nickname: 'DaddyAna',
          phone: '6241234567',
          gameCount: 3,
          totalDurationSeconds: 5400,
          bestScore: 11_000,
          rewardCount: 2,
          rewardLabels: '10% de descuento',
          lastPlayedAt: now,
        },
      ]);

    const response = await agent.get(
      '/api/admin/reports/players?page=1&sortBy=gameCount&sortOrder=desc',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toMatchObject({
      totalPlayers: 1,
      totalSessions: 3,
      totalRewards: 2,
      rewardRate: 100,
    });
    expect(response.body.data.players[0]).toMatchObject({
      nickname: 'DaddyAna',
      gameCount: 3,
      bestScore: 11_000,
    });
    expect(response.body.data.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalPlayers: 1,
      totalPages: 1,
    });
  });

  it('rejects incomplete custom report ranges', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ username: 'mike', password: 'mike1986' });
    const response = await agent.get(
      '/api/admin/reports/players?from=2026-07-01T00:00:00.000Z',
    );
    expect(response.status).toBe(400);
  });
});

describe('GET /api/health', () => {
  it('returns ok with database connected', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
  });

  it('reports database unavailable without crashing', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('unavailable');
  });
});

describe('GET /api/leaderboard', () => {
  it('returns leaderboard entries', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        nickname: 'Ana',
        score: 4000,
        selectedBranch: 'san-jose',
        createdAt: new Date(),
        totalEntries: 1,
      },
    ]);
    const response = await request(app).get('/api/leaderboard');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].rank).toBe(1);
    expect(response.body.data[0].premium).toBe(true);
    expect(response.body.pagination.pageSize).toBe(50);
  });

  it('rejects an invalid branch filter', async () => {
    const response = await request(app).get('/api/leaderboard?branch=invalid');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/config/public', () => {
  it('returns the public configuration', async () => {
    const response = await request(app).get('/api/config/public');
    expect(response.status).toBe(200);
    expect(response.body.data.durationSeconds).toBe(60);
    expect(response.body.data.difficultyLevel).toBe(5);
    expect(response.body.data.campaign).toEqual({ bossArrivalSeconds: 120, worldCount: 5 });
    expect(Array.isArray(response.body.data.branches)).toBe(true);
  });
});

describe('Membership API', () => {
  it('returns no active membership for an unknown player', async () => {
    const response = await request(app).get(
      '/api/memberships/status?phone=6241234567',
    );
    expect(response.status).toBe(200);
    expect(response.body.data.membership).toMatchObject({
      planId: null,
      status: 'none',
    });
  });

  it('registers the player and returns the selected Stripe Payment Link', async () => {
    prismaMock.player.findFirst.mockResolvedValue({
      id: '4c22f8bc-b48a-4de0-8b07-2a4b12bf5f58',
      name: 'Daddy Demo',
    });
    const response = await request(app).post('/api/memberships/checkout').send({
      planId: 'daddy-plus',
      phone: '6241234567',
      name: 'Daddy Demo',
      avatar: 'DaddyMaster',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.productId).toBe('prod_Ux7hZ0O7sUc0hJ');
    expect(response.body.data.url).toContain(
      'https://buy.stripe.com/00w14m8bz5bPb4n8Q64c80k',
    );
    expect(response.body.data.url).toContain(
      'client_reference_id=4c22f8bc-b48a-4de0-8b07-2a4b12bf5f58',
    );
    expect(prismaMock.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'INCOMPLETE' }),
      }),
    );
  });
});
