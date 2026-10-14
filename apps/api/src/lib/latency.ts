import type { RequestHandler } from 'express';

/**
 * Latencia simulada por request, igual para todos los endpoints (legacy y nuevos),
 * para que la diferencia entre 4 requests en cascada y 1 request sea visible en local.
 * API_LATENCY_MS=0 la desactiva (los tests la desactivan).
 */
export const latency = (ms = Number(process.env.API_LATENCY_MS ?? 120)): RequestHandler =>
  (_req, _res, next) => (ms > 0 ? setTimeout(next, ms) : next());
