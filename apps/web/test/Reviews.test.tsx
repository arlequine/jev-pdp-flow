import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import request from 'supertest';
import { ProductDetail } from '@jev/contracts';
import { createApp } from '../../api/src/app';
import { seed } from '../../api/src/lib/data';
import { Reviews } from '../src/features/pdp/Reviews';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const api = createApp({ latencyMs: 0 });

describe('Reviews (PDP-142.9)', () => {
  it('"Ver más" agrega la siguiente página de 5', async () => {
    const busy = seed.products.reduce((a, b) => (b.reviews.length > a.reviews.length ? b : a));
    const d = ProductDetail.parse((await request(api).get(`/api/products/${busy.slug}`)).body);
    vi.stubGlobal('fetch', vi.fn(async (u: string) => new Response(JSON.stringify((await request(api).get(u)).body))));
    render(<Reviews slug={busy.slug} data={d.reviews} />);
    expect(screen.getAllByRole('article')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /Ver más/ }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(Math.min(10, d.reviews.count)));
  });
});
