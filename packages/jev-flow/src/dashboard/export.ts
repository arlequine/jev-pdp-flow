/**
 * npm run dashboard:export → metrics/charts/<sección>.png
 * Captura cada sección del dashboard para insertarla en las diapositivas.
 * Si existe docs/brand/brand.json, usa los colores del tema de la plantilla (?brand=1).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { path } from '../config';
import { metricsDir } from '../metrics/log';
import { dashboardServer } from './server';

const CHROME = existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;
const out = join(metricsDir(), 'charts');
mkdirSync(out, { recursive: true });
const server = dashboardServer().listen(0);
const port = (server.address() as { port: number }).port;
const brand = existsSync(path('docs', 'brand', 'brand.json'));
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await page.goto(`http://localhost:${port}/?export=1${brand ? '&brand=1' : ''}`, { waitUntil: 'networkidle' });
await page.waitForSelector('body[data-ready="1"]');
for (const id of ['prioritize', 'refactor', 'review', 'before-after', 'models']) {
  const el = page.locator(`#sec-${id}`);
  if ((await el.count()) && (await el.isVisible())) {
    await el.screenshot({ path: join(out, `${id}.png`) });
    console.log(`metrics/charts/${id}.png`);
  }
}
await browser.close();
server.close();
