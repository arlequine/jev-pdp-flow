import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { ProductDetail } from '@jev/contracts';
import { createApp } from '../src/app';
import { seed } from '../src/lib/data';

const app = createApp({ latencyMs: 0 });

describe('contrato: GET /api/products/:slug', () => {
  it.each(seed.products.map((p) => p.slug))('%s cumple el contrato', async (slug) => {
    const r = await request(app).get(`/api/products/${slug}`).expect(200);
    const d = ProductDetail.parse(r.body);
    expect(d.reviews.items.length).toBeLessThanOrEqual(5);
    expect(d.variants.every((v) => v.price.taxIncluded && v.price.currency === 'MXN')).toBe(true);
  });

  it('trae en una sola respuesta lo que antes eran 4 requests', async () => {
    const d = ProductDetail.parse((await request(app).get('/api/products/sudadera-basica').expect(200)).body);
    expect(d.price.amountCents).toBe(150742);
    expect(d.variants.find((v) => v.sku === 'SUD-ARE-XL')).toMatchObject({ stock: 0 });
    expect(d.reviews.count).toBeGreaterThan(0);
  });

  it('404 si no existe', () => request(app).get('/api/products/no-existe').expect(404));

  it('los endpoints legacy siguen respondiendo, marcados como deprecated', async () => {
    const r = await request(app).get('/api/legacy/products/sudadera-basica').expect(200);
    expect(r.headers.deprecation).toBe('true');
    const cart = await request(app).get('/api/cart').expect(200);
    expect(cart.headers.deprecation).toBeUndefined();
  });
});
