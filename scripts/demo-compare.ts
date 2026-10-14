/**
 * npm run demo:compare
 *
 * Sirve la PDP "antes" (tag pdp-before, en un git worktree) en :5174 junto a la rama actual en :5173,
 * y abre compare.html con las dos lado a lado (escritorio y móvil) y el panel de métricas.
 * Ctrl-C para terminar.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, isUp, start, waitFor, worktree } from './lib/worktree';

const PORT = 4310;
if (!(await isUp('http://localhost:4000/health')) || !(await isUp('http://localhost:5173/'))) {
  console.log('La rama actual no está corriendo; levanto npm run dev (API :4000, web :5173)…');
  start('npm', ['run', 'dev'], ROOT);
  await waitFor('http://localhost:4000/health');
  await waitFor('http://localhost:5173/');
}

const before = worktree('compare-before', 'pdp-before');
start('npx', ['vite', '--port', '5174', '--strictPort'], join(before, 'apps/web'), { API_URL: 'http://localhost:4000' });
await waitFor('http://localhost:5174/');

createServer((req, res) => {
  if (req.url === '/before-after.json') {
    const f = join(ROOT, 'metrics', 'before-after.json');
    if (!existsSync(f)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(readFileSync(f));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(join(ROOT, 'scripts', 'compare.html')));
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\nAntes  → http://localhost:5174/product/sudadera-basica (pdp-before)`);
  console.log(`Después → http://localhost:5173/product/sudadera-basica (rama actual)`);
  console.log(`Comparación → ${url}\n(Ctrl-C para terminar)`);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  if (!process.env.NO_OPEN) spawn(opener, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).on('error', () => {});
});
