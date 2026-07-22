import { prisma } from '../config/prisma.js';

export interface PlayerLookupResult {
  name: string | null;
  nickname: string;
  phone: string | null;
}

/**
 * Find a returning player by phone number so they can play again without
 * registering from scratch. Returns null when no match exists.
 */
export async function findPlayerByPhone(phone: string): Promise<PlayerLookupResult | null> {
  const player = await prisma.player.findFirst({
    where: { phone },
    orderBy: { updatedAt: 'desc' },
    select: { name: true, nickname: true, phone: true },
  });

  return player ?? null;
}
