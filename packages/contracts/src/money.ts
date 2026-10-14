import { z } from 'zod';

/**
 * Dinero en la API: centavos enteros, precio final con IVA incluido.
 * El servidor calcula; el cliente solo formatea.
 */
export const Money = z.object({
  amountCents: z.number().int().nonnegative(),
  currency: z.literal('MXN'),
  taxIncluded: z.literal(true),
  taxRate: z.number(),
});
export type Money = z.infer<typeof Money>;
