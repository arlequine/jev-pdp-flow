import { describe, expect, it } from 'vitest';
import { formatMXN } from '../src/pricing/format';

describe('formatMXN', () => {
  it('formatea centavos con separador de miles y dos decimales', () => {
    expect(formatMXN(150742)).toBe('$1,507.42');
    expect(formatMXN(129950)).toBe('$1,299.50');
    expect(formatMXN(5)).toBe('$0.05');
  });
});
