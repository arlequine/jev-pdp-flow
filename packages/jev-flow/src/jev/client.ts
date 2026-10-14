import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { JEV_PROVIDER, requireEnv } from '../config';
import { JEV_BASE_URL, JEV_MODEL_ID, JEV_VERSION } from '../models';
import { costUsd } from '../prices';
import { withCassette } from '../replay/cassette';
import { appendJsonl, logCall, metricsDir } from '../metrics/log';
import { JevResponse, type JevQuestions } from './types';

export interface AskJevInput {
  state: unknown;
  questions: JevQuestions;
  /** Para qué es la llamada (aparece en métricas): p. ej. "prioritize:PDP-142.4". */
  purpose: string;
  tag?: string;
}

export interface AskJevOutput {
  response: JevResponse;
  costUsd: number | null;
  latencyMs: number;
  replayed: boolean;
}

/** Transporte real (SDK de TypeSafe, API nativa). Inyectable para tests. */
export type JevTransport = (body: { model: string; state: unknown; questions: JevQuestions }) => Promise<unknown>;

let client: TypeSafeClient | null = null;
export const sdkTransport: JevTransport = async (body) => {
  client ??= new TypeSafeClient({ apiKey: requireEnv('TYPESAFE_API_KEY'), baseURL: JEV_BASE_URL, timeout: 20_000 });
  // El SDK tipa las respuestas según las preguntas; aquí validamos con zod después.
  return (client as unknown as { systemOne: (b: unknown) => Promise<unknown> }).systemOne(body);
};

let transport: JevTransport = sdkTransport;
export const setJevTransport = (t: JevTransport) => (transport = t);

/**
 * Una request a Jev con todas las preguntas juntas (speculative fan-out).
 * Registra snapshot, tokens, costo y latencia en metrics/jev.jsonl.
 */
export async function askJev(input: AskJevInput): Promise<AskJevOutput> {
  // La llave de la grabación usa la versión lógica (jev-1.13) más state y preguntas.
  const logical = { model: JEV_VERSION, state: input.state, questions: input.questions };
  const r = await withCassette('jev', logical, input.purpose, JEV_PROVIDER, async () =>
    transport({ model: JEV_MODEL_ID, state: input.state, questions: input.questions }),
  );

  const parsed = JevResponse.safeParse(r.response);
  if (!parsed.success) throw new Error(`Respuesta de Jev con forma inesperada (${input.purpose}): ${parsed.error.message}`);
  const res = parsed.data;
  for (const id of Object.keys(input.questions)) {
    if (!res.answers[id]) throw new Error(`Jev no respondió la pregunta "${id}" (${input.purpose})`);
    if (res.answers[id].type !== input.questions[id].type) throw new Error(`Tipo inesperado en "${id}" (${input.purpose})`);
  }

  checkSnapshot(res.model);

  const inputTokens = res.usage?.input_tokens ?? null;
  let cost: number | null = null;
  let costSource: 'computed' | 'unknown' = 'unknown';
  // La API nativa devuelve tokens; el costo se calcula con el precio de lista (prices.ts).
  if (inputTokens != null) {
    cost = costUsd(JEV_VERSION, { input: inputTokens, output: res.usage?.output_tokens ?? 0 });
    costSource = 'computed';
  }

  logCall({
    purpose: input.purpose,
    kind: 'jev',
    provider: r.provider,
    requestedModel: JEV_MODEL_ID,
    model: res.model,
    inputTokens,
    outputTokens: res.usage?.output_tokens ?? null,
    costUsd: cost,
    costSource,
    latencyMs: r.latencyMs,
    mode: r.mode,
    replayed: r.replayed,
    cassette: r.key,
    tag: input.tag,
  });

  return { response: res, costUsd: cost, latencyMs: r.latencyMs, replayed: r.replayed };
}

/**
 * Guarda el primer snapshot visto (metrics/snapshot.json) y avisa si cambia.
 * Un cambio de snapshot puede mover las probabilidades: hay que revisar los umbrales.
 */
export function checkSnapshot(model: string) {
  const file = `${metricsDir()}/snapshot.json`;
  mkdirSync(metricsDir(), { recursive: true });
  const known = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { model: string; firstSeen: string }) : null;
  if (!known) {
    writeFileSync(file, JSON.stringify({ model, firstSeen: new Date().toISOString() }, null, 2) + '\n');
    return;
  }
  if (known.model !== model) {
    if (!warned.has(model)) {
      console.warn(
        `\n⚠️  El snapshot de Jev cambió: ${known.model} → ${model}.\n` +
          `   Las probabilidades pueden moverse. Revisa los umbrales (docs/runbook.md, sección E) antes de confiar en los veredictos.\n`,
      );
      appendJsonl('events', { ts: new Date().toISOString(), event: 'jev_snapshot_changed', from: known.model, to: model });
      warned.add(model);
    }
  }
}
const warned = new Set<string>();
