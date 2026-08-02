import type { Request, Response } from 'express';
import {
  getNotificationSummary,
  getPushPublicConfiguration,
  savePushSubscription,
  sendNotificationCampaign,
} from '../services/notification.service.js';
import {
  notificationCampaignSchema,
  pushSubscriptionSchema,
} from '../validators/notification.validator.js';

export async function getPushPublicKeyHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json({ data: await getPushPublicConfiguration() });
}

export async function savePushSubscriptionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = pushSubscriptionSchema.parse(req.body);
  const subscription = await savePushSubscription(input, req.get('user-agent'));
  res.status(201).json({ data: subscription });
}

export async function getNotificationSummaryHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json({ data: await getNotificationSummary() });
}

export async function sendNotificationCampaignHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = notificationCampaignSchema.parse(req.body);
  const result = await sendNotificationCampaign(input);
  res.status(201).json({ data: result });
}
