import type { Verdict } from './verdict';

/**
 * Baseline sin IA: las reglas que un equipo pondría en un linter o en CODEOWNERS.
 * Sirve para comparar en el dashboard. No interviene en el veredicto de Jev.
 */
export interface BaselineHit {
  rule: string;
  verdict: Verdict;
}

export function baselineReview(unit: { file: string; added: string[]; removed: string[] }): BaselineHit[] {
  const hits: BaselineHit[] = [];
  if (unit.added.some((l) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(l))) hits.push({ rule: 'dangerouslySetInnerHTML/innerHTML agregado', verdict: 'block' });
  if (/(^|\/)(pricing|cart)\//.test(unit.file)) hits.push({ rule: 'archivo bajo pricing/ o cart/', verdict: 'review' });
  if (unit.removed.some((l) => /\balt=|aria-/.test(l))) hits.push({ rule: 'línea eliminada con alt= o aria-', verdict: 'review' });
  if (unit.added.some((l) => /sk-or-v1-|sk-ant-|AKIA[0-9A-Z]{16}|PRIVATE KEY-----/.test(l))) hits.push({ rule: 'secreto', verdict: 'block' });
  return hits;
}
