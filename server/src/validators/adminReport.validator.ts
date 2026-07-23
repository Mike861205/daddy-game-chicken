import { z } from 'zod';

export const adminPlayerReportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().trim().max(80).default(''),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    sortBy: z
      .enum([
        'createdAt',
        'nickname',
        'name',
        'phone',
        'gameCount',
        'totalDurationSeconds',
        'bestScore',
        'rewardCount',
        'lastPlayedAt',
      ])
      .default('lastPlayedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((value, ctx) => {
    if ((value.from && !value.to) || (!value.from && value.to)) {
      ctx.addIssue({
        code: 'custom',
        message: 'El rango requiere fecha inicial y final.',
      });
      return;
    }
    if (value.from && value.to && new Date(value.from) >= new Date(value.to)) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'La fecha final debe ser posterior a la inicial.',
      });
    }
  });

export type AdminPlayerReportQuery = z.infer<typeof adminPlayerReportQuerySchema>;
