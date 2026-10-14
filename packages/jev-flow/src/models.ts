import type { JevProvider } from './config';

/**
 * Versión fija de Jev. Los umbrales de thresholds.ts están pensados para esta versión;
 * si cambia, hay que volver a calibrar (ver docs/runbook.md, sección E).
 */
export const JEV_VERSION = 'jev-1.13';

/** ID que se manda a cada proveedor. Ambos fijan 1.13; ninguno usa alias "latest". */
export const JEV_MODEL_ID: Record<JevProvider, string> = {
  typesafe: 'jev-1.13.0',
  openrouter: 'typesafe/jev-1.13',
};

export const JEV_BASE_URL: Record<JevProvider, string> = {
  typesafe: 'https://api.typesafe.ai', // default del SDK @typesafe-ai/sdk 0.6.0
  openrouter: 'https://openrouter.ai/api', // el SDK agrega /v1/systemone
};

/** Modelos de Anthropic, fijos. */
export const CLAUDE = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const;
export type ClaudeAlias = keyof typeof CLAUDE;
