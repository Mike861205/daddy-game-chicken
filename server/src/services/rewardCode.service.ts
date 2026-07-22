import { randomBytes } from 'node:crypto';

/**
 * Generate a human-friendly, hard-to-guess reward code.
 * Format: DADDY-XXXXXX (uppercase alphanumeric, no ambiguous characters).
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRewardCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `DADDY-${code}`;
}
