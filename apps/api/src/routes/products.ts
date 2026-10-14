import { Router } from 'express';
import { REVIEWS_PAGE_SIZE, type ProductDetail, type ReviewsPage } from '@jev/contracts';
import { findBySlug, money, type SeedProduct } from '../lib/data';

/** GET /api/products/:slug — todo lo que necesita la PDP en una sola respuesta (PDP-142.1). */
export const products = Router();

/** Más recientes primero. */
const newestFirst = (p: SeedProduct) => [...p.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
      items: newestFirst(p).slice(0, REVIEWS_PAGE_SIZE),
    },
  };
}

products.get('/api/products/:slug', (req, res) => {
  const p = findBySlug(req.params.slug);
  if (!p) return void res.status(404).json({ error: 'not_found' });
  res.json(toDetail(p));
});

products.get('/api/products/:slug/reviews', (req, res) => {
  const p = findBySlug(req.params.slug);
  if (!p) return void res.status(404).json({ error: 'not_found' });
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const all = newestFirst(p);
  const start = (page - 1) * REVIEWS_PAGE_SIZE;
  const body: ReviewsPage = {
    items: all.slice(start, start + REVIEWS_PAGE_SIZE),
    page,
    pageSize: REVIEWS_PAGE_SIZE,
    total: all.length,
    hasMore: start + REVIEWS_PAGE_SIZE < all.length,
  };
  res.json(body);
});
