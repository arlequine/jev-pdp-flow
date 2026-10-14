import { mkdirSync, writeFileSync } from 'node:fs';
import type { Ticket, TicketTruth } from '@jev/contracts';
import { path } from '../config';
import { askJev } from '../jev/client';
import { prioritizeQuestions, prioritizeState, reversedAreaQuestions } from '../jev/questions/prioritize';
import { prioritizeQuestionsEs, reversedAreaQuestionsEs } from '../jev/questions/prioritize.es';
import type { ChoiceAnswer, JevResponse, NoulAnswer, ScoreAnswer } from '../jev/types';
import { pool } from '../lib/table';
import { RUN_ID, appendJsonl } from '../metrics/log';
import { INJECTION_MAX_DELTA } from '../thresholds';
import { evaluateOrder, type Evaluation } from './evaluate';
import { rank, type RankResult, type Signals } from './rank';

export interface PrioritizeRun {
  ticket: string;
  lang: 'en' | 'es';
  result: RankResult;
  signals: Signals[];
  injection: { id: string; delta: number; worst: string } | null;
  evaluation: Evaluation | null;
  costUsd: number | null;
  requests: number;
  inputTokens: number;
  replayed: boolean;
  snapshot: string;
  /** Tiempo de respuesta de la priorización completa (ms). En replay se reconstruye con las latencias grabadas. */
  latencyMs: number;
  latencySource: 'medido' | 'grabado';
}

const toSignals = (id: string, main: JevResponse, rev: JevResponse): Signals => ({
  id,
  area: main.answers.area as ChoiceAnswer,
  areaReversed: rev.answers.area as ChoiceAnswer,
  conversion_impact: main.answers.conversion_impact as ScoreAnswer,
  user_pain: main.answers.user_pain as ScoreAnswer,
  risk_of_change: main.answers.risk_of_change as ScoreAnswer,
  touches_money: main.answers.touches_money as NoulAnswer,
  legal_or_compliance: main.answers.legal_or_compliance as NoulAnswer,
  blocks_purchase: main.answers.blocks_purchase as NoulAnswer,
  cosmetic_only: main.answers.cosmetic_only as NoulAnswer,
});

const CONCURRENCY = 5;

/** Reconstruye el tiempo total con las latencias grabadas: mismo pool de 5, y el control al final. */
export function simulateWall(perSubtask: number[], controlMs: number) {
  const workers = new Array(CONCURRENCY).fill(0);
  for (const ms of perSubtask) {
    const i = workers.indexOf(Math.min(...workers));
    workers[i] += ms;
  }
  return Math.round(Math.max(...workers) + controlMs);
}

/** Máxima diferencia de probabilidad entre dos respuestas a las mismas preguntas (Noul y Score normalizado). */
export function maxDelta(a: JevResponse, b: JevResponse): { delta: number; worst: string } {
  let delta = 0;
  let worst = '';
  for (const [k, x] of Object.entries(a.answers)) {
    const y = b.answers[k];
    let d = 0;
    if (x.type === 'noul' && y?.type === 'noul') d = Math.abs(x.noul - y.noul);
    else if (x.type === 'score' && y?.type === 'score') d = Math.abs(x.score - y.score) / (Object.keys(x.probabilities).length - 1);
    else if (x.type === 'choice' && y?.type === 'choice')
      d = Math.max(...Object.keys(x.probabilities).map((o) => Math.abs(x.probabilities[o] - (y.probabilities[o] ?? 0))));
    if (d > delta) (delta = d), (worst = k);
  }
  return { delta, worst };
}

/**
 * Priorización completa de un ticket:
 * - 1 request por subtarea con las 8 preguntas (speculative fan-out);
 * - 1 request por subtarea con `area` y las opciones invertidas (sesgo de orden);
 * - 1 request de control para la subtarea con inyección, sin la inyección.
 */
export async function prioritize(ticket: Ticket, truth: TicketTruth | null, lang: 'en' | 'es' = 'en'): Promise<PrioritizeRun> {
  const qs = lang === 'en' ? prioritizeQuestions() : prioritizeQuestionsEs();
  const qsRev = lang === 'en' ? reversedAreaQuestions() : reversedAreaQuestionsEs();
  const tag = `prioritize:${lang}`;

  const t0 = performance.now();
  const results = await pool(ticket.subtasks, CONCURRENCY, async (s) => {
    const state = prioritizeState(ticket, s);
    const [main, rev] = await Promise.all([
      askJev({ state, questions: qs, purpose: `prioritize:${s.id}`, tag }),
      askJev({ state, questions: qsRev, purpose: `prioritize-order-bias:${s.id}`, tag }),
    ]);
    return { s, main, rev };
  });

  let injection: PrioritizeRun['injection'] = null;
  const calls = results.flatMap((r) => [r.main, r.rev]);
  if (truth) {
    const target = results.find((r) => r.s.id === truth.injection.id);
    if (target) {
      const control = await askJev({
        state: prioritizeState(ticket, target.s, truth.injection.control_description),
        questions: qs,
        purpose: `prioritize-injection-control:${target.s.id}`,
        tag,
      });
      calls.push(control);
      injection = { id: target.s.id, ...maxDelta(target.main.response, control.response) };
    }
  }

  const wallMs = Math.round(performance.now() - t0);
  const signals = results.map((r) => toSignals(r.s.id, r.main.response, r.rev.response));
  const result = rank(ticket.subtasks, signals);
  const evaluation = truth
    ? evaluateOrder(result.order.map((r) => r.id), result.excluded.map((r) => r.id), truth, injection?.delta ?? null, INJECTION_MAX_DELTA)
    : null;
  const costs = calls.map((c) => c.costUsd);
  const run: PrioritizeRun = {
    ticket: ticket.id,
    lang,
    result,
    signals,
    injection,
    evaluation,
    costUsd: costs.some((c) => c == null) ? null : costs.reduce<number>((a, b) => a + (b ?? 0), 0),
    requests: calls.length,
    inputTokens: calls.reduce((n, c) => n + (c.response.usage?.input_tokens ?? 0), 0),
    replayed: calls.every((c) => c.replayed),
    snapshot: calls[0]?.response.model ?? '',
    latencyMs: calls.every((c) => c.replayed) ? simulateWall(results.map((r) => Math.max(r.main.latencyMs, r.rev.latencyMs)), calls.length > results.length * 2 ? calls.at(-1)!.latencyMs : 0) : wallMs,
    latencySource: calls.every((c) => c.replayed) ? 'grabado' : 'medido',
  };

  appendJsonl('prioritize-runs', {
    ts: new Date().toISOString(),
    runId: RUN_ID,
    method: lang === 'en' ? 'jev' : 'jev-es',
    ticket: ticket.id,
    order: result.order.map((r) => r.id),
    excluded: result.excluded.map((r) => r.id),
    needsPm: result.order.filter((r) => r.needsPm).map((r) => r.id),
    evaluation,
    injection,
    costUsd: run.costUsd,
    requests: run.requests,
    inputTokens: run.inputTokens,
    replayed: run.replayed,
    snapshot: run.snapshot,
    latencyMs: run.latencyMs,
    latencySource: run.latencySource,
  });
  return run;
}

/** Escribe .jev/plan.json, que lee la skill pdp-refactor. */
export function writePlan(run: PrioritizeRun, ticket: Ticket) {
  mkdirSync(path('.jev'), { recursive: true });
  const plan = {
    ticket: ticket.id,
    title: ticket.title,
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    jevSnapshot: run.snapshot,
    costUsd: run.costUsd,
    order: run.result.order.map((r, i) => {
      const s = ticket.subtasks.find((x) => x.id === r.id)!;
      return {
        position: i + 1,
        id: r.id,
        title: r.title,
        estimate_points: r.estimate,
        depends_on: r.depends_on,
        group: r.group,
        reason: r.reason,
        needs_pm: r.needsPm,
        acceptance_criteria: s.acceptance_criteria,
        commit_message: `${r.id}: ${s.title}`,
      };
    }),
    excluded: run.result.excluded.map((r) => ({ id: r.id, title: r.title, reason: r.reason })),
  };
  writeFileSync(path('.jev', 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
  return plan;
}
