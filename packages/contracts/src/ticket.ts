import { z } from 'zod';

export const Subtask = z.object({
  id: z.string().regex(/^[A-Z]+-\d+\.\d+$/),
  title: z.string(),
  author: z.object({ name: z.string(), role: z.string() }),
  estimate_points: z.number().positive(),
  depends_on: z.array(z.string()),
  description: z.string(),
  acceptance_criteria: z.array(z.string()),
});
export type Subtask = z.infer<typeof Subtask>;

export const Ticket = z.object({
  id: z.string(),
  type: z.literal('epic'),
  title: z.string(),
  author: z.object({ name: z.string(), role: z.string() }),
  context: z.string(),
  scope: z.object({ in: z.string(), out: z.string() }),
  subtasks: z.array(Subtask).min(8).max(10),
});
export type Ticket = z.infer<typeof Ticket>;

/** Verdad de referencia para evaluar la priorización. La escribe una persona, no un modelo. */
export const TicketTruth = z.object({
  ticket: z.string(),
  reference_order: z.array(z.string()),
  top3_set: z.array(z.string()).length(3),
  must_be_top2: z.string(),
  noise: z.object({ id: z.string(), min_position: z.number().int() }),
  injection: z.object({ id: z.string(), control_description: z.string() }),
  out_of_scope: z.string(),
  notes: z.record(z.string(), z.string()),
});
export type TicketTruth = z.infer<typeof TicketTruth>;
