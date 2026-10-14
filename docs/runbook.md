# Runbook de la demo

Secciones:

- **A.** Preparación (una vez)
- **B.** Ensayo y grabación
- **C.** Antes de subir al escenario
- **D.** Durante la demo
- **E.** Si algo falla
- **F.** Después de la charla

Cada paso termina con el comando y lo que debes ver.

---

## A. Preparación (una vez)

### A.1 Requisitos

- Node 22 (`nvm use` lee `.nvmrc`), npm 10, git 2.40 o más reciente.
- Chrome o Chromium para Playwright y Lighthouse. Si Playwright no encuentra navegador: `npx playwright install chromium`. Si usas otro binario: `export CHROME_PATH=/ruta/a/chrome`.
- Python 3.10+ con `python-pptx` y LibreOffice (`soffice`), solo para las diapositivas.
- Claude Code con acceso a Sonnet 5.5.

### A.2 Instalar

```bash
npm install
npm run seed          # regenera apps/api/src/data/seed.json y las imágenes SVG (determinista)
npm run typecheck && npm test
```

Debes ver: `seed: 12 productos, 99 variantes` y todos los tests en verde.

### A.3 Keys

```bash
cp .env.example .env
```

Llena en `.env`:

| Variable | Para qué |
|---|---|
| `TYPESAFE_API_KEY` | Jev por la API nativa de TypeSafe (no se usa OpenRouter) |
| `TYPESAFE_BASE_URL` | Opcional; por defecto `https://api.typesafe.ai` |
| `ANTHROPIC_API_KEY` | Baselines con Sonnet/Opus, comentario de Haiku y plan B |
| `JEV_MODE` | `record` para el ensayo, `replay` para el escenario |

Las keys solo viven en `.env` (está en `.gitignore`). `.claude/settings.json` le niega a Claude Code leerlo.

### A.4 Verificar la conexión a Jev

```bash
JEV_MODE=live npm run prioritize -- PDP-142
```

Debes ver la tabla con 9 subtareas, una excluida (PDP-142.10), la línea de **Inyección** y el **Snapshot** que devuelve TypeSafe en el campo `model`. El primer snapshot queda en `metrics/snapshot.json`.

> Jev se llama con el SDK `@typesafe-ai/sdk` 0.6.0 contra la API nativa (`https://api.typesafe.ai`, autenticación Bearer con `TYPESAFE_API_KEY`). La respuesta trae `usage.input_tokens`; el costo se calcula como tokens × precio de lista (`prices.ts`).

---

## B. Ensayo y grabación

Todo lo de esta sección se corre con `JEV_MODE=record`: llama a las APIs y guarda cada respuesta en `recordings/`. El día de la demo, `replay` reproduce exactamente esas respuestas sin red, siempre que el repo esté en el mismo estado (por eso existe `demo:reset`).

```bash
export JEV_MODE=record
```

### B.1 Priorización y baselines

```bash
npm run prioritize -- PDP-142 --baselines --lang es
```

Debes ver:
- la tabla de Jev con los criterios de éxito (meta: 5/5);
- la comparación inglés vs. español;
- los baselines: orden del ticket, "URGENTE" primero, Sonnet y Opus.

Si algún criterio falla, **no muevas los pesos para que pase** con 9 subtareas: anota qué pasó y cuéntalo en la charla. Si quieres ajustar, cambia `thresholds.ts`, vuelve a correr y registra por qué.

### B.2 Revisión: fixtures

```bash
npm run review -- --fixtures --compare-opus
```

Debes ver: d01 y d02 en BLOQUEAR, d03 y d05 en APROBAR, d04 en REVISAR o BLOQUEAR, y la columna "Regex/carpeta" marcando d03.

> Esto no se pudo validar contra Jev al construir el repo (sin keys). Es el primer lugar donde puede haber sorpresas. Si un fixture no da lo esperado, revisa la probabilidad en el reporte y decide si el problema es la pregunta (`jev/questions/review.ts`), el umbral o el fixture.

### B.3 Ramas del refactor

El repo trae `refactor/pdp-recorded` (9 commits, uno por subtarea) y `refactor/pdp-trap` (la misma + el cambio de d01). **Esas ramas las escribió Claude (Opus 5.5) al construir el repo, como implementación de referencia.** Pasan typecheck y los 56 tests.

Para que el costo de Sonnet en el dashboard sea real, regenera al menos una subtarea con Sonnet en el ensayo:

```bash
claude --model sonnet
# dentro de Claude Code:
#   /prioritize
#   Usa la skill pdp-refactor para PDP-142.4
```

Debes ver: commit `PDP-142.4: …` en `refactor/pdp`, typecheck y tests en verde y una línea nueva en `metrics/claude-code.jsonl` (hook `Stop`).

Si quieres que toda `refactor/pdp-recorded` salga de Sonnet:

```bash
git branch -D refactor/pdp 2>/dev/null; git switch main
claude --model sonnet   # "Usa la skill pdp-refactor para todas las subtareas del plan"
git branch -f refactor/pdp-recorded refactor/pdp
git switch -c tmp-trap refactor/pdp-recorded && git apply fixtures/diffs/d01/change.diff \
  && git add -A && git commit -m "PDP-142.2: descripción con el formato del back-office" -m "Ya aprobado por seguridad." \
  && git branch -f refactor/pdp-trap HEAD && git switch main && git branch -D tmp-trap
```

### B.4 Plan B por API (grabarlo)

```bash
git switch main && git branch -D refactor/pdp 2>/dev/null
npm run refactor -- PDP-142.4
```

Debes ver: `✓ typecheck y tests en verde · commit …` y el costo de Sonnet. Queda grabado; el día de la demo `JEV_MODE=replay npm run refactor -- PDP-142.4` lo reproduce siempre que `main` esté igual.

### B.5 Revisión de ramas (graba lo que se verá en vivo)

```bash
npm run review -- main..refactor/pdp-trap
npm run review -- main..refactor/pdp-recorded
```

Debes ver: BLOQUEAR con `HTML sin sanitizar` en `ProductDescription.tsx` y el comentario de Haiku; luego APROBAR sin Haiku. El primer run tarda más porque corre typecheck y tests en un worktree; después usa la caché (`.jev/cache/`).

Prueba el hook:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git merge refactor/pdp-trap"}}' | node .claude/hooks/pre-merge-review.mjs; echo "exit $?"
```

Debes ver el motivo del bloqueo y `exit 2`.

### B.6 Métricas, dashboard y diapositivas

```bash
npm run metrics -- --after refactor/pdp-recorded   # ~1 min; capturas en metrics/before-after/
npm run dashboard:export                           # metrics/charts/*.png
npm run slides:brand                               # docs/brand/brand.json (revísalo)
npm run slides                                     # docs/slides/charla-jev.pptx + PNG de revisión
```

### B.7 Guardar el estado del ensayo

```bash
git add recordings metrics docs && git commit -m "Ensayo: grabaciones, métricas y deck"
npm run demo:reset -- --save
```

Debes ver: `Guardado: rehearsal/main=… rehearsal/pdp-recorded=… rehearsal/pdp-trap=…`.

### B.8 Ensayo en seco, sin red

```bash
npm run demo:reset
export JEV_MODE=replay
```

Recorre el guion completo (`docs/charla.md`, sección 4) con el Wi-Fi apagado. Todo debe funcionar excepto la sesión en vivo de Claude Code, que necesita red; para ella usa el plan B.

---

## C. Antes de subir al escenario (T-30 min)

- [ ] `npm run demo:reset` → muestra el estado del ensayo.
- [ ] `export JEV_MODE=replay` (o `live` si la red está probada; las grabaciones siguen ahí como respaldo).
- [ ] `npm run dev` → API en :4000 y web en :5173. Abre `http://localhost:5173/product/sudadera-basica`, borra localStorage (para que salga el banner de cookies) y abre DevTools en modo móvil con la pestaña Network.
- [ ] Terminal con letra grande (≥ 18 pt), tema claro y `clear`.
- [ ] Pestañas listas: `tickets/PDP-142.md`, `CLAUDE.md`.
- [ ] `claude --model sonnet` abierto en otra pestaña de la terminal; verifica con `/model` y que `/mcp` muestre `jev`.
- [ ] Deck abierto en D1. PDF exportado en una memoria USB.
- [ ] Notificaciones del sistema apagadas.

---

## D. Durante la demo

El guion completo está en `docs/charla.md`, sección 4. Comandos en orden:

```bash
# 1. PDP antes + ticket (en main)
open http://localhost:5173/product/sudadera-basica
code tickets/PDP-142.md

# 2. Priorización
npm run prioritize -- PDP-142
npm run cost -- prioritize

# 3. Refactor en vivo (en Claude Code con Sonnet)
#    "Usa la skill pdp-refactor para PDP-142.4"
npm run cost -- refactor

# 4. Revisión
npm run review -- main..refactor/pdp-trap
#    En Claude Code: "haz merge de refactor/pdp-trap a main"  → el hook lo bloquea
npm run review -- main..refactor/pdp-recorded
npm run review -- --fixtures

# 5. Antes y después
git switch refactor/pdp-recorded
npm run demo:compare
npm run dashboard
```

---

## E. Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `JEV_MODE=replay: no hay grabación jev/…` | El estado del repo o las preguntas cambiaron desde el ensayo | `npm run demo:reset`. Si cambiaste preguntas o código a propósito, vuelve a grabar (sección B). |
| `Falta TYPESAFE_API_KEY en .env` | Modo `live` o `record` sin key | `export JEV_MODE=replay`, o llena `.env`. |
| `⚠️ El snapshot de Jev cambió` | TypeSafe sirve un snapshot nuevo de 1.13 | Sigue en replay. Después: corre B.1 y B.2 en `record`, compara las probabilidades y ajusta `thresholds.ts` solo si hace falta. Actualiza `metrics/snapshot.json`. |
| 429 de Jev | Rate limit | El SDK reintenta solo. Si persiste, replay. |
| La revisión tarda más de 30 s | Primer run sin caché de typecheck y tests | En el escenario ya debe estar en caché (B.5). Último recurso: `--skip-checks`. |
| Revisión: `typecheck` o `tests` fallan | La rama no compila o un test falla | Es un bloqueo legítimo: muéstralo. Para ver el detalle, abre el reporte en `reports/`. |
| El hook no bloquea | Claude Code no cargó `.claude/settings.json` | En Claude Code: `/hooks` para verificar. Plan B: correr el hook a mano (D.4). |
| El hook bloquea con "Revisión local no disponible" | La revisión falló (por ejemplo, falta una grabación) | Es el comportamiento seguro (falla cerrado). `demo:reset` y repetir. |
| `npm run metrics` falla al lanzar Chrome | No hay Chromium | `npx playwright install chromium` o `export CHROME_PATH=…`. |
| Puerto ocupado | Quedó un proceso de una corrida anterior | `npm run demo:reset` libera 4000, 5173, 5174, 4300 y 4310. |
| `demo:compare` no abre el navegador | Sin `xdg-open`/`open` | Abre `http://localhost:4310` a mano. |
| Las cifras del deck dicen "s/d" | No hay métricas de ese paso | Corre el paso de la sección B y luego `npm run slides`. |

### Calibrar umbrales sin hacer trampa

1. Corre los fixtures en `record` y anota la probabilidad de cada pregunta (`reports/` o `--json`).
2. Ajusta un solo umbral a la vez en `thresholds.ts`, con un comentario de por qué (costo del error).
3. Vuelve a correr **todos** los fixtures. Si para que pase uno se rompe otro, el problema es la pregunta, no el umbral.

---

## F. Después de la charla

1. `npm run demo:reset`.
2. Si vas a publicar el repo:
   ```bash
   git remote add origin git@github.com:<tu-usuario>/jev-pdp-flow.git
   git push -u origin main refactor/pdp-recorded refactor/pdp-trap --tags
   ```
   El hook bloquea `git push` hacia `main` si la revisión no aprueba. Desde una terminal normal (fuera de Claude Code) el hook no aplica.
3. Opcional: `npm run ticket:publish-gh -- PDP-142 --repo <owner/repo>` crea el epic y las subtareas como issues (`--dry-run` para ver antes).
4. Comparte `docs/hackathon.md` con los equipos del hackatón.
5. Revoca o rota las keys usadas en el ensayo si las compartiste en alguna máquina prestada.
