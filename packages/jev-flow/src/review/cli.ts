/**
 * npm run review -- main..refactor/pdp [--lang es] [--skip-checks] [--no-comment] [--json] [--strict]
 * npm run review -- --fixtures [--compare-opus]
 *
 * Revisión local sin GitHub: deterministas primero, Jev por commit × archivo, umbrales en thresholds.ts.
 */
import { readFileSync } from 'node:fs';
import { jevMode, jevProvider } from '../config';
import { REVIEW_LABELS_ES, type ReviewQuestionId } from '../jev/questions/review';
import { RUN_ID, setCommand } from '../metrics/log';
import { usd } from '../prices';
import { bold, cyan, dim, green, parseArgs, red, table, yellow } from '../lib/table';
import { reviewFixtures, reviewRange, writeReport, type ReviewResult } from './run';
import { VERDICT_ES, type Verdict } from './verdict';

const { flags, positional } = parseArgs(process.argv.slice(2));
setCommand(flags.fixtures ? 'review-fixtures' : 'review');
const lang = flags.lang === 'es' ? 'es' : 'en';
const color = (v: Verdict) => (v === 'block' ? red : v === 'review' ? yellow : green)(VERDICT_ES[v]);
const json = Boolean(flags.json);
const log = (...a: unknown[]) => (json ? undefined : console.log(...a));

if (flags.fixtures) {
  log(bold('\nRevisión de fixtures'), dim(`· Jev ${jevProvider()} · JEV_MODE=${jevMode()} · run ${RUN_ID}\n`));
  const { outcomes, summary, jevCost, opusCost } = await reviewFixtures({ lang, compareOpus: Boolean(flags['compare-opus']) });
  const rows = outcomes.map((o) => [
    o.id,
    o.title,
    o.expected.map((v) => VERDICT_ES[v]).join(' o '),
    color(o.jev),
    o.ok ? green('✓') : red('✗'),
    color(o.baseline),
    ...(o.opus ? [color(o.opus)] : []),
  ]);
  log(table(['Fixture', 'Contenido', 'Esperado', 'Jev', '', 'Regex/carpeta', ...(flags['compare-opus'] ? ['Opus'] : [])], rows));
  const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)} %`);
  log('');
  for (const [m, s] of Object.entries(summary))
    log(`${m.padEnd(9)} recall ${pct(s.recall)} · falsos positivos ${s.falsePositives}/${s.negatives} · exactos ${s.exact}/${s.total}`);
  log(`\nCosto Jev ${usd(jevCost)}${flags['compare-opus'] ? ` · Opus ${usd(opusCost)}` : ''}`);
  log(dim('Con 5 fixtures estas cifras son ilustrativas, no un benchmark.'));
  if (json) console.log(JSON.stringify({ outcomes: outcomes.map(({ result, ...o }) => o), summary, jevCost, opusCost }, null, 2));
  process.exit(0);
}

const range = positional[0];
if (!range) {
  console.error('Uso: npm run review -- main..refactor/pdp   (o --fixtures)');
  process.exit(64);
}
log(bold(`\nRevisión local · ${range}`), dim(`· Jev ${jevProvider()} · JEV_MODE=${jevMode()} · run ${RUN_ID}\n`));
const result = await reviewRange(range, {
  lang,
  skipChecks: Boolean(flags['skip-checks']),
  noComment: Boolean(flags['no-comment']),
  description: typeof flags.description === 'string' ? readFileSync(flags.description, 'utf8') : undefined,
});
const report = writeReport(result);
print(result);
log(dim(`\nReporte: ${report.replace(process.cwd() + '/', '')}`));
if (json) console.log(JSON.stringify({ verdict: result.verdict, report, units: result.units.map((u) => ({ file: u.unit.file, commit: u.unit.group, verdict: u.verdict, findings: u.findings })), checks: result.checks, comment: result.comment }));
if (flags.strict) process.exitCode = result.verdict === 'block' ? 2 : result.verdict === 'review' ? 1 : 0;

function print(r: ReviewResult) {
  log(bold('Chequeos deterministas'));
  for (const c of r.checks) log(`  ${c.ok ? green('✓') : red('✗')} ${c.name} ${dim(c.detail + (c.cached ? ' · caché' : ''))}`);
  if (!r.checks.every((c) => c.ok)) log(red('  → falla determinista: se bloquea sin llamar a Jev.'));
  if (r.skipped.length) log(dim(`  ${r.skipped.length} archivo(s) filtrados en código: ${[...new Set(r.skipped.map((s) => s.file))].join(', ')}`));
  if (r.units.length && r.jevRequests) {
    log('');
    const rows = r.units.map((u) => [
      u.unit.group,
      u.unit.file.replace(/^apps\/web\/src\//, 'web/').replace(/^apps\/api\/src\//, 'api/'),
      color(u.verdict),
      u.findings.map((f) => `${REVIEW_LABELS_ES[f.question as ReviewQuestionId] ?? f.question} ${f.probability.toFixed(2)}`).join(', ') || dim('—'),
    ]);
    log(table(['Commit', 'Archivo', 'Veredicto', 'Hallazgos (p de Jev)'], rows));
  }
  log(`\n${bold('Veredicto')}: ${color(r.verdict)}   ${dim(`baseline regex/carpeta: ${VERDICT_ES[r.baselineVerdict]}`)}`);
  log(`Costo Jev ${usd(r.costUsd)} · ${r.jevRequests} requests${r.replayed && r.jevRequests ? dim(' · reproducido') : ''}${r.commentCostUsd ? ` · Haiku ${usd(r.commentCostUsd)}` : ''}`);
  if (r.comment) log(`\n${bold(cyan('Comentario para humanos (Haiku)'))}\n${r.comment}`);
  else if (r.verdict === 'approve') log(dim('Aprobado: no se llama a Haiku.'));
}
