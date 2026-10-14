import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { askClaudeCode } from '../src/claudecode/run';
import { costUsd } from '../src/prices';

describe('Claude Code headless (claude -p) con record/replay', () => {
  beforeEach(() => {
    process.env.JEV_RECORDINGS_DIR = mkdtempSync(join(tmpdir(), 'rec-'));
    process.env.CLAUDE_BIN = join(__dirname, 'fake-claude.mjs');
  });

  it('lee texto, duración, tokens y costo; replay devuelve lo mismo sin ejecutar claude', async () => {
    process.env.JEV_MODE = 'record';
    const a = await askClaudeCode({ model: 'opus', prompt: 'ordena', purpose: 'test' });
    expect(a.durationMs).toBe(8421);
    expect(a.reportedCostUsd).toBe(0.1234);
    expect(a.model).toBe('claude-opus-5-5');
    expect(a.costUsd).toBeCloseTo(costUsd('claude-opus-5-5', { input: 4, output: 180, cacheWrite: 3000, cacheRead: 15000 }), 10);
    expect(a.text).toContain('PDP-142.10');

    process.env.CLAUDE_BIN = '/no/existe';
    process.env.JEV_MODE = 'replay';
    const b = await askClaudeCode({ model: 'opus', prompt: 'ordena', purpose: 'test' });
    expect(b).toMatchObject({ durationMs: 8421, replayed: true, text: a.text });
  });
});
