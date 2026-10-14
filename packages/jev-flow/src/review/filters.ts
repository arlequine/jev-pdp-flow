/** Lo que no vale la pena mandarle a Jev. Se filtra en código, antes de cualquier llamada. */
const IGNORED: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)(yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/,
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|pdf)$/i,
  /(^|\/)dist\//,
  /^recordings\//,
  /^metrics\//,
  /^reports\//,
  /^\.jev\//,
];

export function ignoreReason(file: string, status: string, binary: boolean): string | null {
  if (binary) return 'binario';
  if (status === 'deleted') return 'archivo eliminado (lo cubre el chequeo de contrato)';
  const hit = IGNORED.find((r) => r.test(file));
  return hit ? 'lockfile, snapshot, asset o generado' : null;
}
