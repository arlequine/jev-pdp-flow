import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import request from 'supertest';
import ProductPage from '../src/pages/ProductPage';
import { createApp } from '../../api/src/app';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** fetch del navegador servido por la API real (sin red, sin latencia). */
const api = createApp({ latencyMs: 0 });
const realFetch = async (url: string) => {
  const r = await request(api).get(url);
  return new Response(JSON.stringify(r.body), { status: r.status });
};

describe('ProductPage (PDP-142.2)', () => {
  it('carga la PDP con UNA request al endpoint agregado', async () => {
    const f = vi.fn(realFetch);
    vi.stubGlobal('fetch', f);
    render(<ProductPage slug="sudadera-basica" />);
    expect(screen.getByRole('status').textContent).toMatch(/Cargando/);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sudadera básica'));
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/api/products/sudadera-basica']);
    expect(screen.getByTestId('price').textContent).toBe('$1,507.42 MXN');
  });

  it('muestra error con "Reintentar" y vuelve a intentar', async () => {
    let fail = true;
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (fail ? new Response('{}', { status: 500 }) : realFetch(u))));
    render(<ProductPage slug="sudadera-basica" />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No pudimos cargar/));
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
  });

  it('al elegir Arena + XL cambia la imagen y el botón dice "Agotado"', async () => {
    vi.stubGlobal('fetch', vi.fn(realFetch));
    render(<ProductPage slug="sudadera-basica" />);
    await waitFor(() => screen.getByRole('heading', { level: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Arena' }));
    fireEvent.click(screen.getByRole('button', { name: 'XL, agotada' }));
    expect((screen.getByRole('img', { name: /Sudadera básica en color Arena/ }) as HTMLImageElement).src).toContain('arena');
    expect((screen.getByRole('button', { name: 'Agotado' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
