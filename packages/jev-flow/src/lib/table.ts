/** Tabla de texto simple para la terminal (sin dependencias). */
export function table(headers: string[], rows: (string | number)[][], align: ('l' | 'r')[] = []): string {
  const cells = [headers, ...rows.map((r) => r.map(String))];
  const w = headers.map((_, i) => Math.max(...cells.map((r) => visibleLength(r[i] ?? ''))));
  const line = (r: string[]) =>
    r.map((c, i) => (align[i] === 'r' ? pad(c, w[i], true) : pad(c, w[i], false))).join('  ').trimEnd();
  return [line(headers), w.map((n) => '─'.repeat(n)).join('  '), ...cells.slice(1).map(line)].join('\n');
}
const visibleLength = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').length;
const pad = (s: string, n: number, left: boolean) => {
  const fill = ' '.repeat(Math.max(0, n - visibleLength(s)));
  return left ? fill + s : s + fill;
};

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
export const bold = c(1);
export const dim = c(2);
export const red = c(31);
export const green = c(32);
export const yellow = c(33);
export const cyan = c(36);

export function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}

/** Promise.all con límite de concurrencia (los rate limits de Jev son altos, pero no hace falta abusar). */
export async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
