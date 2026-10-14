/**
 * npm run compare -- PDP-142 [--model opus]
 *
 * Misma decisión, dos formas de tomarla:
 *  - Jev: preguntas cerradas por subtarea (API nativa de TypeSafe) y el orden lo calcula el código.
 *  - Opus en Claude Code: "prompt y parseo" (`claude -p --model opus`), el ticket completo y el orden en JSON.
 * Compara costo, tiempo de respuesta y criterios de éxito. Sin API de Anthropic: Opus corre en Claude Code.
 * Con JEV_MODE=replay reproduce las dos respuestas grabadas (y sus tiempos).
 */
import '../lib/cli-errors';
import { JEV_PROVIDER, jevMode } from '../config';
import { RUN_ID, appendJsonl, setCommand } from '../metrics/log';
import { usd } from '../prices';
import { loadTicket, loadTicketMarkdown, loadTruth } from '../lib/ticket';
import { bold, dim, green, parseArgs, red, table } from '../lib/table';
import { extractJson } from '../lib/json';
import { askClaudeCode } from '../claudecode/run';
import { prioritize } from '../prioritize/run';
import { evaluateOrder } from '../prioritize/evaluate';
import { llmOrderPrompt } from '../prioritize/baselines';

setCommand('compare');
const { flags, positional } = parseArgs(process.argv.slice(2));
const id = positional[0] ?? 'PDP-142';
const model = typeof flags.model === 'string' ? flags.model : process.env.CLAUDE_COMPARE_MODEL ?? 'opus';
const ticket = loadTicket(id);
const truth = loadTruth(id);
if (!truth) throw new Error(`Falta tickets/${id}.truth.json para evaluar`);

console.log(bold(`\nPriorizar ${id}: Jev vs ${model} en Claude Code`));
console.log(dim(`Jev ${JEV_PROVIDER} · JEV_MODE=${jevMode()} · run ${RUN_ID}\n`));

// 1. Jev
process.stdout.write('Jev…');
const jev = await prioritize(ticket, truth, 'en');
console.log(` ${(jev.latencyMs / 1000).toFixed(2)} s`);

// 2. Opus en Claude Code
process.stdout.write(`${model} en Claude Code…`);
const cc = await askClaudeCode({ model, prompt: llmOrderPrompt(loadTicketMarkdown(id)), purpose: `compare:${id}:${model}` });
console.log(` ${(cc.durationMs / 1000).toFixed(2)} s`);
let order: string[] = [];
let excluded: string[] = [];
let parseOk = true;
try {
  const j = extractJson<{ order: string[]; excluded?: string[] }>(cc.text);
  const ids = new Set(ticket.subtasks.map((s) => s.id));
  order = j.order.filter((x) => ids.has(x));
  excluded = (j.excluded ?? []).filter((x) => ids.has(x));
} catch {
  parseOk = false;
}
const ccEval = evaluateOrder(order, excluded, truth);
const ccCost = cc.costUsd ?? cc.reportedCostUsd;
const method = `${model}-claude-code`;
appendJsonl('prioritize-runs', {
  ts: new Date().toISOString(),
  runId: RUN_ID,
  method,
  ticket: id,
  order,
  excluded,
  evaluation: ccEval,
  costUsd: ccCost,
  reportedCostUsd: cc.reportedCostUsd,
  latencyMs: cc.durationMs,
  latencySource: cc.replayed ? 'grabado' : 'medido',
  model: cc.model,
  inputTokens: cc.inputTokens + cc.cacheWriteTokens + cc.cacheReadTokens,
  outputTokens: cc.outputTokens,
  replayed: cc.replayed,
  note: parseOk ? undefined : 'respuesta no parseable',
});
appendJsonl('compare-runs', {
  ts: new Date().toISOString(),
  runId: RUN_ID,
  ticket: id,
  jev: { costUsd: jev.costUsd, latencyMs: jev.latencyMs, requests: jev.requests, inputTokens: jev.inputTokens, passed: jev.evaluation?.passed, snapshot: jev.snapshot },
  claudeCode: { model: cc.model, costUsd: ccCost, reportedCostUsd: cc.reportedCostUsd, latencyMs: cc.durationMs, inputTokens: cc.inputTokens, cacheWriteTokens: cc.cacheWriteTokens, cacheReadTokens: cc.cacheReadTokens, outputTokens: cc.outputTokens, passed: ccEval.passed },
});

// 3. Resultado
const mark = (ok: boolean) => (ok ? green('✓') : red('✗'));
const e = jev.evaluation!;
console.log('');
console.log(
  table(
    ['', 'Jev + código', `${model} (Claude Code)`],
    [
      ['Criterios de éxito', `${e.passed}/5`, `${ccEval.passed}/5`],
      ['  top 3 · precio top 2', `${mark(e.top3)} ${mark(e.top2)}`, `${mark(ccEval.top3)} ${mark(ccEval.top2)}`],
      ['  URGENTE fuera · inyección · checkout', `${mark(e.noise)} ${mark(e.injection)} ${mark(e.outOfScope)}`, `${mark(ccEval.noise)} ${mark(ccEval.injection)} ${mark(ccEval.outOfScope)}`],
      ['Tiempo de respuesta', `${(jev.latencyMs / 1000).toFixed(2)} s`, `${(cc.durationMs / 1000).toFixed(2)} s`],
      ['Costo (precio de lista)', usd(jev.costUsd), usd(cc.costUsd)],
      ['Costo que reporta Claude Code', '—', usd(cc.reportedCostUsd)],
      ['Tokens de entrada', jev.inputTokens.toLocaleString('es-MX'), (cc.inputTokens + cc.cacheWriteTokens + cc.cacheReadTokens).toLocaleString('es-MX')],
      ['Tokens de salida', '0 (gratis)', cc.outputTokens.toLocaleString('es-MX')],
      ['Requests', String(jev.requests), '1'],
    ],
    ['l', 'r', 'r'],
  ),
);
if (jev.costUsd && ccCost) console.log(`\n${model} costó ${bold((ccCost / jev.costUsd).toFixed(0) + '×')} lo de Jev y tardó ${bold((cc.durationMs / jev.latencyMs).toFixed(1) + '×')}.`);
console.log(`Orden de ${model}: ${order.join(' → ') || dim('(no parseable)')}${excluded.length ? dim(`  · excluidas: ${excluded.join(', ')}`) : ''}`);
console.log(`Orden de Jev:  ${jev.result.order.map((r) => r.id).join(' → ')}${dim(`  · excluidas: ${jev.result.excluded.map((r) => r.id).join(', ')}`)}`);
console.log(
  dim(
    `\nTiempos: Jev ${jev.latencySource}; ${model} = duration_ms de Claude Code${cc.replayed ? ' (grabado)' : ''}. ` +
      `Claude Code incluye su propio prompt de sistema (por eso los tokens en caché). Un solo ticket: ilustrativo, no un benchmark.`,
  ),
);
