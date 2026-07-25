import type { Request, Response } from 'express';
import {
  membershipCheckoutSchema,
  membershipConfirmSchema,
  membershipStatusQuerySchema,
} from '../validators/membership.validator.js';
import {
  createMembershipCheckout,
  confirmMembershipCheckout,
  getMembershipStatus,
  handleStripeWebhook,
} from '../services/membership.service.js';

export async function getMembershipStatusHandler(req: Request, res: Response): Promise<void> {
  const { phone } = membershipStatusQuerySchema.parse(req.query);
  const membership = await getMembershipStatus(phone);
  res.json({ data: { membership } });
}

export async function createMembershipCheckoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = membershipCheckoutSchema.parse(req.body);
  const checkout = await createMembershipCheckout(input);
  res.status(201).json({ data: checkout });
}

export async function confirmMembershipCheckoutHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { sessionId } = membershipConfirmSchema.parse(req.body);
  const { phone } = membershipStatusQuerySchema.parse({ phone: req.body?.phone });
  const membership = await confirmMembershipCheckout(sessionId, phone);
  res.json({ data: { membership } });
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  await handleStripeWebhook(
    req.body as Buffer,
    req.headers['stripe-signature'],
  );
  res.json({ received: true });
}
