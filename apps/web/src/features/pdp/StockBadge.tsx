/** Disponibilidad de la variante elegida. */
export function StockBadge({ stock }: { stock: number }) {
  const text = stock <= 0 ? 'Agotado en esta combinación' : stock <= 3 ? `Últimas ${stock} piezas` : 'Disponible';
  return (
    <p className={stock <= 0 ? 'pdp-stock is-out' : 'pdp-stock'} data-testid="stock">
      {text}
    </p>
  );
}
