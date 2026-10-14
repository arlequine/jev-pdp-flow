import { useState } from 'react';

interface Props {
  sku: string | undefined;
  stock: number;
  quantity: number;
}

/**
 * Agrega la variante elegida al carrito. Manda solo SKU y cantidad: el precio lo calcula el servidor.
 * Sin stock, el botón se deshabilita y dice "Agotado".
 */
export function AddToCart({ sku, stock, quantity }: Props) {
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const soldOut = !sku || stock <= 0;

  const add = async () => {
    if (soldOut) return;
    setState('adding');
    try {
      const r = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, quantity }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState('added');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="pdp-buybar">
      <button type="button" className="pdp-add" disabled={soldOut || state === 'adding'} onClick={add}>
        {soldOut ? 'Agotado' : state === 'adding' ? 'Agregando…' : 'Agregar al carrito'}
      </button>
      {state === 'added' && <p className="pdp-added">Agregado al carrito</p>}
      {state === 'error' && <p className="pdp-error">No pudimos agregarlo. Intenta de nuevo.</p>}
    </div>
  );
}
