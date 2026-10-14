#!/usr/bin/env node
/**
 * Hook PreToolUse de Claude Code (matcher: Bash).
 * Intercepta `git merge … refactor/*` y `git push … main`, corre la revisión local con Jev
 * y bloquea con exit code 2 si el veredicto no es APROBAR.
 * Así el bloqueo no depende de que el asistente coopere: lo aplica el harness.
 *
 * Entrada (stdin): JSON con tool_name y tool_input.command.
 */
import { execFileSync, spawnSync } from 'node:child_process';

const raw = await new Promise((resolve) => {
  let s = '';
  process.stdin.on('data', (d) => (s += d));
  process.stdin.on('end', () => resolve(s));
});

let input = {};
try {
  input = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}
if (input.tool_name && input.tool_name !== 'Bash') process.exit(0);
const cmd = String(input.tool_input?.command ?? '');
const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

// Un comando puede encadenar varios con && ; || o saltos de línea: revisamos cada uno.
const parts = cmd.split(/&&|\|\||;|\n/).map((s) => s.trim()).filter(Boolean);
let range = null;
for (const p of parts) {
  const merge = p.match(/^git\s+(?:-C\s+\S+\s+)?merge\b(.*)$/);
  if (merge) {
    const branch = merge[1].split(/\s+/).find((t) => t && !t.startsWith('-') && /(^|\/)refactor\//.test(t));
    if (branch) {
      const current = git('rev-parse', '--abbrev-ref', 'HEAD');
      range = `${current}..${branch.replace(/^origin\//, '')}`;
    }
  }
  const push = p.match(/^git\s+(?:-C\s+\S+\s+)?push\b(.*)$/);
  if (push) {
    const args = push[1].split(/\s+/).filter((t) => t && !t.startsWith('-'));
    const refspec = args.slice(1).join(' ');
    const current = git('rev-parse', '--abbrev-ref', 'HEAD');
    const toMain = /(^|:|\s)(refs\/heads\/)?main$/.test(refspec) || (args.length <= 1 && current === 'main');
    if (toMain) {
      const src = refspec.includes(':') ? refspec.split(':')[0] || 'HEAD' : 'HEAD';
      let base = 'origin/main';
      try {
        git('rev-parse', '--verify', base);
      } catch {
        base = 'pdp-before';
      }
      range = `${base}..${src === 'main' ? 'HEAD' : src}`;
    }
  }
}
if (!range) process.exit(0);

const r = spawnSync('npm', ['run', '-s', 'review', '--', range, '--json', '--no-comment'], {
  cwd,
  encoding: 'utf8',
  env: { ...process.env, NO_COLOR: '1' },
  maxBuffer: 32 * 1024 * 1024,
});
const line = (r.stdout || '').trim().split('\n').reverse().find((l) => l.startsWith('{'));
let out = null;
try {
  out = JSON.parse(line ?? '');
} catch {}

if (!out) {
  // Si la revisión no pudo correr, no dejamos pasar el merge: fallar cerrado.
  console.error(`Revisión local no disponible para ${range}; bloqueo por seguridad.\n${(r.stderr || '').slice(-800)}`);
  process.exit(2);
}
if (out.verdict === 'approve') process.exit(0);

const why = out.units
  .filter((u) => u.verdict !== 'approve')
  .map((u) => `- ${u.file} (${u.commit}): ${u.findings.map((f) => `${f.question} p=${f.probability.toFixed(2)}`).join(', ')}`)
  .concat(out.checks.filter((c) => !c.ok).map((c) => `- chequeo ${c.name}: ${c.detail}`))
  .join('\n');
console.error(
  `Merge bloqueado por la revisión local de Jev: ${out.verdict === 'block' ? 'BLOQUEAR' : 'REVISAR'} (${range}).\n${why}\n` +
    `Reporte: ${out.report}\nNo reintentes el merge: corrige el cambio o pide a una persona que revise el reporte.`,
);
process.exit(2);
