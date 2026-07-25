import type {
  GameResult,
  LeaderboardEntry,
  LeaderboardPage,
  PublicConfig,
  RewardResponse,
  SubmitResponse,
} from '../types.js';
import type {
  MembershipEntitlement,
  MembershipPlanId,
} from '../config/memberships.js';
import { EMPTY_MEMBERSHIP } from '../config/memberships.js';

/**
 * API base URL. In development Vite proxies /api to the backend.
 */
const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 7000;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }

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
  campaign: {
    bossArrivalSeconds: 120,
    worldCount: 5,
  },
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

  async getLeaderboard(branch?: string, page = 1): Promise<LeaderboardPage> {
    const params = new URLSearchParams({
      page: String(page),
      limit: '50',
    });
    if (branch) {
      params.set('branch', branch);
    }
    try {
      const response = await request<{
        data: LeaderboardEntry[];
        pagination: LeaderboardPage['pagination'];
      }>(`/leaderboard?${params.toString()}`);
      return {
        entries: response.data,
        pagination: response.pagination,
      };
    } catch {
      return {
        entries: [],
        pagination: { page, pageSize: 50, totalEntries: 0, totalPages: 1 },
      };
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
  async getMembershipStatus(phone: string): Promise<MembershipEntitlement> {
    if (!phone) return { ...EMPTY_MEMBERSHIP };
    try {
      const response = await request<{ data: { membership: MembershipEntitlement } }>(
        `/memberships/status?phone=${encodeURIComponent(phone)}`,
      );
      return response.data.membership;
    } catch {
      return { ...EMPTY_MEMBERSHIP };
    }
  },
  async createMembershipCheckout(
    planId: MembershipPlanId,
    registration: {
      name: string;
      avatar: string;
      phone: string;
    },
  ): Promise<{ url: string; playerId: string; productId: string }> {
    const response = await request<{
      data: { url: string; playerId: string; productId: string };
    }>('/memberships/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, ...registration }),
    });
    return response.data;
  },
  async confirmMembershipCheckout(
    sessionId: string,
    phone: string,
  ): Promise<MembershipEntitlement> {
    const response = await request<{ data: { membership: MembershipEntitlement } }>(
      '/memberships/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId, phone }),
      },
    );
    return response.data.membership;
  },
  async claimMembershipBenefit(phone: string): Promise<{
    planId: MembershipPlanId;
    label: string;
    available: boolean;
    reusable: boolean;
    code: string | null;
    period: string | null;
    registeredPhone: string;
    memberName: string | null;
    avatar: string;
  }> {
    const response = await request<{
      data: {
        benefit: {
          planId: MembershipPlanId;
          label: string;
          available: boolean;
          reusable: boolean;
          code: string | null;
          period: string | null;
          registeredPhone: string;
          memberName: string | null;
          avatar: string;
        };
      };
    }>('/memberships/benefits/claim', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return response.data.benefit;
  },
};
