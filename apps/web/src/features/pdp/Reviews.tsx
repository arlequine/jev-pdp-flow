import { useState } from 'react';
import type { ProductDetail, ReviewItem, ReviewsPage } from '@jev/contracts';
import { formatDate, stars } from './reviewFormat';

/** Reseñas: más recientes primero, de 5 en 5 con "Ver más". Promedio y conteo los calcula el servidor. */
export function Reviews({ slug, data }: { slug: string; data: ProductDetail['reviews'] }) {
  const [reviews, setReviews] = useState<ReviewItem[]>(data.items);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const hasMore = reviews.length < data.count;

  const loadMore = async () => {
    setStatus('loading');
    try {
      const r = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews?page=${page + 1}`);
      if (!r.ok) throw new Error(String(r.status));
      const next = (await r.json()) as ReviewsPage;
      setReviews((prev) => [...prev, ...next.items]);
      setPage(next.page);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  return (
          <section className="pdp-reviews" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="pdp-h2">
              Reseñas ({data.count})
            </h2>
            {reviews.map((r) => (
              <article key={r.id} className="pdp-review">
                <p className="pdp-review-head">
                  <span aria-label={`${r.rating} de 5 estrellas`}>{stars(r.rating)}</span> · {r.author} · {formatDate(r.createdAt)}
                </p>
                <p className="pdp-review-text">{r.text}</p>
              </article>
            ))}
            {status === 'error' && (
              <p className="pdp-error" role="alert">
                No pudimos cargar más reseñas.
              </p>
            )}
            {hasMore && (
              <button type="button" className="pdp-link" onClick={loadMore} disabled={status === 'loading'}>
                {status === 'loading' ? 'Cargando…' : status === 'error' ? 'Reintentar' : `Ver más (${data.count - reviews.length})`}
              </button>
            )}
          </section>
  );
}
