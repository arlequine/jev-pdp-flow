/** Errores de los CLIs: mensaje claro en lugar de un stack trace (con DEBUG=1 se ve el stack). */
process.on('uncaughtException', (e: Error) => {
  console.error(`\n\x1b[31m${e.message}\x1b[0m`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
export {};
