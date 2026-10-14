import type { Money } from '@jev/contracts';

/** Variante tal como la usa la PDP: con su stock, su precio final y su imagen. */
export interface VariantView {
  sku: string;
  color: string;
  size: string;
  stock: number;
  price: Money;
  image: string;
}

export const pickVariant = (variants: VariantView[], color: string | null, size: string | null) =>
  variants.find((v) => v.color === color && v.size === size);

export const stockFor = (variants: VariantView[], color: string, size: string) => pickVariant(variants, color, size)?.stock ?? 0;

/** Variantes del contrato de la PDP con la imagen de su color. */
export const toViews = (p: { colors: { name: string; image: string }[]; variants: Omit<VariantView, 'image'>[] }): VariantView[] =>
  p.variants.map((v) => ({ ...v, image: p.colors.find((c) => c.name === v.color)?.image ?? p.colors[0].image }));
