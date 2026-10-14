export function Quantity({ qty, setQty }: { qty: number; setQty: (n: number) => void }) {
  return (
          <div className="pdp-qty" role="group" aria-label="Cantidad">
            <button type="button" aria-label="Disminuir cantidad" onClick={() => setQty(qty > 1 ? qty - 1 : 1)}>
              −
            </button>
            <output aria-live="polite">{qty}</output>
            <button type="button" aria-label="Aumentar cantidad" onClick={() => setQty(qty + 1)}>
              +
            </button>
          </div>
  );
}
