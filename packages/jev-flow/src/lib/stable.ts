import { createHash } from 'node:crypto';

export const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Llave de una request. Usa JSON.stringify tal cual (respeta el orden de inserción) a propósito:
 * en una pregunta Choice el orden de las opciones importa, y la corrida con las opciones
 * invertidas debe tener su propia grabación.
 */
export const requestKey = (payload: unknown) => sha(JSON.stringify(payload)).slice(0, 20);
