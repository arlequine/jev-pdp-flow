import { useState } from 'react';
import { ProductDescription } from './ProductDescription';

const TABS: [string, string][] = [
  ['desc', 'Descripción'],
  ['envio', 'Envío'],
  ['dev', 'Devoluciones'],
];

/** Pestañas de descripción, envío y devoluciones (patrón tablist accesible). */
export function DetailsTabs({ description }: { description: string }) {
  const [tab, setTab] = useState('desc');
  const product = { description };
  return (
    <>
          <div className="pdp-tabs" role="tablist" aria-label="Información del producto">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className={tab === id ? 'pdp-tab is-active' : 'pdp-tab'}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pdp-tab-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'desc' && <ProductDescription html={product.description} />}
            {tab === 'envio' && (
              <p>
                Entrega de 3 a 5 días hábiles en zona metropolitana y de 5 a 8 días en el resto del país. Envío gratis en
                compras mayores a $999.
              </p>
            )}
            {tab === 'dev' && <p>Tienes 30 días para cambios y devoluciones. La prenda debe estar sin uso y con etiquetas.</p>}
          </div>
    </>
  );
}
