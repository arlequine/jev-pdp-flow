import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { CatalogResponse, LegacyProduct, LegacyReview, LegacyStock, LegacyVariant } from '@jev/contracts';
import { createApp } from '../src/app';

const app = createApp({ latencyMs: 0 });

describe('contrato: endpoints legacy (la PDP "antes" depende de ellos)', () => {
  it('GET /api/products', async () => {
    const r = await request(app).get('/api/products').expect(200);
    expect(CatalogResponse.parse(r.body).items).toHaveLength(12);
  });

  it('cascada producto → variantes → stock → reseñas', async () => {
    const p = LegacyProduct.parse((await request(app).get('/api/legacy/products/sudadera-basica').expect(200)).body);
    const vs = z.array(LegacyVariant).parse((await request(app).get(`/api/legacy/products/${p.id}/variants`).expect(200)).body);
    const st = z.array(LegacyStock).parse(
      (await request(app).get(`/api/legacy/stock?variantIds=${vs.map((v) => v.id).join(',')}`).expect(200)).body,
    );
    z.array(LegacyReview).parse((await request(app).get(`/api/legacy/products/${p.id}/reviews`).expect(200)).body);
    expect(st).toHaveLength(vs.length);
  });

  it('404 para un slug que no existe', async () => {
    await request(app).get('/api/legacy/products/no-existe').expect(404);
  });
});
