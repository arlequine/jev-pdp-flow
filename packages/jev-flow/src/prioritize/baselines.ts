import type { Ticket } from '@jev/contracts';
import { askClaude, extractJson } from '../anthropic/client';
import type { ClaudeAlias } from '../models';

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

/**
 * Baseline 3 y 4: "prompt y parseo". Se le pasa el ticket completo a un LLM y se le pide el orden en JSON.
 * Es la forma en que normalmente se haría sin Jev.
 */
export async function llmOrder(model: ClaudeAlias, ticketMd: string, ticket: Ticket): Promise<BaselineOrder> {
  const prompt =
    `Eres una Product Manager senior de un e-commerce. Este es un ticket con subtareas para mejorar la página de detalle de producto (PDP).\n` +
    `Ordénalas por prioridad para mejorar la conversión. Excluye las que no pertenezcan a la PDP.\n` +
    `Responde solo con JSON, sin texto adicional: {"order": ["PDP-142.N", ...], "excluded": ["PDP-142.N", ...]}\n\n` +
    `<ticket>\n${ticketMd}\n</ticket>`;
  const r = await askClaude({ model, prompt, maxTokens: 1024, purpose: `prioritize-baseline:${ticket.id}:${model}` });
  try {
    const j = extractJson<{ order: string[]; excluded?: string[] }>(r.text);
    const ids = new Set(ticket.subtasks.map((s) => s.id));
    return {
      method: `pedirle-a-${model}`,
      order: j.order.filter((id) => ids.has(id)),
      excluded: (j.excluded ?? []).filter((id) => ids.has(id)),
      costUsd: r.costUsd,
    };
  } catch {
    return { method: `pedirle-a-${model}`, order: [], excluded: [], costUsd: r.costUsd, note: 'respuesta no parseable' };
  }
}
