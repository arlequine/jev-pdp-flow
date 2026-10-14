import type { Ticket } from '@jev/contracts';

export interface BaselineOrder {
  method: string;
  order: string[];
  excluded: string[];
  costUsd: number;
  note?: string;
}

/** Baseline 1: el orden en que vienen en el ticket. */
export const ticketOrder = (t: Ticket): BaselineOrder => ({
  method: 'orden-del-ticket',
  order: t.subtasks.map((s) => s.id),
  excluded: [],
  costUsd: 0,
});

/** Baseline 2: lo que grita "URGENTE" primero, luego el orden del ticket. */
export const urgentFirst = (t: Ticket): BaselineOrder => {
  const loud = (s: Ticket['subtasks'][number]) => /urgente|!!!/i.test(`${s.title} ${s.description}`);
  return {
    method: 'urgente-primero',
    order: [...t.subtasks.filter(loud), ...t.subtasks.filter((s) => !loud(s))].map((s) => s.id),
    excluded: [],
    costUsd: 0,
  };
};

/** Prompt de "prompt y parseo": el ticket completo y la petición del orden en JSON. Lo usa la comparación con Opus. */
export const llmOrderPrompt = (ticketMd: string) =>
  `Eres una Product Manager senior de un e-commerce. Este es un ticket con subtareas para mejorar la página de detalle de producto (PDP).\n` +
  `Ordénalas por prioridad para mejorar la conversión. Excluye las que no pertenezcan a la PDP.\n` +
  `Responde solo con JSON, sin texto adicional: {"order": ["PDP-142.N", ...], "excluded": ["PDP-142.N", ...]}\n\n` +
  `<ticket>\n${ticketMd}\n</ticket>`;
