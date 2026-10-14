import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp({ latencyMs: 0 });

describe('POST /api/cart', () => {
  it('rechaza con 409 una variante sin stock', async () => {
    const r = await request(app).post('/api/cart').send({ sku: 'SUD-ARE-XL', quantity: 1 }).expect(409);
    expect(r.body.error).toBe('out_of_stock');
  });

  it('calcula el precio en el servidor e ignora montos que mande el cliente', async () => {
    await request(app).delete('/api/cart');
    const r = await request(app).post('/api/cart').send({ sku: 'SUD-NEG-M', quantity: 2, totalCents: 1 }).expect(201);
    expect(r.body.totalCents).toBe(150742 * 2);
  });
});
