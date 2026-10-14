import { z } from 'zod';

/** Preguntas de Jev, tal como las define la documentación (sección 6). */
export type Entry = string | Record<string, unknown> | unknown[];
export type NoulQ = { type: 'noul'; instructions: Entry; criteria?: { true: Entry; false: Entry } };
export type ChoiceQ = { type: 'choice'; instructions: Entry; criteria: Record<string, Entry> };
export type ScoreQ = { type: 'score'; instructions: Entry; criteria: Entry[] };
export type JevQuestion = NoulQ | ChoiceQ | ScoreQ;
export type JevQuestions = Record<string, JevQuestion>;

const prob = z.number().min(0).max(1);
export const NoulAnswer = z.object({ type: z.literal('noul'), noul: prob });
export const ChoiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  confidence: prob,
  probabilities: z.record(z.string(), prob),
});
export const ScoreAnswer = z.object({
  type: z.literal('score'),
  score: z.number(),
  confidence: prob,
  probabilities: z.record(z.string(), prob),
  legend: z.record(z.string(), z.unknown()).optional(),
});
export const Answer = z.discriminatedUnion('type', [NoulAnswer, ChoiceAnswer, ScoreAnswer]);
export type NoulAnswer = z.infer<typeof NoulAnswer>;
export type ChoiceAnswer = z.infer<typeof ChoiceAnswer>;
export type ScoreAnswer = z.infer<typeof ScoreAnswer>;
export type Answer = z.infer<typeof Answer>;

/** Respuesta de la API nativa de TypeSafe (`model`, `answers`, `usage`). */
export const JevResponse = z.object({
  model: z.string(),
  answers: z.record(z.string(), Answer),
  usage: z
    .object({ input_tokens: z.number(), output_tokens: z.number().optional(), cost: z.number().optional() })
    .passthrough()
    .optional(),
  id: z.string().optional(),
  provider: z.string().optional(),
});
export type JevResponse = z.infer<typeof JevResponse>;
