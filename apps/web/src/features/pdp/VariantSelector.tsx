import { stockFor, type VariantView } from './variants';

interface Props {
  colors: { name: string; hex: string }[];
  sizes: string[];
  variants: VariantView[];
  color: string | null;
  size: string | null;
  onColor: (c: string) => void;
  onSize: (s: string) => void;
}

/** Selector de color y talla. Cada cambio actualiza imagen, stock y precio en la página. */
export function VariantSelector({ colors, sizes, variants, color, size, onColor, onSize }: Props) {
  return (
    <div className="pdp-variants">
      <p className="pdp-label">Color: {color}</p>
      <div className="pdp-swatches" role="group" aria-label="Color">
        {colors.map((c) => (
          <button
            key={c.name}
            type="button"
            title={c.name}
            aria-label={c.name}
            className={c.name === color ? 'pdp-swatch is-active' : 'pdp-swatch'}
            style={{ background: c.hex }}
            aria-pressed={c.name === color}
            onClick={() => onColor(c.name)}
          />
        ))}
      </div>
      <p className="pdp-label">Talla: {size}</p>
      <div className="pdp-sizes" role="group" aria-label="Talla">
        {sizes.map((s) => {
          const out = color != null && stockFor(variants, color, s) <= 0;
          return (
            <button
              key={s}
              type="button"
              className={['pdp-size', s === size ? 'is-active' : '', out ? 'is-soldout' : ''].join(' ').trim()}
              aria-pressed={s === size}
              aria-label={out ? `${s}, agotada` : s}
              onClick={() => onSize(s)}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
