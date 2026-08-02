import { z } from 'zod';
import { mexicanPhoneSchema } from './phone.validator.js';

export const membershipStatusQuerySchema = z.object({
  phone: mexicanPhoneSchema,
});

export const membershipCheckoutSchema = z.object({
  planId: z.enum(['daddy-plus', 'daddy-elite']),
  phone: mexicanPhoneSchema,
  name: z.string().trim().min(2).max(100),
  avatar: z.string().trim().min(1).max(20),
});

export const membershipConfirmSchema = z.object({
  sessionId: z.string().trim().min(10).max(300),
});

export const membershipBenefitClaimSchema = membershipStatusQuerySchema;

export type MembershipCheckoutInput = z.infer<typeof membershipCheckoutSchema>;
