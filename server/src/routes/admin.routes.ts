import { Router } from 'express';

/**
 * Placeholder admin router. Prepared for future authenticated admin features
 * (e.g. reward redemption, configuration editing). Intentionally minimal.
 */
const router = Router();

router.get('/ping', (_req, res) => {
  res.status(200).json({ data: { area: 'admin', status: 'reserved' } });
});

export default router;
