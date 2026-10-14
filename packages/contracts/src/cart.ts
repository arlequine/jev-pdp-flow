import { z } from 'zod';

/** POST /api/cart — el cliente manda qué y cuánto; el servidor calcula los montos. */
export const AddToCartRequest = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
});
export type AddToCartRequest = z.infer<typeof AddToCartRequest>;

export const CartLine = z.object({
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  lineTotalCents: z.number().int(),
});

export const CartResponse = z.object({
  lines: z.array(CartLine),
  totalCents: z.number().int(),
  currency: z.literal('MXN'),
  taxIncluded: z.literal(true),
});
export type CartResponse = z.infer<typeof CartResponse>;
