import { REVIEW_BLOCK, REVIEW_INVERTED, REVIEW_MAX_VERDICT, REVIEW_REVIEW } from '../thresholds';

export type Verdict = 'approve' | 'review' | 'block';
export const VERDICT_ES: Record<Verdict, string> = { approve: 'APROBAR', review: 'REVISAR', block: 'BLOQUEAR' };
const RANK: Record<Verdict, number> = { approve: 0, review: 1, block: 2 };
export const worst = (vs: Verdict[]): Verdict => vs.reduce<Verdict>((a, b) => (RANK[b] > RANK[a] ? b : a), 'approve');

export interface Finding {
  question: string;
  probability: number;
  risk: number;
  verdict: Verdict;
}

/** Riesgo por pregunta y veredicto de una unidad. Umbrales en thresholds.ts. */
export function judge(answers: Record<string, number>): { verdict: Verdict; findings: Finding[]; risks: Record<string, number> } {
  const risks: Record<string, number> = {};
  const findings: Finding[] = [];
  for (const [q, p] of Object.entries(answers)) {
    const risk = (REVIEW_INVERTED as readonly string[]).includes(q) ? 1 - p : p;
    risks[q] = risk;
    let v: Verdict = risk >= REVIEW_BLOCK ? 'block' : risk >= REVIEW_REVIEW ? 'review' : 'approve';
    const cap = REVIEW_MAX_VERDICT[q];
    if (cap && RANK[v] > RANK[cap]) v = cap;
    if (v !== 'approve') findings.push({ question: q, probability: p, risk, verdict: v });
  }
  findings.sort((a, b) => b.risk - a.risk);
  return { verdict: worst(findings.map((f) => f.verdict)), findings, risks };
}
