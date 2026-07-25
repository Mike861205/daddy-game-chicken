/**
 * Small localStorage wrapper for player recognition, personal best and preferences.
 */
const KEYS = {
  bestScore: 'dgc.bestScore',
  soundEnabled: 'dgc.soundEnabled',
  nickname: 'dgc.nickname',
  branch: 'dgc.branch',
  playerPhone: 'dgc.playerPhone',
  membership: 'dgc.membership',
  selectedOutfit: 'dgc.membership.outfit',
  selectedWeapon: 'dgc.membership.weapon',
  maxWorldUnlocked: 'dgc.membership.maxWorld',
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); ignore.
  }
}

export const storage = {
  getBestScore(): number {
    const value = safeGet(KEYS.bestScore);
    return value ? Number.parseInt(value, 10) || 0 : 0;
  },
  setBestScore(score: number): void {
    if (score > this.getBestScore()) {
      safeSet(KEYS.bestScore, String(score));
    }
  },
  getSoundEnabled(): boolean {
    const value = safeGet(KEYS.soundEnabled);
    return value === null ? true : value === 'true';
  },
  setSoundEnabled(enabled: boolean): void {
    safeSet(KEYS.soundEnabled, String(enabled));
  },
  getNickname(): string {
    return safeGet(KEYS.nickname) ?? '';
  },
  setNickname(nickname: string): void {
    safeSet(KEYS.nickname, nickname);
  },
  getBranch(): string | null {
    return safeGet(KEYS.branch);
  },
  setBranch(branch: string): void {
    safeSet(KEYS.branch, branch);
  },
  getPlayerPhone(): string {
    return safeGet(KEYS.playerPhone) ?? '';
  },
  setPlayerPhone(phone: string): void {
    safeSet(KEYS.playerPhone, phone);
  },
  getMembership(): import('../config/memberships.js').MembershipEntitlement | null {
    const value = safeGet(KEYS.membership);
    if (!value) return null;
    try {
      return JSON.parse(value) as import('../config/memberships.js').MembershipEntitlement;
    } catch {
      return null;
    }
  },
  setMembership(
    membership: import('../config/memberships.js').MembershipEntitlement,
  ): void {
    safeSet(KEYS.membership, JSON.stringify(membership));
  },
  getSelectedOutfit(): import('../config/memberships.js').OutfitId {
    return (safeGet(KEYS.selectedOutfit) as import('../config/memberships.js').OutfitId | null)
      ?? 'clasico';
  },
  setSelectedOutfit(outfit: import('../config/memberships.js').OutfitId): void {
    safeSet(KEYS.selectedOutfit, outfit);
  },
  getSelectedWeapon(): import('../config/memberships.js').PremiumWeaponId {
    return (safeGet(KEYS.selectedWeapon) as import('../config/memberships.js').PremiumWeaponId | null)
      ?? 'plasma-neon';
  },
  setSelectedWeapon(weapon: import('../config/memberships.js').PremiumWeaponId): void {
    safeSet(KEYS.selectedWeapon, weapon);
  },
  getMaxWorldUnlocked(): number {
    const value = safeGet(KEYS.maxWorldUnlocked);
    return value ? Math.max(1, Number.parseInt(value, 10) || 1) : 1;
  },
  unlockWorld(world: number): void {
    if (world > this.getMaxWorldUnlocked()) {
      safeSet(KEYS.maxWorldUnlocked, String(world));
    }
  },
};
