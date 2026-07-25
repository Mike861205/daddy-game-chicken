import { z } from 'zod';

export const membershipStatusQuerySchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/, 'El telefono solo puede contener numeros y un signo + inicial.'),
});

export const membershipCheckoutSchema = z.object({
  planId: z.enum(['daddy-plus', 'daddy-elite']),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/, 'El telefono solo puede contener numeros y un signo + inicial.'),
  name: z.string().trim().min(2).max(100),
  avatar: z.string().trim().min(1).max(20),
});

export const membershipConfirmSchema = z.object({
  sessionId: z.string().trim().min(10).max(300),
});

export type MembershipCheckoutInput = z.infer<typeof membershipCheckoutSchema>;
