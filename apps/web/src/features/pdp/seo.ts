import { useEffect } from 'react';
import type { ProductDetail } from '@jev/contracts';

/** Datos estructurados schema.org/Product para la PDP. Precio y moneda tal como los da el servidor. */
export function productJsonLd(p: ProductDetail, origin: string) {
  const inStock = p.variants.some((v) => v.stock > 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    brand: { '@type': 'Brand', name: p.brand },
    description: p.description.replace(/\s+/g, ' ').trim(),
    image: p.colors.map((c) => origin + c.image),
    offers: {
      '@type': 'Offer',
      url: `${origin}/product/${p.slug}`,
      priceCurrency: p.price.currency,
      price: (p.price.amountCents / 100).toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(p.reviews.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.reviews.average, reviewCount: p.reviews.count } }
      : {}),
  };
}

export const metaDescription = (p: ProductDetail) => {
  const text = `${p.name} de ${p.brand}. ${p.description.split('\n\n')[0]}`;
  return text.length > 155 ? `${text.slice(0, 154).trimEnd()}…` : text;
};

/** <title>, meta description y JSON-LD por producto (PDP-142.8). */
export function useProductSeo(p: ProductDetail) {
  useEffect(() => {
    document.title = `${p.name} · ${p.brand} | Tienda Norte`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = metaDescription(p);
    let script = document.getElementById('pdp-jsonld');
    if (!script) {
      script = document.createElement('script');
      script.id = 'pdp-jsonld';
      script.setAttribute('type', 'application/ld+json');
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(productJsonLd(p, window.location.origin));
    return () => {
      document.getElementById('pdp-jsonld')?.remove();
    };
  }, [p]);
}
