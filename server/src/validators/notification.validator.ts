import { z } from 'zod';
import { mexicanPhoneSchema } from './phone.validator.js';

const subscriptionKeysSchema = z.object({
  p256dh: z.string().min(20).max(500),
  auth: z.string().min(8).max(500),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: subscriptionKeysSchema,
  phone: mexicanPhoneSchema.optional(),
  installed: z.boolean().default(false),
});

export const notificationCampaignSchema = z.object({
  title: z.string().trim().min(3).max(60),
  message: z.string().trim().min(3).max(180),
  targetUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/(?!\/)/u, 'El destino debe ser una ruta interna del juego.')
    .default('/'),
  kind: z.enum(['REMINDER', 'PROMOTION']),
  audience: z.enum(['ALL', 'INSTALLED', 'BROWSER']),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type NotificationCampaignInput = z.infer<typeof notificationCampaignSchema>;
