import { useEffect, useState } from 'react';
import type { CatalogItem } from '@jev/contracts';

/** Catálogo mínimo. Fuera del alcance de PDP-142. */
export function Catalog() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((b) => setItems(b.items));
  }, []);
  return (
    <section className="catalog">
      <h1>Catálogo</h1>
      <ul>
        {items.map((p) => (
          <li key={p.slug}>
            <a href={`/product/${p.slug}`}>
              <img src={p.image} alt="" width={240} height={240} />
              <span>{p.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
