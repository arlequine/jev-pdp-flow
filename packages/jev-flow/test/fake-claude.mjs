#!/usr/bin/env node
// DOBLE DE PRUEBA de `claude -p --output-format json`: lee el prompt de stdin y responde un orden fijo.
let s = '';
process.stdin.on('data', (d) => (s += d));
process.stdin.on('end', () => {
  const model = process.argv[process.argv.indexOf('--model') + 1];
  const order = ['PDP-142.3', 'PDP-142.4', 'PDP-142.6', 'PDP-142.5', 'PDP-142.1', 'PDP-142.9', 'PDP-142.2', 'PDP-142.7', 'PDP-142.8'];
  process.stdout.write(JSON.stringify({
    type: 'result', is_error: false, duration_ms: 8421, total_cost_usd: 0.1234,
    result: '```json\n' + JSON.stringify({ order, excluded: ['PDP-142.10'] }) + '\n```',
    usage: { input_tokens: 4, output_tokens: 180, cache_creation_input_tokens: 3000, cache_read_input_tokens: 15000 },
    modelUsage: { [`claude-${model}-5-5`]: { inputTokens: 4, outputTokens: 180, cacheReadInputTokens: 15000, cacheCreationInputTokens: 3000, costUSD: 0.1234 } },
    prompt_chars: s.length,
  }) + '\n');
});
