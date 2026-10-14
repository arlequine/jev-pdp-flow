import { Router } from 'express';
import type { LegacyProduct, LegacyReview, LegacyStock, LegacyVariant } from '@jev/contracts';
import { findById, findBySlug, money, seed } from '../lib/data';

/**
 * Endpoints de la PDP vieja. La PDP los llama en cascada:
 * producto → variantes → stock → reseñas.
 * @deprecated Reemplazados por GET /api/products/:slug (PDP-142.1). No borrar: la PDP "antes" depende de ellos.
 */
export const legacy = Router();

// Marcados como deprecated (PDP-142.1): siguen respondiendo igual, con el sucesor indicado.
legacy.use('/api/legacy', (_req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/products/{slug}>; rel="successor-version"');
  next();
});

legacy.get('/api/legacy/products/:slug', (req, res) => {
  const p = findBySlug(req.params.slug);
  if (!p) return void res.status(404).json({ error: 'not_found' });
  const body: LegacyProduct = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    description: p.description,
    price: p.netPriceCents / 100,
    priceMoney: money(p.netPriceCents),
    images: p.colors.map((c) => c.image),
  };
  res.json(body);
});

legacy.get('/api/legacy/products/:id/variants', (req, res) => {
  const p = findById(Number(req.params.id));
  if (!p) return void res.status(404).json({ error: 'not_found' });
  const body: LegacyVariant[] = p.variants.map((v) => ({
    id: v.id,
    productId: p.id,
    sku: v.sku,
    color: v.color,
    size: v.size,
    image: p.colors.find((c) => c.name === v.color)!.image,
    priceMoney: money(v.netPriceCents ?? p.netPriceCents),
  }));
  res.json(body);
});

legacy.get('/api/legacy/stock', (req, res) => {
  const ids = String(req.query.variantIds ?? '').split(',').filter(Boolean).map(Number);
  const all = seed.products.flatMap((p) => p.variants);
  const body: LegacyStock[] = ids.map((id) => ({ variantId: id, qty: all.find((v) => v.id === id)?.stock ?? 0 }));
  res.json(body);
});

legacy.get('/api/legacy/products/:id/reviews', (req, res) => {
  const p = findById(Number(req.params.id));
  if (!p) return void res.status(404).json({ error: 'not_found' });
  const body: LegacyReview[] = p.reviews;
  res.json(body);
});
