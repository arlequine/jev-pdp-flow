import { Router } from 'express';
import type { CatalogResponse } from '@jev/contracts';
import { seed } from '../lib/data';

export const catalog = Router();

catalog.get('/api/products', (_req, res) => {
  const body: CatalogResponse = {
    items: seed.products.map((p) => ({ slug: p.slug, name: p.name, category: p.category, image: p.colors[0].image })),
  };
  res.json(body);
});
