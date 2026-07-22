import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  adminCredentialsMatch,
  endAdminSession,
  hasAdminSession,
  startAdminSession,
} from '../middleware/adminAuth.js';
import { AppError } from '../utils/AppError.js';
import { readAdminGameConfig, saveAdminGameConfig } from '../services/adminConfig.service.js';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

const tierSchema = z.object({
  levelName: z.string().trim().min(1).max(40),
  minScore: z.number().int().min(0).max(10_000_000),
  maxScore: z.number().int().min(0).max(10_000_000).nullable(),
  label: z.string().trim().min(3).max(120),
  rewardType: z.enum(['NONE', 'DISCOUNT', 'SPECIAL']),
  discountPercentage: z.number().int().min(1).max(100).nullable(),
});

const configSchema = z
  .object({
    businessPhone: z.string().trim().regex(/^\d{10,15}$/u, 'Usa sólo números, incluyendo lada.'),
    rewardExpiryHours: z.number().int().min(1).max(2160),
    difficultyLevel: z.number().int().min(0).max(10),
    bossArrivalSeconds: z.number().int().min(30).max(600),
    tiers: z.array(tierSchema).min(1).max(12),
  })
  .superRefine((value, ctx) => {
    const tiers = [...value.tiers].sort((a, b) => a.minScore - b.minScore);
    tiers.forEach((tier, index) => {
      if (tier.maxScore !== null && tier.maxScore < tier.minScore) {
        ctx.addIssue({ code: 'custom', path: ['tiers', index, 'maxScore'], message: 'El máximo debe ser mayor al mínimo.' });
      }
      if (tier.rewardType === 'DISCOUNT' && tier.discountPercentage === null) {
        ctx.addIssue({ code: 'custom', path: ['tiers', index, 'discountPercentage'], message: 'Indica el porcentaje.' });
      }
      const next = tiers[index + 1];
      if (next && (tier.maxScore === null || tier.maxScore >= next.minScore)) {
        ctx.addIssue({ code: 'custom', path: ['tiers', index], message: 'Los rangos de puntos no deben cruzarse.' });
      }
    });
  });

export async function loginAdmin(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  if (!adminCredentialsMatch(input.username, input.password)) {
    throw AppError.unauthorized('Usuario o contraseña incorrectos.');
  }
  startAdminSession(res);
  res.status(200).json({ data: { authenticated: true } });
}

export async function logoutAdmin(_req: Request, res: Response): Promise<void> {
  endAdminSession(res);
  res.status(200).json({ data: { authenticated: false } });
}

export async function getAdminSession(req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: { authenticated: hasAdminSession(req) } });
}

export async function getAdminConfiguration(_req: Request, res: Response): Promise<void> {
  const config = await readAdminGameConfig();
  res.status(200).json({ data: config });
}

export async function updateAdminConfiguration(req: Request, res: Response): Promise<void> {
  const input = configSchema.parse(req.body);
  const config = await saveAdminGameConfig(input);
  res.status(200).json({ data: config });
}
