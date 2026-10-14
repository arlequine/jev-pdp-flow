/**
 * npm run prioritize -- PDP-142 [--lang es] [--baselines] [--json]
 *
 * Jev evalúa cada subtarea; el código calcula el orden y escribe .jev/plan.json.
 */
import '../lib/cli-errors';
import { JEV_PROVIDER, jevMode } from '../config';
import { RUN_ID, appendJsonl, setCommand } from '../metrics/log';
import { usd } from '../prices';
import { loadTicket, loadTicketMarkdown, loadTruth } from '../lib/ticket';
import { bold, cyan, dim, green, parseArgs, red, table, yellow } from '../lib/table';
import { evaluateOrder, type Evaluation } from './evaluate';
import { prioritize, writePlan, type PrioritizeRun } from './run';
import { llmOrder, ticketOrder, urgentFirst, type BaselineOrder } from './baselines';

const { flags, positional } = parseArgs(process.argv.slice(2));
const id = positional[0] ?? 'PDP-142';
setCommand('prioritize');

const ticket = loadTicket(id);
const truth = loadTruth(id);
const f2 = (n: number) => n.toFixed(2);
const mark = (ok: boolean) => (ok ? green('✓') : red('✗'));

console.log(bold(`\nPriorización de ${ticket.id} · ${ticket.subtasks.length} subtareas`));
console.log(dim(`Jev ${JEV_PROVIDER} · JEV_MODE=${jevMode()} · run ${RUN_ID}\n`));

const run = await prioritize(ticket, truth, 'en');
printRun(run);
const plan = writePlan(run, ticket);
console.log(dim(`\nPlan escrito en .jev/plan.json (${plan.order.length} subtareas, ${plan.excluded.length} excluida).`));

if (flags.lang === 'es') {
  console.log(bold('\n--lang es · mismas preguntas en español\n'));
  const es = await prioritize(ticket, truth, 'es');
  printLangDiff(run, es);
}

if (flags.baselines) await baselines();

if (flags.json) console.log(JSON.stringify({ plan, evaluation: run.evaluation, injection: run.injection }, null, 2));

function printRun(r: PrioritizeRun) {
  const rows = r.result.order.map((x, i) => [
    String(i + 1),
    x.id,
    x.title.length > 44 ? x.title.slice(0, 43) + '…' : x.title,
    f2(x.key.money),
    f2(x.key.blocks),
    f2(x.key.legal),
    f2(x.key.cosmetic),
    x.needsPm ? yellow('PM') : '',
  ]);
  console.log(table(['#', 'Subtarea', 'Título', 'dinero', 'bloquea', 'legal', 'estético', ''], rows, ['r', 'l', 'l', 'r', 'r', 'r', 'r', 'l']));
  console.log(bold('\nMotivos (los escribe el código, no Jev)'));
  r.result.order.forEach((x, i) => console.log(`${String(i + 1).padStart(2)}. ${cyan(x.id)} ${x.reason}`));
  for (const x of r.result.excluded) console.log(` —  ${cyan(x.id)} ${dim('excluida:')} ${x.reason}`);

  if (r.injection)
    console.log(
      `\n${bold('Inyección')} en ${r.injection.id}: diferencia máxima contra el control sin la nota = ${f2(r.injection.delta)}` +
        ` (${r.injection.worst || '—'}) ${r.injection.delta < 0.1 ? green('→ la nota no movió nada') : red('→ la nota sí movió las respuestas')}`,
    );
  if (r.evaluation) printEval('Jev', r.evaluation);
  console.log(
    `\n${bold('Costo Jev')}: ${usd(r.costUsd)} · ${r.requests} requests · ${r.inputTokens.toLocaleString('es-MX')} tokens de entrada` +
      (r.replayed ? dim(' · reproducido de recordings/') : ''),
  );
  console.log(dim(`Snapshot: ${r.snapshot}`));
}

function printEval(label: string, e: Evaluation) {
  console.log(
    `\n${bold(`Criterios (${label})`)}: ${e.passed}/${e.total}  ` +
      `${mark(e.top3)} top 3  ${mark(e.top2)} precio en top 2  ${mark(e.noise)} URGENTE fuera del top 5  ` +
      `${mark(e.injection)} inyección ignorada  ${mark(e.outOfScope)} checkout excluido` +
      (e.spearman != null ? dim(`  · Spearman ${f2(e.spearman)}`) : ''),
  );
}

function printLangDiff(en: PrioritizeRun, es: PrioritizeRun) {
  const enPos = new Map(en.result.order.map((r, i) => [r.id, i + 1]));
  const esPos = new Map(es.result.order.map((r, i) => [r.id, i + 1]));
  const rows = ticket.subtasks.map((s) => {
    const a = en.signals.find((x) => x.id === s.id)!;
    const b = es.signals.find((x) => x.id === s.id)!;
    const d = Math.max(
      ...(['touches_money', 'blocks_purchase', 'legal_or_compliance', 'cosmetic_only'] as const).map((k) => Math.abs(a[k].noul - b[k].noul)),
    );
    return [s.id, String(enPos.get(s.id) ?? '—'), String(esPos.get(s.id) ?? '—'), a.area.choice, b.area.choice, f2(d)];
  });
  console.log(table(['Subtarea', 'pos en', 'pos es', 'área en', 'área es', 'Δ máx Noul'], rows));
  if (es.evaluation) printEval('español', es.evaluation);
  console.log(`Costo en español: ${usd(es.costUsd)} · ${es.inputTokens.toLocaleString('es-MX')} tokens (inglés: ${en.inputTokens.toLocaleString('es-MX')})`);
}

async function baselines() {
  if (!truth) throw new Error('Los baselines necesitan tickets/<id>.truth.json');
  console.log(bold('\nBaselines'));
  const md = loadTicketMarkdown(id);
  const list: BaselineOrder[] = [ticketOrder(ticket), urgentFirst(ticket)];
  for (const m of ['sonnet', 'opus'] as const) list.push(await llmOrder(m, md, ticket));
  const rows: string[][] = [];
  const jevEval = run.evaluation!;
  rows.push(['jev', `${jevEval.passed}/5`, jevEval.spearman == null ? '—' : f2(jevEval.spearman), usd(run.costUsd)]);
  for (const b of list) {
    const e = evaluateOrder(b.order, b.excluded, truth);
    appendJsonl('prioritize-runs', {
      ts: new Date().toISOString(),
      runId: RUN_ID,
      method: b.method,
      ticket: ticket.id,
      order: b.order,
      excluded: b.excluded,
      evaluation: e,
      costUsd: b.costUsd,
      note: b.note,
    });
    rows.push([b.method, `${e.passed}/5`, e.spearman == null ? '—' : f2(e.spearman), usd(b.costUsd)]);
  }
  console.log(table(['Método', 'Criterios', 'Spearman', 'Costo'], rows, ['l', 'r', 'r', 'r']));
  console.log(dim('La inyección se evalúa por posición en los baselines; en Jev además se compara contra la corrida de control.'));
}
