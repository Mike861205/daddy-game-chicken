import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default public game configuration.
 * These values can be edited later without touching the frontend code.
 */
const gameConfigurations: { key: string; value: unknown }[] = [
  {
    key: 'game.duration',
    value: {
      durationSeconds: 60,
      startingLives: 3,
    },
  },
  {
    key: 'game.scoring',
    value: {
      normalItemPoints: 100,
      specialItemPoints: 200,
      combo3Multiplier: 2,
      combo5Multiplier: 3,
      // Server-side sanity limit to reject impossible scores.
      maxScorePerSecond: 500,
    },
  },
  {
    key: 'game.branches',
    value: [
      { id: 'san-lucas', name: 'Daddy San Lucas' },
      { id: 'san-jose', name: 'Daddy San José' },
    ],
  },
  {
    key: 'game.difficulty',
    value: {
      // 0 = very easy, 5 = normal, 10 = extreme.
      level: 5,
    },
  },
  {
    key: 'game.promotions',
    value: {
      tiers: [
        { levelName: 'Principiante', minScore: 0, maxScore: 999, label: 'SIGUE INTENTANDO', rewardType: 'NONE', discountPercentage: null },
        { levelName: 'Bronce', minScore: 1000, maxScore: 2499, label: 'GANASTE 5% DE DESCUENTO', rewardType: 'DISCOUNT', discountPercentage: 5 },
        { levelName: 'Plata', minScore: 2500, maxScore: 4999, label: 'GANASTE 10% DE DESCUENTO', rewardType: 'DISCOUNT', discountPercentage: 10 },
        { levelName: 'Daddy Supremo', minScore: 5000, maxScore: null, label: 'GANASTE UNA PROMOCIÓN ESPECIAL', rewardType: 'SPECIAL', discountPercentage: null },
      ],
      // Reward validity window in hours.
      rewardExpiryHours: 168,
    },
  },
  {
    key: 'game.contact',
    value: {
      businessPhone: '6241548148',
    },
  },
];

async function main() {
  console.log('Seeding game configurations...');

  for (const config of gameConfigurations) {
    await prisma.gameConfiguration.upsert({
      where: { key: config.key },
      update: { value: config.value as object },
      create: { key: config.key, value: config.value as object },
    });
    console.log(`  upserted ${config.key}`);
  }

  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
