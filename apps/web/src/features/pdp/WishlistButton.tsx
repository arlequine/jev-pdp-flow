import { useState } from 'react';
import { readList, writeList } from './localLists';

export function WishlistButton({ slug }: { slug: string }) {
  const [wish, setWish] = useState(() => readList('wishlist').includes(slug));
  const toggleWish = () => {
    const w = readList('wishlist');
    writeList('wishlist', wish ? w.filter((x) => x !== slug) : [...w, slug]);
    setWish(!wish);
  };
  return (
          <button type="button" className="pdp-link" aria-pressed={wish} onClick={toggleWish}>
            {wish ? '♥ En tus favoritos' : '♡ Agregar a favoritos'}
          </button>
  );
}
