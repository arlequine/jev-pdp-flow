import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withCassette } from '../replay/cassette';
import { costUsd } from '../prices';

/**
 * Una pregunta a Claude Code en modo no interactivo (`claude -p`), sin la API de Anthropic.
 * Se corre en un directorio temporal, sin herramientas ni MCP, para medir solo la respuesta del modelo.
 * Con JEV_MODE=replay devuelve la salida grabada (incluida su duración).
 */
export interface ClaudeCodeResult {
  text: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  /** Costo que reporta Claude Code (total_cost_usd). */
  reportedCostUsd: number | null;
  /** Mismos tokens × precio de lista de prices.ts (comparable con Jev). */
  costUsd: number | null;
  replayed: boolean;
}

interface CliOutput {
  result?: string;
  is_error?: boolean;
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
  modelUsage?: Record<string, { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number; costUSD?: number }>;
}

export async function askClaudeCode(input: { model: string; prompt: string; purpose: string }): Promise<ClaudeCodeResult> {
  const request = { model: input.model, prompt: input.prompt };
  const r = await withCassette('claude-code', request, input.purpose, 'claude-code', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'jev-cc-'));
    try {
      const p = spawnSync(
        process.env.CLAUDE_BIN ?? 'claude',
        ['-p', '--model', input.model, '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence'],
        { cwd, input: input.prompt, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 300_000 },
      );
      if (p.error) throw new Error(`No pude ejecutar Claude Code (${p.error.message}). ¿Está instalado y con sesión iniciada? Prueba: claude -p "hola"`);
      const out = JSON.parse(p.stdout.trim().split('\n').at(-1) ?? '{}') as CliOutput;
      if (p.status !== 0 || out.is_error) throw new Error(`Claude Code falló: ${(out.result ?? p.stderr).slice(0, 300)}`);
      return out;
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
  const out = r.response;
  const entries = Object.entries(out.modelUsage ?? {});
  const main = entries.find(([m]) => m.includes(input.model)) ?? entries.sort((a, b) => (b[1].outputTokens ?? 0) - (a[1].outputTokens ?? 0))[0];
  const u = out.usage ?? {};
  let computed: number | null = 0;
  for (const [m, mu] of entries) {
    try {
      computed! += costUsd(m, { input: mu.inputTokens ?? 0, output: mu.outputTokens ?? 0, cacheWrite: mu.cacheCreationInputTokens ?? 0, cacheRead: mu.cacheReadInputTokens ?? 0 });
    } catch {
      computed = null; // modelo sin precio en prices.ts
      break;
    }
  }
  if (!entries.length) computed = null;
  return {
    text: out.result ?? '',
    model: main?.[0] ?? input.model,
    durationMs: out.duration_ms ?? r.latencyMs,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    reportedCostUsd: out.total_cost_usd ?? null,
    costUsd: computed,
    replayed: r.replayed,
  };
}
