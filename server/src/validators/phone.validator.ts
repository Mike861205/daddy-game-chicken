import { z } from 'zod';

export const mexicanPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^\d{10}$/u,
    'Registra tu número correcto: debe tener exactamente 10 dígitos.',
  );
