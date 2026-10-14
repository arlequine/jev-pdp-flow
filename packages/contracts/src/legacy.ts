import { z } from 'zod';
import { Money } from './money';

/**
 * Contratos de los endpoints legacy de la PDP.
 * @deprecated Se mantienen para que la PDP "antes" siga funcionando contra la misma API.
 */
export const LegacyProduct = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  description: z.string(),
  /** Precio sin IVA, en pesos, como número flotante (así lo devolvía el sistema viejo). */
  price: z.number(),
  /** Precio final con IVA, calculado en el servidor (PDP-142.4). Campo nuevo; `price` se conserva. */
  priceMoney: Money,
  images: z.array(z.string()),
});
export type LegacyProduct = z.infer<typeof LegacyProduct>;

export const LegacyVariant = z.object({
  id: z.number(),
  productId: z.number(),
  sku: z.string(),
  color: z.string(),
  size: z.string(),
  image: z.string(),
  /** Precio final de la variante, con IVA (PDP-142.5). Campo nuevo. */
  priceMoney: Money,
});
export type LegacyVariant = z.infer<typeof LegacyVariant>;

export const LegacyStock = z.object({ variantId: z.number(), qty: z.number() });
export type LegacyStock = z.infer<typeof LegacyStock>;

export const LegacyReview = z.object({
  id: z.number(),
  author: z.string(),
  rating: z.number(),
  text: z.string(),
  createdAt: z.string(),
});
export type LegacyReview = z.infer<typeof LegacyReview>;
