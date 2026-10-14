/**
 * npm run metrics [-- --after <ref>]
 *
 * Mide la PDP "antes" (tag pdp-before) y "después" (por defecto HEAD) con builds de producción:
 * requests a la API, tiempo hasta ver el precio y hasta terminar de cargar (red móvil simulada),
 * accesibilidad de Lighthouse, tamaño del bundle (gzip) y líneas del componente principal.
 * Guarda capturas en metrics/before-after/ y el resultado en metrics/before-after.json(l).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { chromium, type Browser } from 'playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { ROOT, git, removeWorktree, start, stop, waitFor, worktree } from './lib/worktree';

const args = process.argv.slice(2);
const afterRef = args.includes('--after') ? args[args.indexOf('--after') + 1] : 'HEAD';
const SLUG = 'sudadera-basica';
const RUNS = 3;
const OUT = join(ROOT, 'metrics', 'before-after');
mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH ?? (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
// Red móvil simulada (aprox. "4G lento" de Lighthouse): 150 ms de RTT, 1.6 Mbps de bajada.
const NETWORK = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

interface Measure {
  label: string;
  ref: string;
  sha: string;
  apiRequests: number;
  apiPaths: string[];
  timeToPriceMs: number;
  timeToCompleteMs: number;
  a11yScore: number;
  bundleGzipKb: number;
  componentLines: number;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function measure(label: 'antes' | 'después', ref: string, port: number, apiPort: number, browser: Browser): Promise<Measure> {
  const dir = worktree(`metrics-${label === 'antes' ? 'before' : 'after'}`, ref);
  try {
    const web = join(dir, 'apps/web');
    execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: web, stdio: 'inherit' });
    const assets = join(web, 'dist', 'assets');
    const bundleGzipKb = readdirSync(assets)
      .filter((f) => /\.(js|css)$/.test(f))
      .reduce((n, f) => n + gzipSync(readFileSync(join(assets, f))).length, 0) / 1024;
    const componentLines = readFileSync(join(web, 'src/pages/ProductPage.tsx'), 'utf8').split('\n').length - 1;

    const preview = start('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], web, { API_URL: `http://localhost:${apiPort}` });
    const url = `http://localhost:${port}/product/${SLUG}`;
    await waitFor(`http://localhost:${port}/`);
    try {
      const runs: { requests: string[]; price: number; complete: number }[] = [];
      for (let i = 0; i < RUNS; i++) {
        const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', NETWORK);
        const requests: string[] = [];
        let lastApiEnd = 0;
        page.on('request', (r) => r.url().includes('/api/') && requests.push(new URL(r.url()).pathname));
        page.on('requestfinished', (r) => r.url().includes('/api/') && (lastApiEnd = Date.now()));
        const t0 = Date.now();
        await page.goto(url, { waitUntil: 'commit' });
        await page.locator('[data-testid="price"], .price').first().waitFor({ state: 'visible', timeout: 30_000 });
        const price = Date.now() - t0;
        await page.waitForLoadState('networkidle');
        runs.push({ requests, price, complete: Math.max(lastApiEnd - t0, price) });
        await ctx.close();
      }

      // Capturas sin throttling, con el banner de cookies aceptado en "después" si existe el botón.
      for (const [name, vp] of [
        ['desktop', { width: 1280, height: 900 }],
        ['mobile', { width: 375, height: 812 }],
      ] as const) {
        const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.screenshot({ path: join(OUT, `${label === 'antes' ? 'before' : 'after'}-${name}.png`) });
        await ctx.close();
      }

      // Lighthouse: solo la categoría de accesibilidad, perfil móvil.
      const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ['--headless=new', '--no-sandbox'] });
      let a11yScore = 0;
      try {
        const r = await lighthouse(url, { port: chrome.port, onlyCategories: ['accessibility'], logLevel: 'error', formFactor: 'mobile', output: 'json' });
        a11yScore = Math.round((r?.lhr.categories.accessibility.score ?? 0) * 100);
      } finally {
        await chrome.kill();
      }

      return {
        label,
        ref,
        sha: git('rev-parse', '--short', ref),
        apiRequests: median(runs.map((r) => r.requests.length)),
        apiPaths: runs[0].requests,
        timeToPriceMs: median(runs.map((r) => r.price)),
        timeToCompleteMs: median(runs.map((r) => r.complete)),
        a11yScore,
        bundleGzipKb: Math.round(bundleGzipKb * 10) / 10,
        componentLines,
      };
    } finally {
      stop(preview);
    }
  } finally {
    removeWorktree(dir);
  }
}

// La misma API (la de "después", que conserva los endpoints legacy) atiende a las dos versiones.
const apiDir = worktree('metrics-api', afterRef);
const API_PORT = 4010;
const api = start('npx', ['tsx', 'src/server.ts'], join(apiDir, 'apps/api'), { API_PORT: String(API_PORT), API_LATENCY_MS: '0' });
await waitFor(`http://localhost:${API_PORT}/health`);
const browser = await chromium.launch({ executablePath: CHROME });
try {
  console.log(`Midiendo antes (pdp-before) y después (${afterRef})… unos 2 minutos.`);
  const before = await measure('antes', 'pdp-before', 4174, API_PORT, browser);
  const after = await measure('después', afterRef, 4173, API_PORT, browser);
  const result = { ts: new Date().toISOString(), slug: SLUG, network: '150 ms RTT, 1.6 Mbps (móvil simulado)', runs: RUNS, before, after };
  writeFileSync(join(ROOT, 'metrics', 'before-after.json'), JSON.stringify(result, null, 2) + '\n');
  appendFileSync(join(ROOT, 'metrics', 'before-after.jsonl'), JSON.stringify(result) + '\n');
  const row = (k: string, f: (m: Measure) => string | number) => console.log(`${k.padEnd(28)} ${String(f(before)).padStart(10)}  →  ${String(f(after)).padStart(10)}`);
  console.log(`\n${''.padEnd(28)} ${'antes'.padStart(10)}     ${'después'.padStart(10)}`);
  row('Requests a la API', (m) => m.apiRequests);
  row('Tiempo hasta ver el precio', (m) => `${m.timeToPriceMs} ms`);
  row('Tiempo hasta carga completa', (m) => `${m.timeToCompleteMs} ms`);
  row('Accesibilidad (Lighthouse)', (m) => m.a11yScore);
  row('Bundle JS+CSS (gzip)', (m) => `${m.bundleGzipKb} KB`);
  row('Líneas de ProductPage.tsx', (m) => m.componentLines);
  console.log(`\nCapturas en metrics/before-after/ · datos en metrics/before-after.json`);
} finally {
  await browser.close();
  stop(api);
  removeWorktree(apiDir);
}
process.exit(0);
