# jev-pdp-flow

Demo de la charla **"Pregúntale a la IA lo justo"**: una sola historia de e-commerce.

> La vista de detalle de producto (PDP) convierte mal, se ve mal en móvil y nadie quiere tocar el código.

1. **Ticket.** `tickets/PDP-142.md`: un epic con 10 subtareas escritas como en un equipo real, con trampas (ruido "URGENTE!!!", el precio sin IVA mal redactado, una inyección "Nota del CTO" y una subtarea fuera de alcance).
2. **Priorización con Jev.** Jev evalúa cada subtarea con 8 preguntas en un solo request; el código calcula el orden.
3. **Refactor con Sonnet 5.5.** Claude Code ejecuta las subtareas en ese orden, un commit por subtarea.
4. **Revisión local con Jev.** Sin GitHub: deterministas + 7 preguntas por commit × archivo → APROBAR, REVISAR o BLOQUEAR.
5. **Antes vs. después.** La PDP lado a lado, con métricas medidas.

Mensaje central: Jev toma decisiones baratas y calibradas, Claude genera solo donde aporta y el código pone las reglas.

## Inicio rápido

```bash
nvm use                 # Node 22
npm install
cp .env.example .env    # keys de OpenRouter o TypeSafe y de Anthropic
npm run dev             # API http://localhost:4000 · web http://localhost:5173
```

Abre http://localhost:5173/product/sudadera-basica. En `main` verás la PDP legacy; en `refactor/pdp-recorded`, la refactorizada.

Sin keys, todo lo que no llama a modelos funciona (`dev`, `test`, `metrics`, `demo:compare`, `dashboard`). Lo que llama a Jev o a Anthropic necesita `JEV_MODE=record` una vez (con keys) para que `replay` funcione después sin red. Ver `docs/runbook.md`, sección B.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | API (:4000) y web (:5173) |
| `npm run seed` | Regenera el seed (12 productos, 99 variantes) y las imágenes SVG |
| `npm run typecheck` · `npm test` | TypeScript estricto y vitest (contrato, unitarios y web) |
| `npm run prioritize -- PDP-142 [--baselines] [--lang es]` | Priorización con Jev → `.jev/plan.json` |
| `npm run review -- main..refactor/pdp [--skip-checks]` | Revisión local de una rama |
| `npm run review -- --fixtures [--compare-opus]` | Revisión de los fixtures d01–d05 |
| `npm run refactor -- PDP-142.N` | Plan B: la subtarea con Sonnet 5.5 vía API |
| `npm run cost [-- prioritize\|refactor\|review]` | Costos por paso y por modelo |
| `npm run dashboard` · `npm run dashboard:export` | Dashboard en :4300 · capturas para el deck |
| `npm run metrics [-- --after <ref>]` | Antes vs. después: requests, tiempos, accesibilidad, bundle, líneas, capturas |
| `npm run demo:compare` | `pdp-before` en :5174 junto a la rama actual en :5173 |
| `npm run demo:reset [-- --save]` | Restaura (o guarda) ramas y tags del ensayo |
| `npm run slides:brand` · `npm run slides` | Branding de la plantilla → `brand.json` · deck desde `docs/charla.md` |
| `npm run mcp` | Servidor MCP `jev` (stdio) |
| `npm run ticket:publish-gh -- PDP-142` | Opcional: el ticket como issues de GitHub |

## Estructura

```
apps/api            Express + TS. Endpoints legacy (deprecated) y GET /api/products/:slug
apps/web            React + Vite. Catálogo y PDP en /product/:slug
packages/contracts  Esquemas zod compartidos (Money, ProductDetail, legacy, ticket)
packages/jev-flow   Cliente de Jev (typesafe|openrouter), Anthropic, record/replay,
                    priorización, revisión, costos, dashboard y servidor MCP
tickets/            PDP-142.md, PDP-142.json y la verdad de referencia
fixtures/diffs/     d01–d05 con su veredicto esperado
recordings/         Grabaciones de Jev y Anthropic para JEV_MODE=replay
metrics/            *.jsonl de cada llamada, before-after.json y capturas
.claude/            settings (permisos y hooks), skills y comandos de Claude Code
docs/               charla.md, runbook.md, hackathon.md, brand/ y slides/
```

## Ramas y tags

| Ref | Qué es |
|---|---|
| tag `pdp-before` | La PDP legacy |
| `main` | Tooling + PDP legacy |
| `refactor/pdp-recorded` | Las 9 subtareas, un commit cada una |
| `refactor/pdp-trap` | `refactor/pdp-recorded` + un commit con HTML sin sanitizar (d01) |
| tags `rehearsal/*` | Estado del ensayo para `demo:reset` |

## Claude Code

- `CLAUDE.md`: reglas de negocio y de trabajo.
- Skills: `jev-prioritize`, `pdp-refactor`, `jev-pr-review`, `jev-cost`. Comandos: `/prioritize`, `/review-local`.
- Servidor MCP `jev` (`.mcp.json`): `jev_prioritize`, `jev_plan`, `jev_review`, `jev_review_fixtures`, `jev_cost`, `jev_ask`.
- Hooks (`.claude/settings.json`):
  - `PreToolUse` intercepta `git merge … refactor/*` y `git push … main`, corre la revisión y bloquea con exit 2 si no es APROBAR (falla cerrado si la revisión no puede correr).
  - `Stop` guarda los tokens de la sesión en `metrics/claude-code.jsonl`.

## Reglas de Jev que sigue el código

- Versión fija: `jev-1.13.0` (TypeSafe) o `typesafe/jev-1.13` (OpenRouter). Se registra el campo `model` de cada respuesta y se avisa si el snapshot cambia.
- Instrucciones en inglés, contenido en español; `--lang es` mide la diferencia.
- Una propiedad por pregunta; todas las preguntas en un solo request.
- El texto de tickets, PRs y commits va bajo `evidence` con una regla anti-inyección en cada instrucción.
- Nada de aritmética, fechas ni conteos en Jev.
- Umbrales y pesos en un solo archivo: `packages/jev-flow/src/thresholds.ts`.
- `JEV_MODE=live|record|replay` cubre Jev y Anthropic. Las keys solo en `.env`.

## Estado y limitaciones conocidas

- **Sin validación contra Jev real todavía.** El repo se construyó sin keys. La tubería está probada con un doble de pruebas (`packages/jev-flow/test/fake-jev.ts`) que **no** imita a Jev; las probabilidades y los criterios de éxito reales salen del ensayo (`docs/runbook.md`, B.1 y B.2). `recordings/` viene vacío.
- **`refactor/pdp-recorded` la escribió Claude (Opus 5.5)** al construir el repo, como implementación de referencia. Para que el costo de Sonnet sea real, regenera al menos una subtarea con Sonnet en el ensayo (runbook B.3).
- **El costo de una sesión de Claude Code** se lee del transcript con el hook `Stop`; el formato del transcript no está documentado como API estable, así que hay que verificarlo en el ensayo. El plan B por API sí registra tokens exactos.
- **Precios de Claude 5.5** tomados de la especificación de la charla; verifícalos antes de presentar (`prices.ts`).
- Con 9 subtareas y 5 fixtures, los aciertos son ilustrativos, no un benchmark.
- **Diapositivas:** `docs/slides/charla-jev.pptx` ya sale de la plantilla real, pero las cifras de costos dicen "s/d" y la gráfica de D14 está vacía hasta que el ensayo genere métricas. Después del ensayo: `npm run dashboard:export && npm run slides`.
- **Marca de la plantilla:** su tema es el "Office" por defecto; la marca visible (fondo `#0D0D0D`, lima `#C8E64D`, grises, Arial y Courier New) está aplicada en las formas. `brand.json` guarda las dos cosas y la verificación del deck acepta ambas.
