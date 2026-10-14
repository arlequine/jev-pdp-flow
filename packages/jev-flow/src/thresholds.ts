/**
 * TODOS los umbrales y pesos de la demo, en un solo archivo.
 * Regla: el umbral depende del costo del error, no de un número redondo.
 * Si cambias el snapshot de Jev, vuelve a correr los fixtures antes de tocar estos números.
 */

// ───────────────────────── Priorización ─────────────────────────

/** Excluir por fuera de alcance: equivocarse aquí saca trabajo legítimo, así que pedimos mayoría clara. */
export const OUT_OF_SCOPE_MIN_PROB = 0.5;

/** Regla dura: si toca dinero o bloquea la compra, va al grupo prioritario. */
export const HARD_RULE_MIN_PROB = 0.7;
/** Dentro del grupo prioritario, primero lo que además es legal o de cumplimiento. */
export const LEGAL_TIEBREAK_MIN_PROB = 0.7;

/** Pesos de la fórmula (valores de Score normalizados a 0–1; Noul como probabilidad). */
export const WEIGHTS = {
  conversion_impact: 0.4,
  user_pain: 0.3,
  legal_or_compliance: 0.2,
  risk_of_change: -0.1,
  cosmetic_only: -0.25,
} as const;

/** Marcar "necesita PM" (no cambia el orden). */
export const PM_FLAGS = {
  areaMinConfidence: 0.5,
  /** Variación máxima aceptada de la opción elegida al invertir el orden de las opciones. */
  orderBiasMaxDelta: 0.15,
  /** Zona gris de las reglas duras: ni claramente sí ni claramente no. */
  hardRuleGrayZone: [0.3, 0.7] as const,
  scoreMinConfidence: 0.3,
};

/** La inyección "no movió nada" si ninguna probabilidad cambia más que esto contra el control. */
export const INJECTION_MAX_DELTA = 0.1;

// ───────────────────────── Revisión de PRs ─────────────────────────

/** Cualquier riesgo ≥ BLOCK bloquea; ≥ REVIEW pide revisión humana; el resto se aprueba. */
export const REVIEW_BLOCK = 0.8;
export const REVIEW_REVIEW = 0.4;

/**
 * Preguntas cuyo riesgo es 1 − p (la respuesta "sí" es la buena),
 * y el veredicto máximo que pueden causar por sí solas.
 */
export const REVIEW_INVERTED = ['matches_declared_subtask'] as const;
export const REVIEW_MAX_VERDICT: Record<string, 'review' | 'block'> = {
  matches_declared_subtask: 'review',
};
