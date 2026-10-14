/**
 * npm run cost [-- prioritize|refactor|review|all]
 * Costos por modelo y por paso de la demo, leídos de metrics/*.jsonl. Nada escrito a mano.
 */
import '../lib/cli-errors';
import { aggregate } from './aggregate';
import { bold, dim, parseArgs, table } from '../lib/table';
import { usd } from '../prices';

const { positional, flags } = parseArgs(process.argv.slice(2));
const what = positional[0] ?? 'all';
const a = aggregate();
if (flags.json) {
  console.log(JSON.stringify(a));
  process.exit(0);
}
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)} %`);
const LABEL: Record<string, string> = {
  jev: 'Jev (preguntas en inglés)',
  'jev-es': 'Jev (preguntas en español)',
  'orden-del-ticket': 'Orden del ticket',
  'urgente-primero': '"URGENTE" primero',
  'opus-claude-code': 'Pedirle el orden a Opus (Claude Code)',
  baseline: 'Regex / carpeta',
};

if (!a.hasData) {
  console.log('Todavía no hay llamadas a modelos registradas. Corre la demo con JEV_MODE=record o replay (docs/runbook.md, sección B).');
  if (a.beforeAfter) console.log('Las métricas de antes y después ya están: npm run dashboard (sección 4).');
  process.exit(0);
}
console.log(dim(`Precios de lista al ${a.pricesAsOf} · snapshots de Jev: ${a.snapshots.join(', ') || '—'}`));

if (what === 'prioritize' || what === 'all') {
  console.log(bold('\n1. Priorización'));
  console.log(
    table(
      ['Método', 'Criterios', 'Spearman', 'Tiempo', 'Costo'],
      a.prioritize.map((p) => [LABEL[p.method] ?? p.method, p.passed == null ? '—' : `${p.passed}/${p.total}`, p.spearman == null ? '—' : p.spearman.toFixed(2), p.latencyMs == null ? '—' : `${(p.latencyMs / 1000).toFixed(2)} s`, usd(p.costUsd)]),
      ['l', 'r', 'r', 'r', 'r'],
    ),
  );
  if (!a.prioritize.some((p) => p.method.endsWith('claude-code'))) console.log(dim('Para comparar con Opus en Claude Code: npm run compare -- PDP-142'));
}

if (what === 'refactor' || what === 'all') {
  console.log(bold('\n2. Refactor'));
  if (!a.refactor.rows.length) console.log(dim('Sin datos: corre una subtarea con Claude Code (el hook Stop guarda los tokens).'));
  else {
    console.log(
      table(
        ['Origen', 'Modelo', 'Tokens entrada', 'Tokens salida', 'Costo real', 'Mismos tokens con Opus'],
        a.refactor.rows.map((r) => [r.source, r.model, r.inputTokens.toLocaleString('es-MX'), r.outputTokens.toLocaleString('es-MX'), usd(r.costUsd), usd(r.opusUsd)]),
        ['l', 'l', 'r', 'r', 'r', 'r'],
      ),
    );
    console.log(`Total ${usd(a.refactor.totalUsd)} · con Opus serían ${usd(a.refactor.opusUsd)} (estimación: mismos tokens a precio de Opus)`);
  }
}

if (what === 'review' || what === 'all') {
  console.log(bold('\n3. Revisión (fixtures)'));
  if (!a.review.length) console.log(dim('Sin datos: npm run review -- --fixtures'));
  else
    console.log(
      table(
        ['Método', 'Recall', 'Falsos positivos', 'Exactos', 'Costo'],
        a.review.map((r) => [LABEL[r.method] ?? r.method, pct(r.recall), `${r.falsePositives}/${r.negatives}`, `${r.exact}/${r.total}`, usd(r.costUsd)]),
        ['l', 'r', 'r', 'r', 'r'],
      ),
    );
  if (a.branchReview)
    console.log(`Última revisión de rama: Jev ${usd(a.branchReview.jevUsd)} (${a.branchReview.jevRequests} requests)`);
}

if (what === 'all') {
  console.log(bold('\nTotal por modelo'));
  console.log(
    table(
      ['Modelo', 'Llamadas', 'Tokens entrada', 'Tokens salida', 'Costo'],
      a.byModel.map((m) => [m.model, String(m.calls), m.inputTokens.toLocaleString('es-MX'), m.outputTokens.toLocaleString('es-MX'), usd(m.costUsd)]),
      ['l', 'r', 'r', 'r', 'r'],
    ),
  );
  if (a.jevCostUnknown) console.log(dim(`${a.jevCostUnknown} llamadas a Jev sin tokens reportados: costo sin dato.`));
}
