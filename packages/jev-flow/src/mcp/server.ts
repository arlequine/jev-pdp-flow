/**
 * Servidor MCP `jev` (stdio). Lo registra .mcp.json para Claude Code.
 * Expone la priorización, la revisión local, los costos y una pregunta directa a Jev.
 * Todo pasa por el mismo cliente: versión fija, JEV_MODE y métricas.
 * Ojo: en stdio no se puede escribir a stdout fuera del protocolo; los avisos van a stderr.
 */
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { path } from '../config';
import { askJev } from '../jev/client';
import type { JevQuestions } from '../jev/types';
import { setCommand } from '../metrics/log';
import { loadTicket, loadTruth } from '../lib/ticket';
import { prioritize, writePlan } from '../prioritize/run';
import { reviewFixtures, reviewRange, writeReport } from '../review/run';
import { aggregate } from '../cost/aggregate';

const server = new McpServer({ name: 'jev', version: '1.0.0' });
const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }] });

server.registerTool(
  'jev_prioritize',
  {
    title: 'Priorizar un ticket con Jev',
    description: 'Jev evalúa cada subtarea y el código calcula el orden. Escribe .jev/plan.json y devuelve el plan con motivos, criterios y costo.',
    inputSchema: { ticket: z.string().describe('ID del ticket, por ejemplo PDP-142') },
  },
  async ({ ticket }) => {
    setCommand('prioritize');
    const t = loadTicket(ticket);
    const run = await prioritize(t, loadTruth(ticket));
    const plan = writePlan(run, t);
    return text({ plan: plan.order.map((o) => ({ position: o.position, id: o.id, title: o.title, reason: o.reason, needs_pm: o.needs_pm })), excluded: plan.excluded, evaluation: run.evaluation, injection: run.injection, costUsd: run.costUsd });
  },
);

server.registerTool(
  'jev_plan',
  { title: 'Leer el plan', description: 'Devuelve .jev/plan.json (el orden de subtareas que sigue la skill pdp-refactor).', inputSchema: {} },
  async () => {
    const f = path('.jev', 'plan.json');
    return text(existsSync(f) ? readFileSync(f, 'utf8') : 'No hay plan. Usa jev_prioritize primero.');
  },
);

server.registerTool(
  'jev_review',
  {
    title: 'Revisión local de una rama',
    description: 'Revisa un rango de git (p. ej. main..refactor/pdp): chequeos deterministas, Jev por commit × archivo, umbrales en thresholds.ts. Devuelve APROBAR, REVISAR o BLOQUEAR con hallazgos y reporte.',
    inputSchema: { range: z.string().describe('base..rama'), skipChecks: z.boolean().optional().describe('Omitir typecheck y tests') },
  },
  async ({ range, skipChecks }) => {
    setCommand('review');
    const r = await reviewRange(range, { skipChecks });
    const report = writeReport(r);
    return text({
      verdict: r.verdict,
      baselineVerdict: r.baselineVerdict,
      checks: r.checks,
      findings: r.units.filter((u) => u.verdict !== 'approve').map((u) => ({ commit: u.unit.group, file: u.unit.file, verdict: u.verdict, findings: u.findings })),
      comment: r.comment,
      costUsd: r.costUsd,
      report,
    });
  },
);

server.registerTool(
  'jev_review_fixtures',
  { title: 'Revisar los fixtures d01–d05', description: 'Corre la revisión sobre fixtures/diffs y compara Jev contra el baseline regex/carpeta.', inputSchema: {} },
  async () => {
    setCommand('review-fixtures');
    const { outcomes, summary, jevCost } = await reviewFixtures();
    return text({ outcomes: outcomes.map(({ result, ...o }) => o), summary, jevCost });
  },
);

server.registerTool(
  'jev_cost',
  { title: 'Costos de la demo', description: 'Costos por paso y por modelo, leídos de metrics/*.jsonl.', inputSchema: {} },
  async () => text(aggregate()),
);

const Entry: z.ZodType = z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]);
server.registerTool(
  'jev_ask',
  {
    title: 'Preguntarle a Jev',
    description:
      'Una request a Jev (versión fija) con un state y varias preguntas Choice/Noul/Score. Para el hackatón. Recuerda: instrucciones en inglés, texto de terceros bajo `evidence`, nada de aritmética ni conteos.',
    inputSchema: {
      state: z.unknown().describe('String, objeto o arreglo'),
      questions: z.record(
        z.string(),
        z.object({ type: z.enum(['choice', 'noul', 'score']), instructions: Entry, criteria: z.unknown().optional() }),
      ),
    },
  },
  async ({ state, questions }) => {
    setCommand('mcp-ask');
    const r = await askJev({ state, questions: questions as unknown as JevQuestions, purpose: 'mcp:jev_ask' });
    return text({ model: r.response.model, answers: r.response.answers, costUsd: r.costUsd });
  },
);

await server.connect(new StdioServerTransport());
console.error('servidor MCP jev listo (stdio)');
