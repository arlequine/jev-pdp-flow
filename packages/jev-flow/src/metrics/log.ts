import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { path } from '../config';

/** Identificador de la corrida actual: agrupa todas las llamadas de un mismo comando. */
export const RUN_ID =
  process.env.JEV_RUN_ID ?? `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')}-${process.pid}`;

export interface CallLog {
  ts: string;
  runId: string;
  command: string;
  purpose: string;
  kind: 'jev' | 'claude-code';
  provider: string;
  requestedModel: string;
  /** Snapshot que respondió (campo `model` de la respuesta). */
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheWriteTokens?: number | null;
  cacheReadTokens?: number | null;
  costUsd: number | null;
  /** computed = tokens × precio de lista; unknown = la respuesta no trajo tokens. */
  costSource: 'computed' | 'unknown';
  latencyMs: number;
  mode: 'live' | 'record' | 'replay';
  replayed: boolean;
  cassette?: string;
  tag?: string;
}

export const metricsDir = () => process.env.JEV_METRICS_DIR ?? path('metrics');
export const metricsFile = (name: string) => `${metricsDir()}/${name}.jsonl`;

export function appendJsonl(name: string, row: unknown) {
  const f = metricsFile(name);
  mkdirSync(dirname(f), { recursive: true });
  appendFileSync(f, JSON.stringify(row) + '\n');
}

export function readJsonl<T>(name: string): T[] {
  const f = metricsFile(name);
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

let currentCommand = 'unknown';
export const setCommand = (c: string) => (currentCommand = c);
export const getCommand = () => currentCommand;

export function logCall(row: Omit<CallLog, 'ts' | 'runId' | 'command'>) {
  const full: CallLog = { ts: new Date().toISOString(), runId: RUN_ID, command: currentCommand, ...row };
  appendJsonl(row.kind === 'jev' ? 'jev' : 'claude-code', full);
  return full;
}
