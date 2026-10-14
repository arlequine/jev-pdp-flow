import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SeedVariant { id: number; sku: string; color: string; size: string; stock: number; netPriceCents?: number }
export interface SeedReview { id: number; author: string; rating: number; text: string; createdAt: string }
export interface SeedColor { name: string; hex: string; image: string }
export interface SeedProduct {
  id: number; slug: string; name: string; brand: string; category: string; description: string;
  netPriceCents: number; colors: SeedColor[]; sizes: string[]; variants: SeedVariant[]; reviews: SeedReview[];
}
export interface Seed { taxRate: number; currency: 'MXN'; products: SeedProduct[] }

const here = dirname(fileURLToPath(import.meta.url));
export const seed: Seed = JSON.parse(readFileSync(join(here, '../data/seed.json'), 'utf8'));

export const findBySlug = (slug: string) => seed.products.find((p) => p.slug === slug);
export const findById = (id: number) => seed.products.find((p) => p.id === id);
export const findVariantBySku = (sku: string) => {
  for (const p of seed.products) {
    const v = p.variants.find((x) => x.sku === sku);
    if (v) return { product: p, variant: v };
  }
  return undefined;
};

/** Precio con IVA en centavos. Aritmética entera; se redondea una sola vez. */
export const grossCents = (netCents: number) => Math.round((netCents * (100 + seed.taxRate * 100)) / 100);

/** Precio final para el cliente: con IVA, en centavos, con la tasa explícita. */
export const money = (netCents: number) => ({
  amountCents: grossCents(netCents),
  currency: 'MXN' as const,
  taxIncluded: true as const,
  taxRate: seed.taxRate,
});
