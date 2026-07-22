import type {
  GameResult,
  LeaderboardEntry,
  PublicConfig,
  RewardResponse,
  SubmitResponse,
} from '../types.js';

/**
 * API base URL. In development Vite proxies /api to the backend.
 */
const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    let message = 'Error de red';
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

/**
 * Default configuration used when the API is unreachable, so the game
 * remains fully playable offline.
 */
export const DEFAULT_CONFIG: PublicConfig = {
  durationSeconds: 60,
  startingLives: 3,
  difficultyLevel: 5,
  scoring: {
    normalItemPoints: 100,
    specialItemPoints: 200,
    combo3Multiplier: 2,
    combo5Multiplier: 3,
  },
  branches: [
    { id: 'san-lucas', name: 'Daddy San Lucas' },
    { id: 'san-jose', name: 'Daddy San José' },
  ],
  promotions: [
    { levelName: 'Principiante', minScore: 0, maxScore: 999, label: 'SIGUE INTENTANDO', rewardType: 'NONE', discountPercentage: null },
    { levelName: 'Bronce', minScore: 1000, maxScore: 2499, label: 'GANASTE 5% DE DESCUENTO', rewardType: 'DISCOUNT', discountPercentage: 5 },
    { levelName: 'Plata', minScore: 2500, maxScore: 4999, label: 'GANASTE 10% DE DESCUENTO', rewardType: 'DISCOUNT', discountPercentage: 10 },
    { levelName: 'Daddy Supremo', minScore: 5000, maxScore: null, label: 'GANASTE UNA PROMOCIÓN ESPECIAL', rewardType: 'SPECIAL', discountPercentage: null },
  ],
  scoreLimits: { maxScorePerSecond: 500 },
  contact: { businessPhone: '6241548148' },
};

export const api = {
  async getPublicConfig(): Promise<PublicConfig> {
    try {
      const result = await request<{ data: PublicConfig }>('/config/public');
      return result.data;
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  async submitGameSession(
    result: GameResult,
    nickname: string,
    phone?: string,
    name?: string,
  ): Promise<SubmitResponse> {
    const body = {
      nickname,
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      score: result.score,
      selectedBranch: result.selectedBranch,
      durationSeconds: result.durationSeconds,
      caughtItems: result.caughtItems,
      missedItems: result.missedItems,
      livesRemaining: result.livesRemaining,
      clientSessionId: result.clientSessionId,
    };
    const response = await request<{ data: SubmitResponse }>('/game-sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.data;
  },

  async getLeaderboard(branch?: string): Promise<LeaderboardEntry[]> {
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    try {
      const response = await request<{ data: LeaderboardEntry[] }>(`/leaderboard${query}`);
      return response.data;
    } catch {
      return [];
    }
  },

  async requestReward(clientSessionId: string): Promise<RewardResponse | null> {
    try {
      const response = await request<{ data: RewardResponse }>('/rewards', {
        method: 'POST',
        body: JSON.stringify({ clientSessionId }),
      });
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Look up a returning player by phone number. Returns the stored name and
   * avatar, or null when the phone is not registered.
   */
  async lookupPlayer(
    phone: string,
  ): Promise<{ name: string | null; avatar: string; phone: string | null } | null> {
    try {
      const response = await request<{
        data: { name: string | null; avatar: string; phone: string | null };
      }>(`/players/lookup?phone=${encodeURIComponent(phone)}`);
      return response.data;
    } catch {
      return null;
    }
  },
};
