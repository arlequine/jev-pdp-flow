import { z } from 'zod';
import { Money } from './money';

/** Contrato de GET /api/products/:slug (PDP-142.1). Lo usan la API y la web. */
export const ProductColor = z.object({ name: z.string(), hex: z.string(), image: z.string() });

export const ProductVariant = z.object({
  sku: z.string(),
  color: z.string(),
  size: z.string(),
  stock: z.number().int().nonnegative(),
  price: Money,
});
export type ProductVariant = z.infer<typeof ProductVariant>;

export const ReviewItem = z.object({
  id: z.number(),
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  createdAt: z.string(),
});
export type ReviewItem = z.infer<typeof ReviewItem>;

export const ProductReviews = z.object({
  /** Promedio calculado en el servidor, con un decimal. */
  average: z.number(),
  count: z.number().int().nonnegative(),
  /** Primeras 5. */
  items: z.array(ReviewItem).max(5),
});

export const ProductDetail = z.object({
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  description: z.string(),
  /** Precio base con IVA; cada variante trae el suyo. */
  price: Money,
  colors: z.array(ProductColor).min(1),
  sizes: z.array(z.string()).min(1),
  variants: z.array(ProductVariant).min(1),
  reviews: ProductReviews,
});
export type ProductDetail = z.infer<typeof ProductDetail>;
