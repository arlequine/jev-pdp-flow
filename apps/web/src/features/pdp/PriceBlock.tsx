import type { Money } from '@jev/contracts';
import { formatMXN } from '../../pricing/format';
import './pdp.css';

/** Precio final tal como lo calcula el servidor: con moneda y con el IVA visible. */
export function PriceBlock({ price }: { price: Money }) {
  return (
    <div className="price-block">
      <p className="price" data-testid="price">
        {formatMXN(price.amountCents)} <span className="price-currency">MXN</span>
      </p>
      <p className="price-tax">{price.taxIncluded ? 'IVA incluido' : 'Más IVA'}</p>
    </div>
  );
}
