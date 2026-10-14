import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceBlock } from '../src/features/pdp/PriceBlock';

describe('PriceBlock', () => {
  it('muestra el precio con IVA, la moneda y la leyenda de IVA', () => {
    render(<PriceBlock price={{ amountCents: 150742, currency: 'MXN', taxIncluded: true, taxRate: 0.16 }} />);
    expect(screen.getByTestId('price').textContent).toBe('$1,507.42 MXN');
    expect(screen.getByText('IVA incluido')).toBeTruthy();
  });

  it('nunca muestra el formato viejo ($1299.5)', () => {
    render(<PriceBlock price={{ amountCents: 150742, currency: 'MXN', taxIncluded: true, taxRate: 0.16 }} />);
    expect(screen.queryByText(/\$1299\.5\b/)).toBeNull();
  });
});
