import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setJevTransport } from '../src/jev/client';
import { baselineReview } from '../src/review/baseline';
import { parseUnifiedDiff } from '../src/review/diff';
import { scanSecrets } from '../src/review/deterministic';
import { ignoreReason } from '../src/review/filters';
import { loadFixtures, reviewFixtures } from '../src/review/run';
import { judge } from '../src/review/verdict';
import { fakeTransport } from './fake-jev';

describe('veredicto (umbrales de thresholds.ts)', () => {
  it('≥ 0.8 bloquea, ≥ 0.4 revisa, el resto aprueba', () => {
    expect(judge({ renders_unsanitized_html: 0.85 }).verdict).toBe('block');
    expect(judge({ renders_unsanitized_html: 0.45 }).verdict).toBe('review');
    expect(judge({ renders_unsanitized_html: 0.1, matches_declared_subtask: 0.9 }).verdict).toBe('approve');
  });
  it('matches_declared_subtask se invierte y nunca pasa de "revisar"', () => {
    expect(judge({ matches_declared_subtask: 0.02 }).verdict).toBe('review');
  });
});

describe('filtros, secretos y baseline', () => {
  it('filtra lockfiles, snapshots, assets y borrados', () => {
    expect(ignoreReason('package-lock.json', 'modified', false)).toBeTruthy();
    expect(ignoreReason('apps/web/test/__snapshots__/a.snap', 'modified', false)).toBeTruthy();
    expect(ignoreReason('apps/web/public/img/x.svg', 'added', false)).toBeTruthy();
    expect(ignoreReason('apps/api/src/x.ts', 'deleted', false)).toBeTruthy();
    expect(ignoreReason('apps/api/src/x.ts', 'modified', false)).toBeNull();
  });
  it('detecta secretos solo en líneas agregadas', () => {
    expect(scanSecrets([{ file: 'a.ts', added: ['const k = "sk-or-v1-abcdefghijklmnopqrstuvwxyz0123"'] }]).ok).toBe(false);
    expect(scanSecrets([{ file: '.env', added: ['X=1'] }]).ok).toBe(false);
    expect(scanSecrets([{ file: '.env.example', added: ['OPENROUTER_API_KEY='] }]).ok).toBe(true);
  });
  it('el baseline por carpeta marca d03 y no ve d02', () => {
    const fx = Object.fromEntries(loadFixtures().map((f) => [f.meta.id, parseUnifiedDiff(f.diff)]));
    expect(fx.d03.flatMap(baselineReview).map((h) => h.verdict)).toContain('review');
    expect(fx.d02.flatMap(baselineReview)).toHaveLength(0);
    expect(fx.d01.flatMap(baselineReview).map((h) => h.verdict)).toContain('block');
  });
});

describe('fixtures con el doble de Jev (prueba la tubería, no la calidad de Jev)', () => {
  beforeEach(() => {
    process.env.JEV_RECORDINGS_DIR = mkdtempSync(join(tmpdir(), 'rec-'));
    process.env.JEV_METRICS_DIR = mkdtempSync(join(tmpdir(), 'met-'));
    process.env.JEV_MODE = 'live';
  });
  it('una request por archivo, 7 preguntas, sin llamar a Haiku en fixtures', async () => {
    const calls: { questions: Record<string, unknown>; state: { evidence: { pr_description: string } } }[] = [];
    setJevTransport(fakeTransport(calls as unknown[]));
    const { outcomes } = await reviewFixtures();
    expect(outcomes.map((o) => o.id)).toEqual(['d01', 'd02', 'd03', 'd04', 'd05']);
    expect(calls).toHaveLength(9);
    expect(Object.keys(calls[0].questions)).toHaveLength(7);
    expect(calls[0].state.evidence.pr_description).toMatch(/aprobado por seguridad/);
    expect(outcomes.find((o) => o.id === 'd01')!.jev).toBe('block');
  });
});
