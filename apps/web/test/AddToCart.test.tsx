import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddToCart } from '../src/features/pdp/AddToCart';
import { pickVariant, type VariantView } from '../src/features/pdp/variants';
import seed from '../../api/src/data/seed.json';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AddToCart', () => {
  it('sin stock: deshabilitado y dice "Agotado"', () => {
    render(<AddToCart sku="SUD-ARE-XL" stock={0} quantity={1} />);
    const b = screen.getByRole('button') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.textContent).toBe('Agotado');
  });

  it('con stock: manda solo SKU y cantidad (el servidor calcula el precio)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AddToCart sku="SUD-NEG-M" stock={5} quantity={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    await waitFor(() => expect(screen.getByText('Agregado al carrito')).toBeTruthy());
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ sku: 'SUD-NEG-M', quantity: 2 });
  });
});

describe('combinación sin stock del seed (PDP-142.5)', () => {
  it('Sudadera básica, Arena, XL → botón deshabilitado', () => {
    const p = seed.products.find((x) => x.slug === 'sudadera-basica')!;
    const views: VariantView[] = p.variants.map((v) => ({
      sku: v.sku, color: v.color, size: v.size, stock: v.stock, image: '', price: { amountCents: 1, currency: 'MXN', taxIncluded: true, taxRate: 0.16 },
    }));
    const v = pickVariant(views, 'Arena', 'XL')!;
    expect(v.stock).toBe(0);
    render(<AddToCart sku={v.sku} stock={v.stock} quantity={1} />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
