import { Router } from 'express';
import { AddToCartRequest, type CartResponse } from '@jev/contracts';
import { findVariantBySku, grossCents } from '../lib/data';

/** Carrito en memoria. Fuera del alcance de PDP-142; existe para que "Agregar al carrito" haga algo. */
export const cart = Router();
const lines = new Map<string, { sku: string; name: string; quantity: number; unitPriceCents: number }>();

const snapshot = (): CartResponse => {
  const ls = [...lines.values()].map((l) => ({ ...l, lineTotalCents: l.unitPriceCents * l.quantity }));
  return { lines: ls, totalCents: ls.reduce((n, l) => n + l.lineTotalCents, 0), currency: 'MXN', taxIncluded: true };
};

cart.get('/api/cart', (_req, res) => res.json(snapshot()));

cart.post('/api/cart', (req, res) => {
  const parsed = AddToCartRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'bad_request' });
  const found = findVariantBySku(parsed.data.sku);
  if (!found) return void res.status(404).json({ error: 'not_found' });
  const { product, variant } = found;
  // Sin stock no entra al carrito (PDP-142.5): antes el pedido fallaba después, en el almacén.
  if (variant.stock <= 0) return void res.status(409).json({ error: 'out_of_stock', sku: variant.sku });
  // El precio SIEMPRE lo calcula el servidor: con IVA, en centavos.
  const unitPriceCents = grossCents(variant.netPriceCents ?? product.netPriceCents);
  const prev = lines.get(variant.sku);
  lines.set(variant.sku, {
    sku: variant.sku,
    name: `${product.name} · ${variant.color} · ${variant.size}`,
    quantity: (prev?.quantity ?? 0) + parsed.data.quantity,
    unitPriceCents,
  });
  res.status(201).json(snapshot());
});

cart.delete('/api/cart', (_req, res) => {
  lines.clear();
  res.json(snapshot());
});
