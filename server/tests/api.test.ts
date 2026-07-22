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
  prismaMock.$transaction.mockImplementation(async (operations) => Promise.all(operations));
});

describe('Super Admin', () => {
  it('blocks configuration access without an owner session', async () => {
    const response = await request(app).get('/api/admin/configuration');
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
    prismaMock.gameSession.findMany.mockResolvedValue([
      { nickname: 'Ana', score: 4000, selectedBranch: 'auroras', createdAt: new Date() },
    ]);
    const response = await request(app).get('/api/leaderboard');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].rank).toBe(1);
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
