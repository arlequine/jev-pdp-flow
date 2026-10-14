/**
 * Versión fija de Jev. Los umbrales de thresholds.ts están pensados para esta versión;
 * si cambia, hay que volver a calibrar (ver docs/runbook.md, sección E).
 */
export const JEV_VERSION = 'jev-1.13';

/** ID nativo de TypeSafe, fijo. Nunca el alias jev-latest. */
export const JEV_MODEL_ID = 'jev-1.13.0';

/** API nativa de TypeSafe (default del SDK @typesafe-ai/sdk 0.6.0). TYPESAFE_BASE_URL la puede cambiar. */
export const JEV_BASE_URL = process.env.TYPESAFE_BASE_URL ?? 'https://api.typesafe.ai';

/** Modelos de Anthropic, fijos. */
export const CLAUDE = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const;
export type ClaudeAlias = keyof typeof CLAUDE;
