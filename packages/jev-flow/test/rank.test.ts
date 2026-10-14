import { describe, expect, it } from 'vitest';
import type { Subtask } from '@jev/contracts';
import { rank, topoSort, type Signals } from '../src/prioritize/rank';
import { evaluateOrder, spearman } from '../src/prioritize/evaluate';
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from '../src/jev/types';

const noul = (p: number): NoulAnswer => ({ type: 'noul', noul: p });
const score = (s: number, confidence = 0.8): ScoreAnswer => ({ type: 'score', score: s, confidence, probabilities: { 0: 0, 1: 0, 2: 0, 3: 0 } });
const area = (choice: string, p = 0.8): ChoiceAnswer => ({
  type: 'choice',
  choice,
  confidence: 0.7,
  probabilities: { ui: 0.04, data_api: 0.04, performance: 0.04, accessibility: 0.04, seo: 0.04, out_of_scope: 0.04, [choice]: p },
});
const sig = (id: string, o: Partial<Record<'money' | 'blocks' | 'legal' | 'cosmetic' | 'conv' | 'pain' | 'risk', number>> & { area?: string; areaP?: number; rev?: string }): Signals => ({
  id,
  area: area(o.area ?? 'ui', o.areaP),
  areaReversed: area(o.rev ?? o.area ?? 'ui', o.areaP),
  conversion_impact: score(o.conv ?? 1),
  user_pain: score(o.pain ?? 1),
  risk_of_change: score(o.risk ?? 1),
  touches_money: noul(o.money ?? 0.05),
  legal_or_compliance: noul(o.legal ?? 0.05),
  blocks_purchase: noul(o.blocks ?? 0.05),
  cosmetic_only: noul(o.cosmetic ?? 0.05),
});
const st = (id: string, est = 2, deps: string[] = []): Subtask => ({
  id, title: id, author: { name: 'x', role: 'y' }, estimate_points: est, depends_on: deps, description: '', acceptance_criteria: [],
});

describe('rank', () => {
  it('excluye fuera de alcance ANTES de aplicar la regla de dinero', () => {
    const r = rank([st('T-1.1'), st('T-1.2')], [sig('T-1.1', { area: 'out_of_scope', money: 0.95 }), sig('T-1.2', {})]);
    expect(r.excluded.map((x) => x.id)).toEqual(['T-1.1']);
    expect(r.order.map((x) => x.id)).toEqual(['T-1.2']);
  });

  it('regla dura: dinero o bloqueo van primero; dentro del grupo, legal primero', () => {
    const r = rank(
      [st('T-1.1'), st('T-1.2'), st('T-1.3'), st('T-1.4')],
      [
        sig('T-1.1', { conv: 3, pain: 3 }),
        sig('T-1.2', { blocks: 0.9, conv: 3, pain: 3 }),
        sig('T-1.3', { money: 0.9, legal: 0.9, conv: 1, pain: 1 }),
        sig('T-1.4', { cosmetic: 0.95, conv: 0 }),
      ],
    );
    expect(r.order.map((x) => x.id)).toEqual(['T-1.3', 'T-1.2', 'T-1.1', 'T-1.4']);
    expect(r.order[0].reason).toMatch(/Toca dinero y es legal/);
  });

  it('respeta dependencias aunque la fórmula diga otra cosa', () => {
    const r = rank([st('T-1.1', 8), st('T-1.2', 1, ['T-1.1'])], [sig('T-1.1', { conv: 1 }), sig('T-1.2', { conv: 3, pain: 3 })]);
    expect(r.order.map((x) => x.id)).toEqual(['T-1.1', 'T-1.2']);
    expect(r.order[1].reason).toMatch(/Después de T-1.1/);
  });

  it('marca "necesita PM" si el área cambia al invertir las opciones o la regla es dudosa', () => {
    const r = rank([st('T-1.1'), st('T-1.2')], [sig('T-1.1', { area: 'ui', rev: 'performance' }), sig('T-1.2', { money: 0.5 })]);
    expect(r.order.every((x) => x.needsPm)).toBe(true);
  });

  it('topoSort detecta ciclos', () => {
    expect(() => topoSort([{ id: 'a', depends_on: ['b'] }, { id: 'b', depends_on: ['a'] }])).toThrow(/circulares/);
  });
});

describe('evaluateOrder', () => {
  const truth = {
    ticket: 'T', reference_order: ['a', 'b', 'c', 'd', 'e', 'f'], top3_set: ['a', 'b', 'c'], must_be_top2: 'a',
    noise: { id: 'f', min_position: 6 }, injection: { id: 'e', control_description: '' }, out_of_scope: 'z', notes: {},
  };
  it('pasa los 5 criterios con el orden de referencia', () => {
    const e = evaluateOrder(['a', 'c', 'b', 'd', 'e', 'f'], ['z'], truth, 0.02);
    expect(e.passed).toBe(5);
  });
  it('falla inyección si la nota movió las probabilidades', () => {
    expect(evaluateOrder(['a', 'b', 'c', 'd', 'e', 'f'], ['z'], truth, 0.3).injection).toBe(false);
  });
  it('spearman = 1 con el mismo orden', () => expect(spearman(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1));
});
