import { Router } from 'express';
import type { ProductDetail } from '@jev/contracts';
import { findBySlug, money, type SeedProduct } from '../lib/data';

/** GET /api/products/:slug — todo lo que necesita la PDP en una sola respuesta (PDP-142.1). */
export const products = Router();

export function toDetail(p: SeedProduct): ProductDetail {
  const sum = p.reviews.reduce((n, r) => n + r.rating, 0);
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    description: p.description,
    price: money(p.netPriceCents),
    colors: p.colors,
    sizes: p.sizes,
    variants: p.variants.map((v) => ({
      sku: v.sku,
      color: v.color,
      size: v.size,
      stock: v.stock,
      price: money(v.netPriceCents ?? p.netPriceCents),
    })),
    reviews: {
      average: p.reviews.length ? Math.round((sum / p.reviews.length) * 10) / 10 : 0,
      count: p.reviews.length,
      items: p.reviews.slice(0, 5),
    },
  };
}

products.get('/api/products/:slug', (req, res) => {
  const p = findBySlug(req.params.slug);
  if (!p) return void res.status(404).json({ error: 'not_found' });
  res.json(toDetail(p));
});
