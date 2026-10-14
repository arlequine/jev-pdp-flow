/**
 * Precios de lista en USD por millón de tokens (entrada / salida).
 * Fuente: Jev → página del modelo en OpenRouter y TypeSafe (doc "Que es jev", 13 oct 2026).
 * Claude → valores entregados para la charla; verificar contra la página de precios de Anthropic antes de presentar.
 */
export const PRICES_AS_OF = '2026-10-14';

export const PRICES: Record<string, { input: number; output: number }> = {
  'jev-1.13': { input: 0.042, output: 0 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
};

/**
 * Multiplicadores de caché de prompts de Anthropic (escritura 5 min y lectura) sobre el precio de entrada.
 * Solo se usan para el costo de sesiones de Claude Code, que sí usan caché.
 */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

export interface TokenCounts {
  input: number;
  output: number;
  cacheWrite?: number;
  cacheRead?: number;
}

export function costUsd(model: string, t: TokenCounts): number {
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(k) || model.includes(k));
  if (!key) throw new Error(`Sin precio para el modelo "${model}" en prices.ts`);
  const p = PRICES[key];
  return (
    (t.input * p.input +
      t.output * p.output +
      (t.cacheWrite ?? 0) * p.input * CACHE_WRITE_MULTIPLIER +
      (t.cacheRead ?? 0) * p.input * CACHE_READ_MULTIPLIER) /
    1_000_000
  );
}

export const usd = (n: number | null | undefined, digits = 6) =>
  n == null ? 'sin dato' : `$${n.toFixed(n !== 0 && n < 0.01 ? digits : 4)}`;
