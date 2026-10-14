import { useEffect, useState } from 'react';

const END = new Date('2026-11-20T23:59:59-06:00').getTime();

/** Cuenta regresiva de la promo. La fecha la define marketing. */
export function PromoBanner() {
  const [promoLeft, setPromoLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = END - Date.now();
      if (diff <= 0) return setPromoLeft('');
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setPromoLeft(`${d}d ${h}h ${m}m`);
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  if (!promoLeft) return null;
  return <p className="pdp-promo">Buen Fin anticipado · termina en {promoLeft}</p>;
}
