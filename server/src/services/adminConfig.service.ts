import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { PromotionTier } from './promotion.service.js';
import { getAdminGameConfig } from './config.service.js';

export interface AdminGameConfig {
  businessPhone: string;
  rewardExpiryHours: number;
  difficultyLevel: number;
  tiers: PromotionTier[];
}

export async function readAdminGameConfig(): Promise<AdminGameConfig> {
  return getAdminGameConfig();
}

export async function saveAdminGameConfig(config: AdminGameConfig): Promise<AdminGameConfig> {
  const tiers = [...config.tiers].sort((a, b) => a.minScore - b.minScore);
  const promotionsValue = {
    tiers,
    rewardExpiryHours: config.rewardExpiryHours,
  } as unknown as Prisma.InputJsonValue;

  await prisma.$transaction([
    prisma.gameConfiguration.upsert({
      where: { key: 'game.contact' },
      update: { value: { businessPhone: config.businessPhone } },
      create: { key: 'game.contact', value: { businessPhone: config.businessPhone } },
    }),
    prisma.gameConfiguration.upsert({
      where: { key: 'game.promotions' },
      update: { value: promotionsValue },
      create: {
        key: 'game.promotions',
        value: promotionsValue,
      },
    }),
    prisma.gameConfiguration.upsert({
      where: { key: 'game.difficulty' },
      update: { value: { level: config.difficultyLevel } },
      create: { key: 'game.difficulty', value: { level: config.difficultyLevel } },
    }),
  ]);

  return { ...config, tiers };
}
