/**
 * npm run ticket:publish-gh -- PDP-142 [--repo owner/repo] [--dry-run]
 *
 * OPCIONAL: publica el epic y sus subtareas como issues de GitHub con `gh`.
 * La demo no depende de esto: todo corre desde tickets/*.json.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/worktree';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--')) ?? 'PDP-142';
const dry = args.includes('--dry-run');
const repo = args.includes('--repo') ? ['--repo', args[args.indexOf('--repo') + 1]] : [];
const t = JSON.parse(readFileSync(join(ROOT, 'tickets', `${id}.json`), 'utf8'));

const gh = (a: string[]) => (dry ? (console.log('gh', a.map((x) => (x.length > 60 ? JSON.stringify(x.slice(0, 57) + '…') : x)).join(' ')), 'https://github.com/dry-run/1') : execFileSync('gh', [...a, ...repo], { encoding: 'utf8' }).trim());

const urls: Record<string, string> = {};
for (const s of t.subtasks) {
  const body =
    `**Autor:** ${s.author.name} (${s.author.role}) · **Estimación:** ${s.estimate_points} pts` +
    (s.depends_on.length ? ` · **Depende de:** ${s.depends_on.join(', ')}` : '') +
    `\n\n${s.description}\n\n**Criterios de aceptación**\n${s.acceptance_criteria.map((c: string) => `- [ ] ${c}`).join('\n')}\n\n_Parte de ${t.id}._`;
  urls[s.id] = gh(['issue', 'create', '--title', `${s.id} · ${s.title}`, '--body', body]);
  console.log(`${s.id} → ${urls[s.id]}`);
}
const epic = `${t.context}\n\n**Dentro:** ${t.scope.in}\n\n**Fuera:** ${t.scope.out}\n\n## Subtareas\n${t.subtasks.map((s: { id: string; title: string }) => `- [ ] ${urls[s.id]} ${s.title}`).join('\n')}`;
console.log(`${t.id} → ${gh(['issue', 'create', '--title', `${t.id} · ${t.title}`, '--body', epic])}`);
