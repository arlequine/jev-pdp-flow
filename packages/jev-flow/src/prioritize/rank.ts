import type { Subtask } from '@jev/contracts';
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from '../jev/types';
import {
  HARD_RULE_MIN_PROB,
  LEGAL_TIEBREAK_MIN_PROB,
  OUT_OF_SCOPE_MIN_PROB,
  PM_FLAGS,
  WEIGHTS,
} from '../thresholds';

/** Respuestas de Jev para una subtarea (una request) + la corrida de `area` con opciones invertidas. */
export interface Signals {
  id: string;
  area: ChoiceAnswer;
  areaReversed: ChoiceAnswer;
  conversion_impact: ScoreAnswer;
  user_pain: ScoreAnswer;
  risk_of_change: ScoreAnswer;
  touches_money: NoulAnswer;
  legal_or_compliance: NoulAnswer;
  blocks_purchase: NoulAnswer;
  cosmetic_only: NoulAnswer;
}

export interface RankedRow {
  id: string;
  title: string;
  estimate: number;
  depends_on: string[];
  group: 'regla' | 'fórmula' | 'excluida';
  value: number;
  priority: number;
  reason: string;
  needsPm: boolean;
  pmReasons: string[];
  key: {
    area: string;
    areaProb: number;
    outOfScope: number;
    money: number;
    blocks: number;
    legal: number;
    cosmetic: number;
    conversion: number;
    pain: number;
    risk: number;
  };
}

export interface RankResult {
  order: RankedRow[];
  excluded: RankedRow[];
}

const f2 = (n: number) => n.toFixed(2);
const s1 = (n: number) => n.toFixed(1);

/** Valor de la fórmula (Score normalizado a 0–1 dividiendo entre el nivel máximo). */
export function formulaValue(sig: Signals): number {
  const norm = (a: ScoreAnswer) => a.score / (Object.keys(a.probabilities).length - 1);
  return (
    WEIGHTS.conversion_impact * norm(sig.conversion_impact) +
    WEIGHTS.user_pain * norm(sig.user_pain) +
    WEIGHTS.legal_or_compliance * sig.legal_or_compliance.noul +
    WEIGHTS.risk_of_change * norm(sig.risk_of_change) +
    WEIGHTS.cosmetic_only * sig.cosmetic_only.noul
  );
}

export function pmReasons(sig: Signals): string[] {
  const r: string[] = [];
  if (sig.area.confidence < PM_FLAGS.areaMinConfidence) r.push(`área poco clara (confianza ${f2(sig.area.confidence)})`);
  const pick = sig.area.choice;
  if (sig.areaReversed.choice !== pick) r.push(`el área cambia al invertir las opciones (${pick} → ${sig.areaReversed.choice})`);
  else if (Math.abs((sig.areaReversed.probabilities[pick] ?? 0) - sig.area.probabilities[pick]) > PM_FLAGS.orderBiasMaxDelta)
    r.push(`sesgo de orden en el área (${f2(sig.area.probabilities[pick])} vs ${f2(sig.areaReversed.probabilities[pick] ?? 0)})`);
  const [lo, hi] = PM_FLAGS.hardRuleGrayZone;
  for (const [k, label] of [
    ['touches_money', 'toca dinero'],
    ['blocks_purchase', 'bloquea la compra'],
  ] as const) {
    const p = sig[k].noul;
    if (p >= lo && p < hi) r.push(`dudoso si ${label} (${f2(p)})`);
  }
  for (const [k, label] of [
    ['conversion_impact', 'impacto'],
    ['user_pain', 'dolor'],
    ['risk_of_change', 'riesgo'],
  ] as const)
    if (sig[k].confidence < PM_FLAGS.scoreMinConfidence) r.push(`${label} poco claro (confianza ${f2(sig[k].confidence)})`);
  return r;
}

/**
 * Orden final, todo en código:
 * 1. Exclusión por fuera de alcance (antes que cualquier regla).
 * 2. Reglas duras: toca dinero o bloquea la compra → grupo prioritario (legal primero).
 * 3. Fórmula con pesos ÷ √estimación para el resto (y como desempate).
 * 4. Orden topológico con las dependencias declaradas en el ticket.
 * 5. Marca "necesita PM" si la señal es dudosa (no cambia el orden).
 */
export function rank(subtasks: Subtask[], signals: Signals[]): RankResult {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const rows: RankedRow[] = subtasks.map((t) => {
    const sig = byId.get(t.id);
    if (!sig) throw new Error(`Faltan respuestas de Jev para ${t.id}`);
    const value = formulaValue(sig);
    const key = {
      area: sig.area.choice,
      areaProb: sig.area.probabilities[sig.area.choice],
      outOfScope: sig.area.probabilities.out_of_scope ?? 0,
      money: sig.touches_money.noul,
      blocks: sig.blocks_purchase.noul,
      legal: sig.legal_or_compliance.noul,
      cosmetic: sig.cosmetic_only.noul,
      conversion: sig.conversion_impact.score,
      pain: sig.user_pain.score,
      risk: sig.risk_of_change.score,
    };
    const excluded = sig.area.choice === 'out_of_scope' && key.outOfScope >= OUT_OF_SCOPE_MIN_PROB;
    const rule = !excluded && (key.money >= HARD_RULE_MIN_PROB || key.blocks >= HARD_RULE_MIN_PROB);
    const pm = excluded ? [] : pmReasons(sig);
    return {
      id: t.id,
      title: t.title,
      estimate: t.estimate_points,
      depends_on: t.depends_on,
      group: excluded ? 'excluida' : rule ? 'regla' : 'fórmula',
      value,
      priority: value / Math.sqrt(t.estimate_points),
      reason: '',
      needsPm: pm.length > 0,
      pmReasons: pm,
      key,
    };
  });

  const excluded = rows.filter((r) => r.group === 'excluida');
  const ruleGroup = rows
    .filter((r) => r.group === 'regla')
    .sort((a, b) => {
      const la = a.key.legal >= LEGAL_TIEBREAK_MIN_PROB ? 1 : 0;
      const lb = b.key.legal >= LEGAL_TIEBREAK_MIN_PROB ? 1 : 0;
      return lb - la || b.priority - a.priority;
    });
  const formulaGroup = rows.filter((r) => r.group === 'fórmula').sort((a, b) => b.priority - a.priority);
  const preferred = [...ruleGroup, ...formulaGroup];

  const order = topoSort(preferred, new Set(excluded.map((r) => r.id)));
  order.forEach((r, i) => (r.reason = reasonFor(r, i, order)));
  excluded.forEach((r) => (r.reason = `Fuera del alcance de la PDP (${f2(r.key.outOfScope)}). Se excluye antes de aplicar las reglas.`));
  return { order, excluded };
}

/**
 * Kahn con preferencia: en cada paso toma la primera subtarea de la lista preferida
 * cuyas dependencias ya están colocadas. Las dependencias hacia subtareas excluidas se ignoran.
 */
export function topoSort<T extends { id: string; depends_on: string[] }>(preferred: T[], ignore = new Set<string>()): T[] {
  const placed = new Set<string>();
  const pending = [...preferred];
  const out: T[] = [];
  const known = new Set(preferred.map((p) => p.id));
  while (pending.length) {
    const i = pending.findIndex((t) => t.depends_on.every((d) => placed.has(d) || ignore.has(d) || !known.has(d)));
    if (i === -1) throw new Error(`Dependencias circulares entre: ${pending.map((p) => p.id).join(', ')}`);
    const [t] = pending.splice(i, 1);
    placed.add(t.id);
    out.push(t);
  }
  return out;
}

function reasonFor(r: RankedRow, idx: number, order: RankedRow[]): string {
  const parts: string[] = [];
  if (r.group === 'regla') {
    const why: string[] = [];
    const nums: string[] = [];
    if (r.key.money >= HARD_RULE_MIN_PROB) (why.push('toca dinero'), nums.push(f2(r.key.money)));
    if (r.key.blocks >= HARD_RULE_MIN_PROB) (why.push('bloquea la compra'), nums.push(f2(r.key.blocks)));
    if (r.key.legal >= LEGAL_TIEBREAK_MIN_PROB) (why.push('es legal o de cumplimiento'), nums.push(f2(r.key.legal)));
    const txt = why.length > 1 ? `${why.slice(0, -1).join(', ')} y ${why.at(-1)}` : why[0];
    parts.push(`${txt[0].toUpperCase()}${txt.slice(1)} (${nums.join(' / ')}). Va arriba por regla.`);
  } else {
    parts.push(`Impacto ${s1(r.key.conversion)}/3, dolor ${s1(r.key.pain)}/3, riesgo ${s1(r.key.risk)}/3.`);
    if (r.key.legal >= LEGAL_TIEBREAK_MIN_PROB) parts.push(`Cumplimiento (${f2(r.key.legal)}).`);
    if (r.key.cosmetic >= 0.7) parts.push(`Solo estético (${f2(r.key.cosmetic)}).`);
    parts.push(`Valor ${f2(r.value)} ÷ √${r.estimate} pts.`);
  }
  const before = order.slice(0, idx).map((o) => o.id);
  const waits = r.depends_on.filter((d) => before.includes(d));
  if (waits.length) parts.push(`Después de ${waits.join(', ')} (dependencia).`);
  if (r.needsPm) parts.push(`Necesita PM: ${r.pmReasons.join('; ')}.`);
  return parts.join(' ');
}
