import type { Request, Response } from 'express';
import {
  createRewardSchema,
  validateRewardSchema,
} from '../validators/gameSession.validator.js';
import {
  createRewardForSession,
  validateRewardCode,
} from '../services/reward.service.js';

/**
 * POST /api/rewards - evaluate a session and generate a reward if applicable.
 */
export async function createReward(req: Request, res: Response): Promise<void> {
  const input = createRewardSchema.parse(req.body);
  const result = await createRewardForSession(input.clientSessionId);
  res.status(201).json({ data: result });
}

/**
 * POST /api/rewards/validate - validate a reward code without redeeming it.
 */
export async function validateReward(req: Request, res: Response): Promise<void> {
  const input = validateRewardSchema.parse(req.body);
  const result = await validateRewardCode(input.code);
  res.status(200).json({ data: result });
}
