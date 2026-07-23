/**
 * Small localStorage wrapper for player recognition, personal best and preferences.
 */
const KEYS = {
  bestScore: 'dgc.bestScore',
  soundEnabled: 'dgc.soundEnabled',
  nickname: 'dgc.nickname',
  branch: 'dgc.branch',
  playerPhone: 'dgc.playerPhone',
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
};
