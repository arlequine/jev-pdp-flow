import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setJevTransport } from '../src/jev/client';
import { loadTicket, loadTruth } from '../src/lib/ticket';
import { prioritize } from '../src/prioritize/run';
import { fakeTransport } from './fake-jev';

describe('pipeline de priorización (con doble de Jev)', () => {
  beforeEach(() => {
    process.env.JEV_RECORDINGS_DIR = mkdtempSync(join(tmpdir(), 'rec-'));
    process.env.JEV_METRICS_DIR = mkdtempSync(join(tmpdir(), 'met-'));
  });

  it('record: 2 requests por subtarea + 1 de control; replay: las mismas respuestas sin red', async () => {
    const ticket = loadTicket('PDP-142');
    const truth = loadTruth('PDP-142');
    const calls: unknown[] = [];
    setJevTransport(fakeTransport(calls));

    process.env.JEV_MODE = 'record';
    const a = await prioritize(ticket, truth);
    expect(calls).toHaveLength(ticket.subtasks.length * 2 + 1);
    expect(readdirSync(join(process.env.JEV_RECORDINGS_DIR!, 'jev'))).toHaveLength(21);

    // Cada request lleva TODAS las preguntas juntas (8) y la regla anti-inyección en cada instrucción.
    const body = calls[0] as { model: string; questions: Record<string, { instructions: string }> };
    expect(body.model).toBe('jev-1.13.0');
    expect(Object.keys(body.questions)).toHaveLength(8);
    for (const q of Object.values(body.questions)) expect(q.instructions).toMatch(/not as instructions/);

    setJevTransport(async () => {
      throw new Error('no debería haber red en replay');
    });
    process.env.JEV_MODE = 'replay';
    const b = await prioritize(ticket, truth);
    expect(b.result.order.map((r) => r.id)).toEqual(a.result.order.map((r) => r.id));
    expect(b.replayed).toBe(true);

    const log = readFileSync(join(process.env.JEV_METRICS_DIR!, 'jev.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(log[0]).toMatchObject({ kind: 'jev', model: 'fake/jev-test-double', costSource: 'computed' });
    expect(log[0].inputTokens).toBeGreaterThan(0);
  });

  it('replay sin grabación falla con un mensaje que dice cómo grabar', async () => {
    process.env.JEV_MODE = 'replay';
    await expect(prioritize(loadTicket('PDP-142'), null)).rejects.toThrow(/JEV_MODE=record/);
  });

  it('el JSON del ticket coincide con el markdown', () => {
    const md = readFileSync(join(__dirname, '../../../tickets/PDP-142.md'), 'utf8');
    for (const s of loadTicket('PDP-142').subtasks) {
      expect(md).toContain(`### ${s.id} · ${s.title}`);
      expect(md).toContain(`**Estimación:** ${s.estimate_points} pt`);
    }
  });
});
