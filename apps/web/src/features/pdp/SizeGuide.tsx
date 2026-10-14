import { useEffect, useRef } from 'react';

const SIZE_TABLE: Record<string, [number, number]> = {
  S: [92, 70], M: [100, 72], L: [108, 74], XL: [116, 76],
  XS: [84, 68], '28': [72, 100], '30': [76, 102], '32': [81, 104], '34': [86, 106],
};

/** Guía de tallas como diálogo accesible: foco al abrir, Escape para cerrar, botón con nombre. */
export function SizeGuide({ sizes, onClose }: { sizes: string[]; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="pdp-modal-bg" onClick={onClose}>
      <div className="pdp-modal" role="dialog" aria-modal="true" aria-labelledby="size-guide-title" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="pdp-modal-close" aria-label="Cerrar guía de tallas" onClick={onClose}>
          ✕
        </button>
        <h2 id="size-guide-title" className="pdp-modal-title">
          Guía de tallas
        </h2>
        <table className="pdp-table">
          <thead>
            <tr>
              <th scope="col">Talla</th>
              <th scope="col">Pecho / cintura (cm)</th>
              <th scope="col">Largo (cm)</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((s) => (
              <tr key={s}>
                <th scope="row">{s}</th>
                <td>{SIZE_TABLE[s]?.[0] ?? '-'}</td>
                <td>{SIZE_TABLE[s]?.[1] ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
