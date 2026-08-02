import { describe, expect, it } from 'vitest';
import {
  createGameSessionSchema,
  playerLookupQuerySchema,
} from '../src/validators/gameSession.validator.js';
import { membershipCheckoutSchema } from '../src/validators/membership.validator.js';

const validSession = {
  nickname: 'DaddyMaster',
  name: 'Miguel',
  phone: '6241234567',
  score: 1200,
  selectedBranch: 'san-lucas',
  durationSeconds: 60,
  caughtItems: 12,
  missedItems: 2,
  livesRemaining: 2,
  clientSessionId: 'd32bd8d8-a5f2-414a-b977-f8c5d063a940',
};

describe('validación de teléfonos mexicanos', () => {
  it('acepta exactamente 10 dígitos', () => {
    expect(createGameSessionSchema.parse(validSession).phone).toBe('6241234567');
    expect(playerLookupQuerySchema.parse({ phone: '6241234567' }).phone).toBe(
      '6241234567',
    );
  });

  it.each([
    '624123456',
    '62412345678',
    '+526241234567',
    '624 123 4567',
    '624-123-4567',
    'abcdefghij',
  ])('rechaza el formato incorrecto %s', (phone) => {
    expect(() => createGameSessionSchema.parse({ ...validSession, phone })).toThrow();
    expect(() => playerLookupQuerySchema.parse({ phone })).toThrow();
  });

  it('protege también el registro de membresías', () => {
    expect(() =>
      membershipCheckoutSchema.parse({
        planId: 'daddy-plus',
        phone: '624123456',
        name: 'Miguel',
        avatar: 'DaddyMaster',
      }),
    ).toThrow();
  });
});
