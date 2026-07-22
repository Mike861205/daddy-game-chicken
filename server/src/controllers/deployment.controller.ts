import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDeploymentStatus, startDeployment } from '../services/deployment.service.js';

const deploymentSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((value) => [...value].every((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })),
});

export async function getDeploymentStatusHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: getDeploymentStatus() });
}

export async function startDeploymentHandler(req: Request, res: Response): Promise<void> {
  const input = deploymentSchema.parse(req.body);
  res.status(202).json({ data: startDeployment(input.message) });
}
