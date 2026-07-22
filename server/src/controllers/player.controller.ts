import type { Request, Response } from 'express';
import { playerLookupQuerySchema } from '../validators/gameSession.validator.js';
import { findPlayerByPhone } from '../services/player.service.js';

/**
 * GET /api/players/lookup?phone=... - find a returning player by phone.
 * Responds with the stored name and avatar (nickname) so the client can
 * skip registration. Returns 404 when the phone is not registered.
 */
export async function lookupPlayer(req: Request, res: Response): Promise<void> {
  const { phone } = playerLookupQuerySchema.parse(req.query);
  const player = await findPlayerByPhone(phone);

  if (!player) {
    res.status(404).json({ error: { message: 'No encontramos ese número. Regístrate para jugar.' } });
    return;
  }

  res.status(200).json({
    data: {
      name: player.name,
      avatar: player.nickname,
      phone: player.phone,
    },
  });
}
