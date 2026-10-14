import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { jevMode, path, type JevMode } from '../config';
import { requestKey } from '../lib/stable';

export type CassetteKind = 'jev' | 'claude-code';

export interface Cassette<Req, Res> {
  key: string;
  kind: CassetteKind;
  recordedAt: string;
  provider: string;
  latencyMs: number;
  request: Req;
  response: Res;
}

export interface CassetteResult<Res> {
  response: Res;
  latencyMs: number;
  provider: string;
  mode: JevMode;
  replayed: boolean;
  key: string;
}

export const cassettePath = (kind: CassetteKind, key: string) =>
  process.env.JEV_RECORDINGS_DIR ? `${process.env.JEV_RECORDINGS_DIR}/${kind}/${key}.json` : path('recordings', kind, `${key}.json`);

export class MissingRecordingError extends Error {
  constructor(kind: CassetteKind, key: string, hint: string) {
    super(
      `JEV_MODE=replay: no hay grabación ${kind}/${key}.json (${hint}).\n` +
        `Corre el mismo comando una vez con JEV_MODE=record y las keys en .env para grabarla.`,
    );
  }
}

/**
 * Envuelve una llamada a una API externa con el modo live | record | replay.
 * - live:   llama y no guarda.
 * - record: llama y guarda la respuesta en recordings/<kind>/<key>.json.
 * - replay: no usa red; lee la grabación o falla con un error claro.
 */
export async function withCassette<Req, Res>(
  kind: CassetteKind,
  request: Req,
  hint: string,
  provider: string,
  live: () => Promise<Res>,
): Promise<CassetteResult<Res>> {
  const mode = jevMode();
  const key = requestKey({ kind, request });
  const file = cassettePath(kind, key);

  if (mode === 'replay') {
    if (!existsSync(file)) throw new MissingRecordingError(kind, key, hint);
    const c = JSON.parse(readFileSync(file, 'utf8')) as Cassette<Req, Res>;
    return { response: c.response, latencyMs: c.latencyMs, provider: c.provider, mode, replayed: true, key };
  }

  const t0 = performance.now();
  const response = await live();
  const latencyMs = Math.round(performance.now() - t0);
  if (mode === 'record') {
    mkdirSync(dirname(file), { recursive: true });
    const c: Cassette<Req, Res> = { key, kind, recordedAt: new Date().toISOString(), provider, latencyMs, request, response };
    writeFileSync(file, JSON.stringify(c, null, 2) + '\n');
  }
  return { response, latencyMs, provider, mode, replayed: false, key };
}
