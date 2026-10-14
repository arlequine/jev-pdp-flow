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
