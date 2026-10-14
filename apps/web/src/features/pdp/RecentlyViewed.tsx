import { useEffect, useState } from 'react';
import { readList, writeList } from './localLists';

export function RecentlyViewed({ slug }: { slug: string }) {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    const r = readList('recent');
    setRecent(r.filter((x) => x !== slug).slice(0, 4));
    writeList('recent', [slug, ...r.filter((x) => x !== slug)].slice(0, 8));
  }, [slug]);
  if (!recent.length) return null;
  return (
        <section className="pdp-section" aria-labelledby="recent-title">
          <h2 id="recent-title" className="pdp-h2">
            Vistos recientemente
          </h2>
          <ul className="pdp-recent">
            {recent.map((r) => (
              <li key={r}>
                <a href={'/product/' + r}>
                  <img src={'/img/' + r + '-negro.svg'} alt="" width={120} height={120} />
                  {r.replace(/-/g, ' ')}
                </a>
              </li>
            ))}
          </ul>
        </section>
  );
}
