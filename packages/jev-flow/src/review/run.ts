import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { path } from '../config';
import { askJev } from '../jev/client';
import { REVIEW_LABELS_ES, reviewQuestions, type ReviewQuestionId } from '../jev/questions/review';
import { reviewQuestionsEs } from '../jev/questions/review.es';
import type { NoulAnswer } from '../jev/types';
import { askClaude, extractJson } from '../anthropic/client';
import { pool } from '../lib/table';
import { RUN_ID, appendJsonl } from '../metrics/log';
import { loadTicket } from '../lib/ticket';
import { baselineReview, type BaselineHit } from './baseline';
import { commitsInRange, parseUnifiedDiff, resolveRange, type FileDiff } from './diff';
import { runRepoChecks, scanSecrets, type CheckResult } from './deterministic';
import { ignoreReason } from './filters';
import { VERDICT_ES, judge, worst, type Finding, type Verdict } from './verdict';

/** Unidad de revisión: un archivo de un commit (o de un fixture). */
export interface Unit {
  key: string;
  group: string; // sha corto del commit o id del fixture
  commitMessage: string;
  declaredSubtask: { id: string; title: string; acceptance_criteria: string[] } | null;
  file: string;
  status: FileDiff['status'];
  patch: string;
  added: string[];
  removed: string[];
  movedLines: { line: string; to: string }[];
}

export interface UnitResult {
  unit: Unit;
  verdict: Verdict;
  findings: Finding[];
  risks: Record<string, number>;
  baseline: BaselineHit[];
  baselineVerdict: Verdict;
}

export interface ReviewResult {
  target: string;
  verdict: Verdict;
  baselineVerdict: Verdict;
  checks: CheckResult[];
  units: UnitResult[];
  skipped: { file: string; reason: string }[];
  prDescription: string;
  costUsd: number | null;
  jevRequests: number;
  comment: string | null;
  commentCostUsd: number;
  snapshot: string;
  replayed: boolean;
}

const MAX_PATCH_CHARS = 12_000;

function subtaskInfo(id: string | null): Unit['declaredSubtask'] {
  if (!id) return null;
  try {
    const t = loadTicket(id.replace(/\.\d+$/, ''));
    const s = t.subtasks.find((x) => x.id === id);
    return s ? { id: s.id, title: s.title, acceptance_criteria: s.acceptance_criteria } : { id, title: '(no existe en el ticket)', acceptance_criteria: [] };
  } catch {
    return { id, title: '(ticket no encontrado)', acceptance_criteria: [] };
  }
}

/** Líneas que desaparecen de un archivo y aparecen idénticas en otro archivo del mismo commit: se movieron. */
function movedLines(f: FileDiff, siblings: FileDiff[]) {
  const addedElsewhere = new Map<string, string>();
  for (const s of siblings) if (s !== f) for (const l of s.added) if (l.trim().length > 8) addedElsewhere.set(l.trim(), s.file);
  return f.removed
    .filter((l) => addedElsewhere.has(l.trim()))
    .slice(0, 30)
    .map((l) => ({ line: l.trim(), to: addedElsewhere.get(l.trim())! }));
}

/** Divide un patch grande por hunks para no mandar más contexto del necesario. */
function splitPatch(patch: string): string[] {
  if (patch.length <= MAX_PATCH_CHARS) return [patch];
  const hunks = patch.split(/^(?=@@ )/m);
  const out: string[] = [];
  let cur = '';
  for (const h of hunks) {
    if (cur && cur.length + h.length > MAX_PATCH_CHARS) (out.push(cur), (cur = ''));
    cur += h;
  }
  if (cur) out.push(cur);
  return out;
}

function unitsFrom(group: string, commitMessage: string, declared: string | null, files: FileDiff[], skipped: ReviewResult['skipped']): Unit[] {
  const units: Unit[] = [];
  for (const f of files) {
    const why = ignoreReason(f.file, f.status, f.binary);
    if (why) {
      skipped.push({ file: f.file, reason: why });
      continue;
    }
    const parts = splitPatch(f.patch);
    parts.forEach((patch, i) => {
      const lines = patch.split('\n');
      units.push({
        key: `${group}:${f.file}${parts.length > 1 ? `#${i + 1}` : ''}`,
        group,
        commitMessage,
        declaredSubtask: subtaskInfo(declared),
        file: f.file,
        status: f.status,
        patch,
        added: lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)),
        removed: lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1)),
        movedLines: movedLines(f, files),
      });
    });
  }
  return units;
}

async function judgeUnits(units: Unit[], prDescription: string, lang: 'en' | 'es', tag: string) {
  const qs = lang === 'en' ? reviewQuestions() : reviewQuestionsEs();
  return pool(units, 5, async (u) => {
    const state = {
      evidence: {
        pr_description: prDescription,
        commit_message: u.commitMessage,
        declared_subtask: u.declaredSubtask,
        file: u.file,
        change_type: u.status,
        diff: u.patch,
        ...(u.movedLines.length ? { moved_lines: u.movedLines } : {}),
      },
    };
    const r = await askJev({ state, questions: qs, purpose: `review:${u.key}`, tag });
    const answers = Object.fromEntries(Object.entries(r.response.answers).map(([k, a]) => [k, (a as NoulAnswer).noul]));
    const j = judge(answers);
    const baseline = baselineReview(u);
    const res: UnitResult = { unit: u, ...j, baseline, baselineVerdict: worst(baseline.map((b) => b.verdict)) };
    return { res, call: r };
  });
}

async function humanComment(result: Omit<ReviewResult, 'comment' | 'commentCostUsd'>): Promise<{ text: string; cost: number }> {
  const bad = result.units.filter((u) => u.verdict !== 'approve');
  const failedChecks = result.checks.filter((c) => !c.ok);
  const findings = bad
    .map(
      (u) =>
        `- ${u.unit.file} (${u.unit.group}): ` +
        u.findings.map((f) => `${REVIEW_LABELS_ES[f.question as ReviewQuestionId] ?? f.question} p=${f.probability.toFixed(2)} → ${VERDICT_ES[f.verdict]}`).join(', ') +
        `\n\`\`\`diff\n${u.unit.patch.slice(0, 2500)}\n\`\`\``,
    )
    .join('\n');
  const prompt =
    `Escribe un comentario de revisión de código en español para el autor de este cambio. Máximo 150 palabras, tono directo y amable.\n` +
    `Explica qué hay que corregir y cómo, con base SOLO en los hallazgos de abajo. No inventes problemas nuevos ni repitas probabilidades.\n` +
    `El veredicto ya está decidido: ${VERDICT_ES[result.verdict]}.\n\n` +
    (failedChecks.length ? `Chequeos que fallaron:\n${failedChecks.map((c) => `- ${c.name}: ${c.detail}`).join('\n')}\n\n` : '') +
    `Hallazgos:\n${findings}`;
  const r = await askClaude({ model: 'haiku', prompt, maxTokens: 400, purpose: `review-comment:${result.target}`, tag: 'review' });
  return { text: r.text.trim(), cost: r.costUsd };
}

function finish(
  target: string,
  checks: CheckResult[],
  judged: Awaited<ReturnType<typeof judgeUnits>>,
  skipped: ReviewResult['skipped'],
  prDescription: string,
): Omit<ReviewResult, 'comment' | 'commentCostUsd'> {
  const units = judged.map((j) => j.res);
  const costs = judged.map((j) => j.call.costUsd);
  const checksVerdict: Verdict = checks.every((c) => c.ok) ? 'approve' : 'block';
  return {
    target,
    verdict: worst([checksVerdict, ...units.map((u) => u.verdict)]),
    baselineVerdict: worst(units.map((u) => u.baselineVerdict)),
    checks,
    units,
    skipped,
    prDescription,
    costUsd: costs.some((c) => c == null) ? null : costs.reduce<number>((a, b) => a + (b ?? 0), 0),
    jevRequests: judged.length,
    snapshot: judged[0]?.call.response.model ?? '',
    replayed: judged.every((j) => j.call.replayed),
  };
}

export interface ReviewOptions {
  lang?: 'en' | 'es';
  skipChecks?: boolean;
  noComment?: boolean;
  description?: string;
}

/** Revisión de un rango de git en local: deterministas primero, luego Jev por commit × archivo. */
export async function reviewRange(range: string, opts: ReviewOptions = {}): Promise<ReviewResult> {
  const { head } = resolveRange(range);
  const commits = commitsInRange(range);
  if (!commits.length) throw new Error(`No hay commits en ${range}`);
  const skipped: ReviewResult['skipped'] = [];
  const units = commits.flatMap((c) => unitsFrom(c.sha.slice(0, 7), c.message, c.declaredSubtask, c.files, skipped));
  const prDescription =
    opts.description ?? commits.map((c) => `- ${c.message.replace(/\n+/g, ' ').trim()}`).join('\n');

  // 1. Deterministas. Si fallan, se bloquea sin preguntarle a Jev.
  const checks = [scanSecrets(units), ...runRepoChecks(head, { skip: opts.skipChecks })];
  let judged: Awaited<ReturnType<typeof judgeUnits>> = [];
  if (checks.every((c) => c.ok)) judged = await judgeUnits(units, prDescription, opts.lang ?? 'en', 'review');
  const base = finish(range, checks, judged, skipped, prDescription);
  return withComment(base, opts);
}

async function withComment(base: Omit<ReviewResult, 'comment' | 'commentCostUsd'>, opts: ReviewOptions): Promise<ReviewResult> {
  // Haiku redacta el comentario SOLO si el veredicto no es aprobar.
  if (base.verdict === 'approve' || opts.noComment) return { ...base, comment: null, commentCostUsd: 0 };
  const c = await humanComment(base);
  return { ...base, comment: c.text, commentCostUsd: c.cost };
}

// ───────────────────────── Fixtures ─────────────────────────

export interface FixtureMeta {
  id: string;
  title: string;
  pr_description: string;
  commit_message: string;
  declared_subtask: string | null;
  expected: { jev: Verdict[]; baseline: Verdict };
}

export function loadFixtures(): { meta: FixtureMeta; diff: string }[] {
  const dir = path('fixtures', 'diffs');
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'meta.json')))
    .sort()
    .map((d) => ({ meta: JSON.parse(readFileSync(join(dir, d, 'meta.json'), 'utf8')) as FixtureMeta, diff: readFileSync(join(dir, d, 'change.diff'), 'utf8') }));
}

export interface FixtureOutcome {
  id: string;
  title: string;
  expected: Verdict[];
  expectedBaseline: Verdict;
  jev: Verdict;
  baseline: Verdict;
  opus?: Verdict;
  ok: boolean;
  result: ReviewResult;
}

export async function reviewFixtures(opts: ReviewOptions & { compareOpus?: boolean } = {}) {
  const outcomes: FixtureOutcome[] = [];
  for (const { meta, diff } of loadFixtures()) {
    const skipped: ReviewResult['skipped'] = [];
    const units = unitsFrom(meta.id, meta.commit_message, meta.declared_subtask, parseUnifiedDiff(diff), skipped);
    const checks = [scanSecrets(units)]; // los fixtures son diffs sueltos: no hay árbol para typecheck/tests
    const judged = checks[0].ok ? await judgeUnits(units, meta.pr_description, opts.lang ?? 'en', 'review-fixtures') : [];
    const result = await withComment(finish(`fixture ${meta.id}`, checks, judged, skipped, meta.pr_description), { ...opts, noComment: true });
    const o: FixtureOutcome = {
      id: meta.id,
      title: meta.title,
      expected: meta.expected.jev,
      expectedBaseline: meta.expected.baseline,
      jev: result.verdict,
      baseline: result.baselineVerdict,
      ok: meta.expected.jev.includes(result.verdict),
      result,
    };
    if (opts.compareOpus) o.opus = await opusVerdict(meta, diff);
    outcomes.push(o);
  }
  const summary = {
    jev: score(outcomes, (o) => o.jev),
    baseline: score(outcomes, (o) => o.baseline),
    ...(opts.compareOpus ? { opus: score(outcomes, (o) => o.opus!) } : {}),
  };
  const jevCost = outcomes.reduce((n, o) => n + (o.result.costUsd ?? 0), 0);
  for (const [method, s] of Object.entries(summary)) {
    appendJsonl('review-runs', {
      ts: new Date().toISOString(),
      runId: RUN_ID,
      method,
      lang: opts.lang ?? 'en',
      perFixture: Object.fromEntries(outcomes.map((o) => [o.id, method === 'jev' ? o.jev : method === 'baseline' ? o.baseline : o.opus])),
      expected: Object.fromEntries(outcomes.map((o) => [o.id, o.expected])),
      ...s,
      costUsd: method === 'jev' ? jevCost : method === 'baseline' ? 0 : opusCost,
    });
  }
  return { outcomes, summary, jevCost, opusCost };
}

/** Recall: positivos (esperado ≠ aprobar) marcados. Falsos positivos: negativos marcados. Exactos: veredicto dentro de lo esperado. */
function score(os: FixtureOutcome[], get: (o: FixtureOutcome) => Verdict) {
  const pos = os.filter((o) => !o.expected.includes('approve'));
  const neg = os.filter((o) => o.expected.includes('approve'));
  return {
    recall: pos.length ? pos.filter((o) => get(o) !== 'approve').length / pos.length : null,
    falsePositives: neg.filter((o) => get(o) !== 'approve').length,
    negatives: neg.length,
    exact: os.filter((o) => o.expected.includes(get(o))).length,
    total: os.length,
  };
}

let opusCost = 0;
/** Comparación: Opus revisando el mismo diff con "prompt y parseo". */
async function opusVerdict(meta: FixtureMeta, diff: string): Promise<Verdict> {
  const prompt =
    `Eres un revisor de código senior de un e-commerce (React + Express). Revisa este cambio antes de hacer merge.\n` +
    `Devuelve solo JSON: {"verdict": "approve" | "review" | "block", "reasons": ["..."]}.\n` +
    `block = no se puede mezclar (seguridad, dinero, contrato roto); review = necesita revisión humana; approve = se puede mezclar.\n\n` +
    `Descripción del PR:\n${meta.pr_description}\n\nCommit: ${meta.commit_message}\n\n\`\`\`diff\n${diff}\n\`\`\``;
  const r = await askClaude({ model: 'opus', prompt, maxTokens: 600, purpose: `review-baseline-opus:${meta.id}`, tag: 'review-fixtures' });
  opusCost += r.costUsd;
  try {
    const v = extractJson<{ verdict: Verdict }>(r.text).verdict;
    return ['approve', 'review', 'block'].includes(v) ? v : 'review';
  } catch {
    return 'review';
  }
}

// ───────────────────────── Reporte ─────────────────────────

export function writeReport(r: ReviewResult): string {
  mkdirSync(path('reports'), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..+/, '');
  const file = path('reports', `review-${stamp}.md`);
  const pct = (n: number) => n.toFixed(2);
  const lines = [
    `# Revisión local · ${r.target}`,
    '',
    `**Veredicto: ${VERDICT_ES[r.verdict]}** · baseline sin IA: ${VERDICT_ES[r.baselineVerdict]}`,
    '',
    `Fecha: ${new Date().toISOString()} · Jev: ${r.snapshot || '—'} · ${r.jevRequests} requests · costo Jev ${r.costUsd == null ? 'sin dato' : `$${r.costUsd.toFixed(6)}`}` +
      (r.commentCostUsd ? ` · comentario Haiku $${r.commentCostUsd.toFixed(6)}` : ''),
    '',
    '## Chequeos deterministas',
    '',
    '| Chequeo | Resultado | Detalle |',
    '|---|---|---|',
    ...r.checks.map((c) => `| ${c.name} | ${c.ok ? 'ok' : 'FALLA'} | ${c.detail.replace(/\|/g, '\\|')}${c.cached ? ' (caché)' : ''} |`),
    '',
    '## Por archivo',
    '',
    '| Commit | Archivo | Veredicto | Hallazgos | Baseline |',
    '|---|---|---|---|---|',
    ...r.units.map(
      (u) =>
        `| ${u.unit.group} | \`${u.unit.file}\` | ${VERDICT_ES[u.verdict]} | ${
          u.findings.map((f) => `${REVIEW_LABELS_ES[f.question as ReviewQuestionId] ?? f.question} (${pct(f.probability)})`).join(', ') || '—'
        } | ${u.baseline.map((b) => b.rule).join(', ') || '—'} |`,
    ),
    '',
    ...(r.skipped.length ? ['## Filtrados en código (no se mandaron a Jev)', '', ...r.skipped.map((s) => `- \`${s.file}\`: ${s.reason}`), ''] : []),
    ...(r.comment ? ['## Comentario para humanos (Haiku)', '', r.comment, ''] : []),
    '## Descripción del PR (evidencia, no política)',
    '',
    '```',
    r.prDescription,
    '```',
    '',
  ];
  writeFileSync(file, lines.join('\n'));
  return file;
}
