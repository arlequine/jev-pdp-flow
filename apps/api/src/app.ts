import express from 'express';
import { latency } from './lib/latency';
import { catalog } from './routes/catalog';
import { legacy } from './routes/legacy';
import { cart } from './routes/cart';
import { products } from './routes/products';

export function createApp(opts: { latencyMs?: number } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api', latency(opts.latencyMs));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(catalog);
  app.use(products);
  app.use(legacy);
  app.use(cart);
  return app;
}
