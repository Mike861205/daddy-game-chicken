import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const prismaMock = {
  $queryRaw: vi.fn(),
  gameConfiguration: {
    findUnique: vi.fn(),
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
    expect(Array.isArray(response.body.data.branches)).toBe(true);
  });
});
