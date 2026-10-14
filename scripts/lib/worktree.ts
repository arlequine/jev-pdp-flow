import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const git = (...a: string[]) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Worktree de un ref en .jev/worktrees/<name>, reutilizando los node_modules del checkout principal. */
export function worktree(name: string, ref: string): string {
  const dir = join(ROOT, '.jev', 'worktrees', name);
  if (existsSync(dir)) {
    spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT });
    rmSync(dir, { recursive: true, force: true });
  }
  spawnSync('git', ['worktree', 'prune'], { cwd: ROOT });
  execFileSync('git', ['worktree', 'add', '--detach', '--force', dir, ref], { cwd: ROOT, stdio: 'ignore' });
  for (const nm of ['node_modules', 'apps/web/node_modules', 'apps/api/node_modules', 'packages/jev-flow/node_modules', 'packages/contracts/node_modules'])
    if (existsSync(join(ROOT, nm)) && !existsSync(join(dir, nm))) symlinkSync(join(ROOT, nm), join(dir, nm), 'dir');
  return dir;
}

export function removeWorktree(dir: string) {
  spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT });
}

const children: ChildProcess[] = [];
process.on('exit', () => children.forEach((c) => c.pid && killTree(c.pid)));
process.on('SIGINT', () => process.exit(130));
const killTree = (pid: number) => {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {}
};

/** Lanza un proceso en su propio grupo (para poder matarlo con sus hijos). */
export function start(cmd: string, args: string[], cwd: string, env: Record<string, string> = {}, quiet = true): ChildProcess {
  const c = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: quiet ? 'ignore' : 'inherit' });
  children.push(c);
  return c;
}
export const stop = (c: ChildProcess) => c.pid && killTree(c.pid);

export async function waitFor(url: string, timeoutMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No respondió ${url} en ${timeoutMs / 1000}s`);
}

export async function isUp(url: string) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}
