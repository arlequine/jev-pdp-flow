import { useEffect, useState } from 'react';
import type { ProductDetail } from '@jev/contracts';

export type ProductState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: ProductDetail };

/**
 * Carga la PDP con UNA request (GET /api/products/:slug) y expone carga, error y reintento.
 * Reemplaza la cascada producto → variantes → stock → reseñas.
 */
export function useProduct(slug: string): ProductState & { retry: () => void } {
  const [state, setState] = useState<ProductState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetch(`/api/products/${encodeURIComponent(slug)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) throw new Error('No encontramos este producto.');
        if (!r.ok) throw new Error('No pudimos cargar el producto.');
        return (await r.json()) as ProductDetail;
      })
      .then((data) => setState({ status: 'ready', data }))
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', error: e.message || 'No pudimos cargar el producto.' });
      });
    return () => ctrl.abort();
  }, [slug, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
