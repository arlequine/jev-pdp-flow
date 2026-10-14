import { describe, expect, it } from 'vitest';
import { grossCents, money } from '../src/lib/data';

describe('precio con IVA en el servidor', () => {
  it('redondea una sola vez, en centavos', () => {
    expect(grossCents(129950)).toBe(150742); // 1299.50 × 1.16 = 1507.42
    expect(grossCents(34900)).toBe(40484);
    expect(money(129950)).toEqual({ amountCents: 150742, currency: 'MXN', taxIncluded: true, taxRate: 0.16 });
  });
});
