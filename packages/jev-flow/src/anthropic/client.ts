import Anthropic from '@anthropic-ai/sdk';
import { requireEnv } from '../config';
import { CLAUDE, type ClaudeAlias } from '../models';
import { costUsd } from '../prices';
import { withCassette } from '../replay/cassette';
import { logCall } from '../metrics/log';

export interface AskClaudeInput {
  model: ClaudeAlias;
  system?: string;
  prompt: string;
  maxTokens: number;
  purpose: string;
  tag?: string;
}

export interface AskClaudeOutput {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  replayed: boolean;
}

interface StoredMessage {
  model: string;
  content: { type: string; text?: string }[];
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };
  stop_reason?: string | null;
}

let client: Anthropic | null = null;

/** Llamada a Claude por la API de Anthropic, con record/replay y registro de costo. */
export async function askClaude(input: AskClaudeInput): Promise<AskClaudeOutput> {
  const request = {
    model: CLAUDE[input.model],
    max_tokens: input.maxTokens,
    ...(input.system ? { system: input.system } : {}),
    messages: [{ role: 'user' as const, content: input.prompt }],
  };
  const r = await withCassette('anthropic', request, input.purpose, 'anthropic', async () => {
    client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
    const m = await client.messages.create(request);
    const stored: StoredMessage = { model: m.model, content: m.content as StoredMessage['content'], usage: m.usage, stop_reason: m.stop_reason };
    return stored;
  });
  const m = r.response;
  const text = m.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  const cost = costUsd(CLAUDE[input.model], {
    input: m.usage.input_tokens,
    output: m.usage.output_tokens,
    cacheWrite: m.usage.cache_creation_input_tokens ?? 0,
    cacheRead: m.usage.cache_read_input_tokens ?? 0,
  });
  logCall({
    purpose: input.purpose,
    kind: 'anthropic',
    provider: 'anthropic',
    requestedModel: CLAUDE[input.model],
    model: m.model,
    inputTokens: m.usage.input_tokens,
    outputTokens: m.usage.output_tokens,
    cacheWriteTokens: m.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: m.usage.cache_read_input_tokens ?? 0,
    costUsd: cost,
    costSource: 'computed',
    latencyMs: r.latencyMs,
    mode: r.mode,
    replayed: r.replayed,
    cassette: r.key,
    tag: input.tag,
  });
  return {
    text,
    model: m.model,
    inputTokens: m.usage.input_tokens,
    outputTokens: m.usage.output_tokens,
    costUsd: cost,
    latencyMs: r.latencyMs,
    replayed: r.replayed,
  };
}

/** Extrae el primer bloque JSON de un texto (el "parseo" de "prompt y parseo"). */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw) as T;
}
