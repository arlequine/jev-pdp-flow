/**
 * npm run dashboard → http://localhost:4300
 * Cuatro secciones: priorización, refactor, revisión y antes/después. Todo sale de metrics/*.jsonl.
 */
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { path } from '../config';
import { metricsDir } from '../metrics/log';
import { aggregate } from '../cost/aggregate';

const here = fileURLToPath(new URL('.', import.meta.url));

export function dashboardServer(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/api/data') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(JSON.stringify(aggregate()));
      } else if (url.pathname === '/api/brand') {
        // Paleta de la plantilla para exportar las gráficas del deck (docs/brand/patterns.json → dashboard).
        const f = path('docs', 'brand', 'patterns.json');
        const overrides = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).dashboard ?? null : null;
        res.writeHead(overrides ? 200 : 404, { 'content-type': 'application/json' }).end(JSON.stringify({ dashboard_overrides: overrides }));
      } else if (url.pathname.startsWith('/before-after/')) {
        const f = normalize(join(metricsDir(), 'before-after', url.pathname.slice('/before-after/'.length)));
        if (!f.startsWith(normalize(join(metricsDir(), 'before-after'))) || !existsSync(f)) return void res.writeHead(404).end();
        res.writeHead(200, { 'content-type': 'image/png' }).end(readFileSync(f));
      } else {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(join(here, 'index.html')));
      }
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(String(e));
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.DASHBOARD_PORT ?? 4300);
  dashboardServer().listen(port, () => console.log(`Dashboard en http://localhost:${port}  (Ctrl-C para terminar)`));
}
