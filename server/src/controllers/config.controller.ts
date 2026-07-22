import type { Request, Response } from 'express';
import { getPublicConfig } from '../services/config.service.js';

/**
 * Return the public (non-sensitive) game configuration.
 */
export async function getPublicConfiguration(_req: Request, res: Response): Promise<void> {
  const config = await getPublicConfig();
  res.status(200).json({ data: config });
}
