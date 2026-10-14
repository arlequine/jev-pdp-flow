import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, path } from '../config';
import { treeSha } from './diff';

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  cached?: boolean;
}

/** Patrones de secretos. Se buscan solo en líneas agregadas. */
export const SECRET_PATTERNS: [string, RegExp][] = [
  ['OpenRouter key', /sk-or-v1-[A-Za-z0-9]{20,}/],
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['API key tipo sk-', /\bsk-(live|proj|test)?[-_]?[A-Za-z0-9]{24,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Llave privada', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
];

export function scanSecrets(units: { file: string; added: string[] }[]): CheckResult {
  const hits: string[] = [];
  for (const u of units) {
    if (/(^|\/)\.env(\.(?!example$)[^/]+)?$/.test(u.file)) hits.push(`${u.file}: archivo .env agregado`);
    u.added.forEach((line) => {
      for (const [name, re] of SECRET_PATTERNS) if (re.test(line)) hits.push(`${u.file}: ${name}`);
    });
  }
  return { name: 'secretos (regex)', ok: hits.length === 0, detail: hits.length ? hits.join('; ') : 'sin coincidencias' };
}

/**
 * typecheck, contrato y tests en la punta de la rama, en un git worktree temporal
 * que reutiliza los node_modules del checkout principal. Se cachea por árbol de git.
 */
export function runRepoChecks(ref: string, opts: { skip?: boolean } = {}): CheckResult[] {
  if (opts.skip) return [{ name: 'typecheck + tests', ok: true, detail: 'omitidos con --skip-checks' }];
  const tree = treeSha(ref);
  const cacheDir = path('.jev', 'cache');
  const cacheFile = join(cacheDir, `checks-${tree}.json`);
  if (existsSync(cacheFile)) return (JSON.parse(readFileSync(cacheFile, 'utf8')) as CheckResult[]).map((c) => ({ ...c, cached: true }));

  const wt = path('.jev', 'worktrees', `review-${tree.slice(0, 10)}`);
  rmSync(wt, { recursive: true, force: true });
  spawnSync('git', ['worktree', 'prune'], { cwd: ROOT });
  execFileSync('git', ['worktree', 'add', '--detach', '--force', wt, ref], { cwd: ROOT, stdio: 'ignore' });
  try {
    for (const nm of ['node_modules', 'apps/web/node_modules', 'apps/api/node_modules', 'packages/jev-flow/node_modules', 'packages/contracts/node_modules']) {
      if (existsSync(path(nm)) && !existsSync(join(wt, nm))) symlinkSync(path(nm), join(wt, nm), 'dir');
    }
    const run = (name: string, args: string[]): CheckResult => {
      const r = spawnSync('npm', args, { cwd: wt, encoding: 'utf8', env: { ...process.env, JEV_MODE: 'replay', NO_COLOR: '1', FORCE_COLOR: '0' } });
      const out = `${r.stdout}\n${r.stderr}`;
      const fail = out
        .split('\n')
        .filter((l) => /error TS|FAIL|✗|×|AssertionError|Error:/.test(l))
        .slice(0, 5)
        .join(' | ');
      return { name, ok: r.status === 0, detail: r.status === 0 ? 'ok' : fail || `salió con código ${r.status}` };
    };
    const results = [
      run('typecheck', ['run', '-s', 'typecheck']),
      run('contrato API ↔ web', ['run', '-s', 'test:contract']),
      run('tests', ['run', '-s', 'test:unit']),
    ];
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(results, null, 2));
    return results;
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: ROOT });
  }
}
