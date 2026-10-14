import { existsSync, readFileSync } from 'node:fs';
import { path } from '../config';
import { CLAUDE } from '../models';
import { PRICES, PRICES_AS_OF, costUsd } from '../prices';
import { readJsonl, type CallLog } from '../metrics/log';
import type { Evaluation } from '../prioritize/evaluate';

/** Todo lo que muestran `npm run cost` y el dashboard sale de aquí, y todo sale de metrics/*.jsonl. */

interface PrioritizeRunRow {
  ts: string;
  runId: string;
  method: string;
  order: string[];
  excluded: string[];
  evaluation: Evaluation;
  costUsd: number | null;
  requests?: number;
  inputTokens?: number;
  replayed?: boolean;
}
interface ReviewRunRow {
  ts: string;
  runId: string;
  method: string;
  recall: number | null;
  falsePositives: number;
  negatives: number;
  exact: number;
  total: number;
  costUsd: number;
  perFixture: Record<string, string>;
}
interface ClaudeCodeRow {
  ts: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  branch?: string;
  turns?: number;
}

const lastBy = <T, K>(rows: T[], key: (r: T) => K) => {
  const m = new Map<K, T>();
  for (const r of rows) m.set(key(r), r);
  return [...m.values()];
};
const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const lastRunId = (rows: CallLog[], command: string) => rows.filter((r) => r.command === command).at(-1)?.runId;

export function aggregate() {
  const jev = readJsonl<CallLog>('jev');
  const anthropic = readJsonl<CallLog>('anthropic');
  const ccRaw = readJsonl<ClaudeCodeRow>('claude-code');
  const pRuns = readJsonl<PrioritizeRunRow>('prioritize-runs');
  const rRuns = readJsonl<ReviewRunRow>('review-runs');

  // ── 1. Priorización: la última corrida de cada método ──
  const prioritize = lastBy(pRuns, (r) => r.method).map((r) => ({
    method: r.method,
    passed: r.evaluation?.passed ?? null,
    total: r.evaluation?.total ?? 5,
    spearman: r.evaluation?.spearman ?? null,
    checks: r.evaluation ? { top3: r.evaluation.top3, top2: r.evaluation.top2, noise: r.evaluation.noise, injection: r.evaluation.injection, outOfScope: r.evaluation.outOfScope } : null,
    order: r.order,
    excluded: r.excluded,
    costUsd: r.costUsd,
    ts: r.ts,
  }));

  // ── 2. Refactor: Claude Code (Stop hook) + plan B por API ──
  const sessions = lastBy(ccRaw, (r) => `${r.sessionId}:${r.model}`).map((s) => ({
    ...s,
    costUsd: safeCost(s.model, { input: s.inputTokens, output: s.outputTokens, cacheWrite: s.cacheWriteTokens, cacheRead: s.cacheReadTokens }),
    opusUsd: costUsd(CLAUDE.opus, { input: s.inputTokens, output: s.outputTokens, cacheWrite: s.cacheWriteTokens, cacheRead: s.cacheReadTokens }),
  }));
  const apiRefactor = anthropic.filter((r) => r.purpose.startsWith('refactor:'));
  const refactorRows = [
    ...sessions.map((s) => ({ source: `Claude Code ${s.sessionId.slice(0, 8)}`, model: s.model, inputTokens: s.inputTokens + s.cacheWriteTokens + s.cacheReadTokens, outputTokens: s.outputTokens, costUsd: s.costUsd, opusUsd: s.opusUsd })),
    ...apiRefactor.map((r) => ({
      source: r.purpose.replace(/^refactor:/, 'API '),
      model: r.model,
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      costUsd: r.costUsd,
      opusUsd: costUsd(CLAUDE.opus, { input: r.inputTokens ?? 0, output: r.outputTokens ?? 0 }),
    })),
  ];

  // ── 3. Revisión: fixtures (última corrida por método) + última revisión de rama ──
  const review = lastBy(rRuns, (r) => r.method).map((r) => ({ method: r.method, recall: r.recall, falsePositives: r.falsePositives, negatives: r.negatives, exact: r.exact, total: r.total, costUsd: r.costUsd, perFixture: r.perFixture }));
  const lastReview = lastRunId(jev, 'review');
  const branchReview = lastReview
    ? {
        jevUsd: sum(jev.filter((r) => r.runId === lastReview).map((r) => r.costUsd)),
        jevRequests: jev.filter((r) => r.runId === lastReview).length,
        haikuUsd: sum(anthropic.filter((r) => r.runId === lastReview && r.purpose.startsWith('review-comment')).map((r) => r.costUsd)),
      }
    : null;

  // ── 4. Antes / después ──
  const ba = path('metrics', 'before-after.json');
  const beforeAfter = existsSync(ba) ? JSON.parse(readFileSync(ba, 'utf8')) : null;

  // ── Totales por modelo ──
  const byModel = new Map<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>();
  const add = (model: string, i: number, o: number, c: number) => {
    const k = normalizeModel(model);
    const cur = byModel.get(k) ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    byModel.set(k, { calls: cur.calls + 1, inputTokens: cur.inputTokens + i, outputTokens: cur.outputTokens + o, costUsd: cur.costUsd + c });
  };
  for (const r of [...jev, ...anthropic]) add(r.model, r.inputTokens ?? 0, r.outputTokens ?? 0, r.costUsd ?? 0);
  for (const s of sessions) add(s.model, s.inputTokens + s.cacheWriteTokens + s.cacheReadTokens, s.outputTokens, s.costUsd ?? 0);

  const snapshots = [...new Set(jev.map((r) => r.model))];
  return {
    generatedAt: new Date().toISOString(),
    pricesAsOf: PRICES_AS_OF,
    prices: PRICES,
    snapshots,
    hasData: jev.length + anthropic.length + ccRaw.length > 0,
    prioritize,
    refactor: { rows: refactorRows, totalUsd: sum(refactorRows.map((r) => r.costUsd)), opusUsd: sum(refactorRows.map((r) => r.opusUsd)) },
    review,
    branchReview,
    beforeAfter,
    byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.costUsd - a.costUsd),
    jevCostUnknown: jev.filter((r) => r.costUsd == null).length,
  };
}

const normalizeModel = (m: string) => {
  if (/jev/.test(m)) return 'Jev 1.13';
  if (/haiku/.test(m)) return 'Haiku 5.5';
  if (/sonnet/.test(m)) return 'Sonnet 5.5';
  if (/opus/.test(m)) return 'Opus 5.5';
  return m;
};
const safeCost = (model: string, t: Parameters<typeof costUsd>[1]) => {
  try {
    return costUsd(model, t);
  } catch {
    return null;
  }
};

export type Aggregate = ReturnType<typeof aggregate>;
