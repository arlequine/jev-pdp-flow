import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

/** Raíz del monorepo (dos niveles arriba de packages/jev-flow/src). */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
if (existsSync(join(ROOT, '.env'))) loadEnv({ path: join(ROOT, '.env'), quiet: true });

export type JevMode = 'live' | 'record' | 'replay';

export function jevMode(): JevMode {
  const m = (process.env.JEV_MODE ?? 'replay').toLowerCase();
  if (m !== 'live' && m !== 'record' && m !== 'replay') throw new Error(`JEV_MODE inválido: "${m}" (usa live, record o replay)`);
  return m;
}

/** Jev se llama solo por la API nativa de TypeSafe (no por OpenRouter). */
export const JEV_PROVIDER = 'typesafe' as const;

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en .env (o usa JEV_MODE=replay para correr sin red)`);
  return v;
}

export const path = (...p: string[]) => join(ROOT, ...p);
