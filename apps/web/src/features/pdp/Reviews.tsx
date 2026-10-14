import type { ProductDetail } from '@jev/contracts';
import { formatDate, stars } from './reviewFormat';

/** Reseñas: promedio y conteo los calcula el servidor. */
export function Reviews({ data }: { data: ProductDetail['reviews'] }) {
  const reviews = data.items;
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
          </section>
  );
}
