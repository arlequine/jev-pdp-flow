import { useState } from 'react';

/** Estimado de envío por código postal (reglas de logística). El umbral se compara contra el precio con IVA. */
export function ShippingEstimator({ priceCents }: { priceCents: number }) {
  const [cp, setCp] = useState('');
  const [shipMsg, setShipMsg] = useState('');

  const calcShipping = () => {
    if (!/^\d{5}$/.test(cp)) return setShipMsg('Escribe un código postal de 5 dígitos.');
    const zona = Number(cp.slice(0, 2));
    const dias = zona <= 16 ? '2 a 3' : (zona >= 44 && zona <= 49) || (zona >= 64 && zona <= 67) ? '3 a 4' : '5 a 8';
    setShipMsg(`${priceCents > 99900 ? 'Envío gratis' : 'Envío $149'} · llega en ${dias} días`);
  };

  return (
          <div className="pdp-shipping">
            <label htmlFor="cp">Calcula tu envío</label>
            <div className="pdp-shipping-row">
              <input id="cp" value={cp} onChange={(e) => setCp(e.target.value)} placeholder="Código postal" inputMode="numeric" />
              <button type="button" onClick={calcShipping}>
                Calcular
              </button>
            </div>
            {shipMsg !== '' && <p aria-live="polite">{shipMsg}</p>}
          </div>
  );
}
