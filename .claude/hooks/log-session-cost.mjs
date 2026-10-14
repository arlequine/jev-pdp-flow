#!/usr/bin/env node
/**
 * Hook Stop de Claude Code: suma los tokens de la sesión desde el transcript y los guarda
 * en metrics/claude-code.jsonl (una línea acumulada por modelo; el dashboard toma la última).
 * Solo tokens: el costo lo calcula packages/jev-flow/src/prices.ts.
 * Nunca bloquea: si algo falla, sale con 0.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw || '{}');
  const transcript = input.transcript_path;
  const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  if (!transcript || !existsSync(transcript)) process.exit(0);

  // Un mensaje puede aparecer varias veces en el transcript (streaming): nos quedamos con el último por id.
  const byId = new Map();
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const m = e.message;
    if (e.type !== 'assistant' || !m?.usage || !m.model) continue;
    byId.set(m.id ?? e.uuid, m);
  }
  const totals = new Map();
  for (const m of byId.values()) {
    if (m.model === '<synthetic>') continue;
    const t = totals.get(m.model) ?? { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, turns: 0 };
    t.inputTokens += m.usage.input_tokens ?? 0;
    t.outputTokens += m.usage.output_tokens ?? 0;
    t.cacheWriteTokens += m.usage.cache_creation_input_tokens ?? 0;
    t.cacheReadTokens += m.usage.cache_read_input_tokens ?? 0;
    t.turns += 1;
    totals.set(m.model, t);
  }
  let branch = '';
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {}
  mkdirSync(join(cwd, 'metrics'), { recursive: true });
  for (const [model, t] of totals)
    appendFileSync(
      join(cwd, 'metrics', 'claude-code.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), sessionId: input.session_id ?? 'desconocida', model, branch, ...t }) + '\n',
    );
} catch {
  /* nunca bloquear */
}
process.exit(0);
