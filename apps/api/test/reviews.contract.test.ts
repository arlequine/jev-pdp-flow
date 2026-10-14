import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { ProductDetail, ReviewsPage } from '@jev/contracts';
import { createApp } from '../src/app';
import { seed } from '../src/lib/data';

const app = createApp({ latencyMs: 0 });
const busy = seed.products.reduce((a, b) => (b.reviews.length > a.reviews.length ? b : a));

describe('contrato: reseñas (PDP-142.9)', () => {
  it('la PDP trae las 5 más recientes, en orden descendente', async () => {
    const d = ProductDetail.parse((await request(app).get(`/api/products/${busy.slug}`)).body);
    const dates = d.reviews.items.map((r) => r.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(d.reviews.items).toHaveLength(5);
  });

  it('pagina de 5 en 5 sin repetir y sin perder reseñas', async () => {
    const seen: number[] = [];
    for (let page = 1; ; page++) {
      const p = ReviewsPage.parse((await request(app).get(`/api/products/${busy.slug}/reviews?page=${page}`)).body);
      seen.push(...p.items.map((r) => r.id));
      if (!p.hasMore) break;
    }
    expect(new Set(seen).size).toBe(busy.reviews.length);
  });
});
