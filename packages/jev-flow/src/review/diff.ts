import { execFileSync } from 'node:child_process';
import { ROOT } from '../config';

export interface FileDiff {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  binary: boolean;
  /** Diff unificado de este archivo (desde la primera línea @@). */
  patch: string;
  added: string[];
  removed: string[];
}

export interface CommitDiff {
  sha: string;
  subject: string;
  message: string;
  declaredSubtask: string | null;
  files: FileDiff[];
}

/** Parte un diff unificado (`git show` / `.diff`) en archivos. */
export function parseUnifiedDiff(text: string): FileDiff[] {
  const chunks = text.split(/^diff --git /m).slice(1);
  return chunks.map((c) => {
    const header = c.slice(0, c.indexOf('\n'));
    const m = header.match(/^a\/(.+?) b\/(.+)$/);
    const file = m ? m[2] : header;
    const status: FileDiff['status'] = /^new file mode/m.test(c)
      ? 'added'
      : /^deleted file mode/m.test(c)
        ? 'deleted'
        : /^rename from/m.test(c)
          ? 'renamed'
          : 'modified';
    const binary = /^Binary files /m.test(c);
    const at = c.indexOf('\n@@');
    const patch = at === -1 ? '' : c.slice(at + 1).trimEnd();
    const lines = patch.split('\n');
    return {
      file,
      status,
      binary,
      patch,
      added: lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)),
      removed: lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1)),
    };
  });
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/**
 * "main..refactor/pdp" → commits desde el merge-base.
 * Se compara contra el merge-base (como `main...rama`): commits nuevos en main no aparecen como eliminados.
 */
export function resolveRange(range: string): { base: string; head: string; mergeBase: string } {
  const m = range.match(/^(.+?)\.\.\.?(.+)$/);
  if (!m) throw new Error(`Rango inválido "${range}". Usa base..rama, por ejemplo main..refactor/pdp`);
  const [, base, head] = m;
  const mergeBase = git('merge-base', base, head).trim();
  return { base, head, mergeBase };
}

export const SUBTASK_RE = /^([A-Z]+-\d+\.\d+):/;

export function commitsInRange(range: string): CommitDiff[] {
  const { head, mergeBase } = resolveRange(range);
  const shas = git('rev-list', '--reverse', `${mergeBase}..${head}`).split('\n').filter(Boolean);
  return shas.map((sha) => {
    const message = git('log', '-1', '--format=%B', sha).trim();
    const subject = message.split('\n')[0];
    const patch = git('show', '--format=', '--no-color', '--unified=3', '--find-renames', sha);
    return { sha, subject, message, declaredSubtask: subject.match(SUBTASK_RE)?.[1] ?? null, files: parseUnifiedDiff(patch) };
  });
}

export const headSha = (ref: string) => git('rev-parse', ref).trim();
export const treeSha = (ref: string) => git('rev-parse', `${ref}^{tree}`).trim();
