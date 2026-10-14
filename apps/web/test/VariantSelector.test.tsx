import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VariantSelector } from '../src/features/pdp/VariantSelector';
import type { VariantView } from '../src/features/pdp/variants';

afterEach(cleanup);
const price = { amountCents: 1, currency: 'MXN' as const, taxIncluded: true as const, taxRate: 0.16 };
const variants: VariantView[] = [
  { sku: 'A-M', color: 'Arena', size: 'M', stock: 4, price, image: '/a.svg' },
  { sku: 'A-XL', color: 'Arena', size: 'XL', stock: 0, price, image: '/a.svg' },
];

describe('VariantSelector', () => {
  it('avisa el cambio de talla y de color', () => {
    const onSize = vi.fn();
    const onColor = vi.fn();
    render(
      <VariantSelector colors={[{ name: 'Arena', hex: '#d8c3a5' }, { name: 'Negro', hex: '#111' }]} sizes={['M', 'XL']} variants={variants} color="Arena" size="M" onColor={onColor} onSize={onSize} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'XL, agotada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Negro' }));
    expect(onSize).toHaveBeenCalledWith('XL');
    expect(onColor).toHaveBeenCalledWith('Negro');
  });

  it('marca como agotada la talla sin stock en el color elegido', () => {
    render(<VariantSelector colors={[{ name: 'Arena', hex: '#d8c3a5' }]} sizes={['M', 'XL']} variants={variants} color="Arena" size="M" onColor={() => {}} onSize={() => {}} />);
    expect(screen.getByRole('button', { name: 'XL, agotada' }).className).toContain('is-soldout');
    expect(screen.getByRole('button', { name: 'M' }).className).not.toContain('is-soldout');
  });
});
