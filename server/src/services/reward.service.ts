import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { getPromotionTiers, getRewardExpiryHours } from './config.service.js';
import { resolvePromotion } from './promotion.service.js';
import { generateRewardCode } from './rewardCode.service.js';

export interface RewardResult {
  granted: boolean;
  label: string;
  code?: string;
  rewardType: string;
  discountPercentage: number | null;
  expiresAt?: Date;
}

/**
 * Evaluate and (if applicable) create a single reward for a game session.
 * Enforces at most one reward per game session to prevent unlimited prizes.
 */
export async function createRewardForSession(clientSessionId: string): Promise<RewardResult> {
  const session = await prisma.gameSession.findUnique({
    where: { clientSessionId },
    select: { id: true, score: true },
  });

  if (!session) {
    throw AppError.notFound('No se encontró la partida.');
  }

  const tiers = await getPromotionTiers();
  const promotion = resolvePromotion(session.score, tiers);

  if (!promotion.grantsReward) {
    return {
      granted: false,
      label: promotion.label,
      rewardType: promotion.rewardType,
      discountPercentage: promotion.discountPercentage,
    };
  }

  // Prevent duplicate rewards: only one reward per game session.
  const existingReward = await prisma.reward.findFirst({
    where: { gameSessionId: session.id },
    select: {
      code: true,
      rewardType: true,
      discountPercentage: true,
      expiresAt: true,
    },
  });

  if (existingReward) {
    return {
      granted: true,
      label: promotion.label,
      code: existingReward.code,
      rewardType: existingReward.rewardType,
      discountPercentage: existingReward.discountPercentage,
      expiresAt: existingReward.expiresAt,
    };
  }

  const expiryHours = await getRewardExpiryHours();
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  // Retry a few times in the unlikely event of a code collision.
  let created: { code: string; expiresAt: Date } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
    const code = generateRewardCode();
    try {
      const reward = await prisma.reward.create({
        data: {
          gameSessionId: session.id,
          code,
          rewardType: promotion.rewardType,
          discountPercentage: promotion.discountPercentage,
          status: 'AVAILABLE',
          expiresAt,
        },
        select: { code: true, expiresAt: true },
      });
      created = reward;
    } catch {
      // Likely a unique collision on code; retry with a new code.
      created = null;
    }
  }

  if (!created) {
    throw AppError.internal('No se pudo generar el código de premio.');
  }

  return {
    granted: true,
    label: promotion.label,
    code: created.code,
    rewardType: promotion.rewardType,
    discountPercentage: promotion.discountPercentage,
    expiresAt: created.expiresAt,
  };
}

export interface ValidatedReward {
  code: string;
  status: string;
  rewardType: string;
  discountPercentage: number | null;
  expiresAt: Date;
  valid: boolean;
  message: string;
}

/**
 * Validate a reward code without redeeming it.
 */
export async function validateRewardCode(code: string): Promise<ValidatedReward> {
  const reward = await prisma.reward.findUnique({
    where: { code },
    select: {
      code: true,
      status: true,
      rewardType: true,
      discountPercentage: true,
      expiresAt: true,
    },
  });

  if (!reward) {
    throw AppError.notFound('El código no existe.');
  }

  const now = new Date();
  const isExpired = reward.expiresAt < now || reward.status === 'EXPIRED';
  const isRedeemed = reward.status === 'REDEEMED';
  const valid = reward.status === 'AVAILABLE' && !isExpired;

  let message = 'Premio válido y disponible.';
  if (isRedeemed) {
    message = 'Este premio ya fue canjeado.';
  } else if (isExpired) {
    message = 'Este premio ha expirado.';
  }

  return {
    code: reward.code,
    status: reward.status,
    rewardType: reward.rewardType,
    discountPercentage: reward.discountPercentage,
    expiresAt: reward.expiresAt,
    valid,
    message,
  };
}
