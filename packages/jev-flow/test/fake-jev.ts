/**
 * DOBLE DE PRUEBA de Jev. NO es Jev ni imita sus probabilidades reales:
 * responde con heurísticas de palabras clave para probar el código que rodea a Jev
 * (cassettes, validación, ranking, veredictos). Nunca se usa fuera de los tests.
 */
import type { JevTransport } from '../src/jev/client';
import type { JevQuestions } from '../src/jev/types';

const has = (s: string, ...w: string[]) => w.some((x) => s.includes(x));

export function fakeAnswers(state: unknown, questions: JevQuestions) {
  const ev = JSON.stringify((state as { evidence?: unknown }).evidence ?? state).toLowerCase();
  const answers: Record<string, unknown> = {};
  for (const [id, q] of Object.entries(questions)) {
    if (q.type === 'noul') {
      const yes: Record<string, boolean> = {
        touches_money: has(ev, 'iva', 'precio sale', 'stock 0', 'agotado'),
        legal_or_compliance: has(ev, 'profeco', 'wcag', 'legal'),
        blocks_purchase: has(ev, 'no se puede tocar', 'tapa por completo'),
        cosmetic_only: has(ev, 'naranja'),
        renders_unsanitized_html: has(ev, 'dangerouslysetinnerhtml') && !has(ev, 'dompurify'),
        trusts_client_price: has(ev, 'total:') && has(ev, '/api/cart'),
        breaks_api_contract: false,
        removes_accessibility: has(ev, '-          alt=', '-        alt=', '-  aria-'),
        missing_loading_or_error_state: false,
        leaks_secret_or_pii: has(ev, 'sk-live'),
        matches_declared_subtask: true,
      };
      answers[id] = { type: 'noul', noul: yes[id] ? 0.93 : 0.06 };
    } else if (q.type === 'choice') {
      const opts = Object.keys(q.criteria);
      const pick = has(ev, 'checkout', 'cupón') ? 'out_of_scope' : has(ev, 'wcag') ? 'accessibility' : has(ev, 'seo') ? 'seo' : has(ev, 'endpoint') ? 'data_api' : 'ui';
      const probabilities = Object.fromEntries(opts.map((o) => [o, o === pick ? 0.8 : 0.2 / (opts.length - 1)]));
      answers[id] = { type: 'choice', choice: pick, confidence: (0.8 - 1 / opts.length) / (1 - 1 / opts.length), probabilities };
    } else {
      const n = q.criteria.length;
      let level = 1;
      if (id === 'conversion_impact' || id === 'user_pain') level = has(ev, 'iva', 'no se puede tocar', 'stock 0') ? 3 : has(ev, '4 s', 'wcag') ? 2 : has(ev, 'naranja') ? 0 : 1;
      if (id === 'risk_of_change') level = has(ev, 'iva', 'endpoint') ? 3 : 1;
      const probabilities = Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), i === level ? 0.85 : 0.15 / (n - 1)]));
      answers[id] = { type: 'score', score: level, confidence: 0.8, probabilities, legend: {} };
    }
  }
  return answers;
}

export const fakeTransport = (calls: unknown[] = []): JevTransport => async (provider, body) => {
  calls.push(body);
  const tokens = Math.ceil(JSON.stringify(body).length / 4);
  return {
    model: 'fake/jev-test-double',
    answers: fakeAnswers(body.state, body.questions),
    usage: { input_tokens: tokens, output_tokens: 0, ...(provider === 'openrouter' ? { cost: (tokens * 0.042) / 1e6 } : {}) },
  };
};
