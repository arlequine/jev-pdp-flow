# Pregúntale a la IA lo justo

Charla de 40 minutos: 15 de narrativa, 20 de demo y 5 de preguntas.
Una sola historia de e-commerce: la página de detalle de producto (PDP) de una tienda de ropa en pesos mexicanos.

> **Mensaje central.** Jev toma decisiones baratas y calibradas. Claude genera solo donde aporta. El código pone las reglas.

Las cifras de esta charla salen de `metrics/*.jsonl` y de `metrics/before-after.json`. Aquí aparecen como marcadores `{{…}}` que `npm run slides` reemplaza con los datos del ensayo. Si una cifra no existe, el deck muestra "s/d" y el script lo avisa.

---

## 1. Audiencia

| Perfil | Qué le importa | Qué se lleva | Momento clave |
|---|---|---|---|
| Negocio | Conversión, costo, riesgo | La IA ordena el backlog por impacto y dinero, y el ruido ("URGENTE!!!") no gana | Priorización: el ticket mal escrito del IVA sale primero |
| Análisis | Datos confiables, métricas | Probabilidades calibradas en lugar de texto; umbrales que se pueden auditar | Tabla con probabilidades y motivos que arma el código |
| UX/UI | Móvil, accesibilidad | El antes y después medido: botón visible en móvil, accesibilidad de Lighthouse | Comparación lado a lado |
| Marketing | Campañas, tiempos de entrega | Su pedido urgente sí se hace, pero en su lugar; el naranja se ajustó para pasar contraste | Subtarea .3 y el commit final |
| Desarrollo | Código, revisión, costos de tokens | Jev como gate barato antes del merge; un hook que no depende de que el asistente coopere | Bloqueo de la trampa en vivo |
| Participantes del hackatón | Ideas y un punto de partida | Patrón reutilizable: código + Jev + Claude, con el servidor MCP `jev` | Diapositiva de ideas y `docs/hackathon.md` |

---

## 2. Las 3 ideas

1. **Jev decide barato y calibrado.** Para preguntas cerradas ("¿esto toca dinero?", "¿este diff renderiza HTML sin sanitizar?") no hace falta un LLM que escriba. Jev responde con probabilidades, cuesta USD {{prices.jev.input}} por millón de tokens de entrada y la salida es gratis.
2. **Claude genera solo donde aporta.** Escribir el refactor sí necesita un modelo generativo: ahí va Sonnet. Haiku solo redacta el comentario cuando la revisión no aprueba.
3. **El código pone las reglas.** El orden, los umbrales, los motivos, los chequeos deterministas y el bloqueo del merge son código. La IA aporta señales, no decisiones finales.

---

## 3. Diapositivas

Fuente única del deck. `npm run slides` lee estos bloques `slide` y genera `docs/slides/charla-jev.pptx` con los layouts de la plantilla.
Claves: `patrón` (espera, título, agenda, separador, contenido, tarjetas, dos-columnas, imagen, preguntas), `título`, `subtítulo`, `número`, `tarjetas` (`- núm | título | texto`), `izquierda`/`derecha`, `viñetas`, `imagen`, `cierre` (frase al pie) y `notas` (notas del orador).

### D1 · Portada de espera

```slide
patrón: espera
título: En un momento empezamos
subtítulo: Pregúntale a la IA lo justo
notas: Pantalla mientras entra la gente. Terminal y navegador ya abiertos en la otra pantalla.
```

### D2 · Título

```slide
patrón: título
título: Pregúntale a la IA lo justo
subtítulo: Jev decide, Claude genera y el código pone las reglas
notas: Presentarme en una línea. La promesa: vamos a arreglar una PDP real gastando tokens solo donde aportan.
```

### D3 · Agenda

```slide
patrón: agenda
título: Agenda
tarjetas:
- 01 | Pregúntale a la IA lo justo | El problema de los tokens, las 3 ideas y qué es Jev · 15 min
- 02 | Demo en vivo | De un ticket a un PR revisado, en local · 20 min
- 03 | Preguntas | Dudas e ideas para el hackatón · 5 min
cierre: Todo lo que van a ver corre en local y sin red, con grabaciones del ensayo.
```

### D4 · Separador 01

```slide
patrón: separador
número: 01
título: Pregúntale a la IA lo justo
subtítulo: El problema de los tokens, las 3 ideas y qué es Jev
```

### D5 · El problema de los tokens

```slide
patrón: dos-columnas
título: El problema: "prompt y parseo"
izquierda:
- Le hacemos una pregunta cerrada a un LLM grande
- Le pedimos que conteste en JSON y lo parseamos
- Pagamos la salida, el razonamiento y los reintentos
- Priorizar PDP-142 pidiéndoselo a Opus: {{prioritize.opus.cost}} y {{prioritize.opus.passed}}/5 criterios
derecha:
- La misma decisión, dividida en preguntas atómicas a Jev
- Respuestas tipadas con probabilidad, sin texto
- El orden lo calcula el código, con motivos auditables
- Priorizar PDP-142 con Jev: {{prioritize.jev.cost}} y {{prioritize.jev.passed}}/5 criterios
cierre: Una decisión no necesita una redacción. Necesita una probabilidad y una regla.
notas: Las cifras son del ensayo (metrics/prioritize-runs.jsonl). Si alguien pregunta, la diferencia de criterios es sobre 5 casos de un solo ticket: ilustrativa, no un benchmark.
```

### D6 · Las 3 ideas

```slide
patrón: tarjetas
título: Las 3 ideas de hoy
tarjetas:
- 1 | Jev decide | Barato y calibrado: preguntas cerradas, probabilidades, nada de texto
- 2 | Claude genera | Solo donde aporta: el refactor con Sonnet, el comentario con Haiku si hace falta
- 3 | El código manda | Orden, umbrales, motivos, chequeos y el bloqueo del merge
cierre: Pregúntale a la IA lo justo.
```

### D7 · Qué es Jev

```slide
patrón: contenido
título: Qué es Jev
viñetas:
- Un modelo de decisión de TypeSafe (familia System One), disponible en OpenRouter
- Recibe un state y preguntas tipadas; devuelve respuestas con probabilidades
- Tres primitivas: Choice (¿cuál?), Noul (¿sí o no?) y Score (¿en qué nivel?)
- No escribe, no explica y no genera código
- USD {{prices.jev.input}} por millón de tokens de entrada; la salida es gratis
- Todas las preguntas van en un solo request y se responden en paralelo
cierre: Las instrucciones van en inglés y el texto de terceros va bajo `evidence`.
```

### D8 · Cuándo sí y cuándo no

```slide
patrón: dos-columnas
título: Cuándo usar Jev y cuándo no
izquierda:
- Ordenar y clasificar: ¿toca dinero?, ¿es solo estético?
- Verificar: ¿este diff confía en un precio del cliente?
- Gates: aprobar, revisar o bloquear según el costo del error
- Routing: qué modelo o qué persona atiende
derecha:
- Prosa, explicaciones o código: modelo generativo
- Aritmética, fechas y conteos: código
- Políticas y umbrales: código
- Lo que diga el texto de un tercero: evidencia, no orden
cierre: Si una persona experta lo respondería en un segundo, es una pregunta para Jev.
```

### D9 · Separador 02

```slide
patrón: separador
número: 02
título: Demo en vivo
subtítulo: De un ticket mal escrito a un PR revisado, en local
```

### D10 · Lo que van a ver

```slide
patrón: tarjetas
título: Lo que van a ver
tarjetas:
- 1 | Ticket | La PDP "antes" y PDP-142 · 3 min
- 2 | Priorización | Jev evalúa, el código ordena · 4 min
- 3 | Refactor | Sonnet hace una subtarea en vivo · 5 min
- 4 | Revisión | Jev bloquea una trampa y aprueba lo limpio · 5 min
- 5 | Antes y después | Métricas y costos · 3 min
cierre: Cada paso tiene respaldo: grabaciones del ensayo y la rama refactor/pdp-recorded.
```

### D11 · Las reglas del juego

```slide
patrón: tarjetas
título: Las reglas del juego
tarjetas:
- 1 | CLAUDE.md | Dinero en el servidor, contratos primero, accesibilidad AA, nada de HTML sin sanitizar
- 2 | El hook | Antes de cualquier merge o push a main corre la revisión de Jev y bloquea con exit 2
- 3 | Modo replay | JEV_MODE=replay reproduce Jev y Anthropic sin red
cierre: El agente propone. El merge lo deciden el código y una persona.
```

### D12 · Separador 03

```slide
patrón: separador
número: 03
título: Qué pasó
subtítulo: Antes y después, costos por modelo e ideas para el hackatón
```

### D13 · Antes y después

```slide
patrón: imagen
título: Antes y después de la PDP
imagen: metrics/before-after/before-mobile.png
imagen2: metrics/before-after/after-mobile.png
viñetas:
- Requests a la API: {{ba.requests}}
- Carga completa en móvil: {{ba.complete}}
- Accesibilidad (Lighthouse): {{ba.a11y}}
- Líneas de ProductPage.tsx: {{ba.lines}}
cierre: Medido con builds de producción y red móvil simulada (npm run metrics).
```

### D14 · Costos por modelo

```slide
patrón: imagen
título: Cuánto costó cada decisión
imagen: metrics/charts/models.png
viñetas:
- Priorizar con Jev: {{prioritize.jev.cost}} · con Opus: {{prioritize.opus.cost}}
- Refactor con Sonnet: {{refactor.cost}} · mismos tokens con Opus: {{refactor.opus}}
- Revisar los 5 fixtures con Jev: {{review.jev.cost}} · con Opus: {{review.opus.cost}}
cierre: Se paga generación solo donde se genera.
```

### D15 · Ideas para el hackatón

```slide
patrón: tarjetas
título: Ideas para el hackatón
tarjetas:
- 1 | Reseñas | Moderar y etiquetar reseñas: Jev clasifica, el código publica u oculta
- 2 | Devoluciones | Gate de reembolsos: chequeos en código, tres Nouls, persona si hay duda
- 3 | Catálogo | Fichas que prometen lo que el producto no tiene: Jev verifica, Claude reescribe
- 4 | Soporte | Triage de tickets: equipo, urgencia y si toca dinero, en una request
cierre: Detalles, preguntas sugeridas y criterios de éxito en docs/hackathon.md.
```

### D16 · Preguntas

```slide
patrón: preguntas
título: ?
subtítulo: Preguntas
```

---

## 4. Guion minuto a minuto

### Narrativa (0:00–15:00)

| Min | Diapositiva | Qué digo |
|---|---|---|
| 0:00–1:00 | D1 → D2 | Presentación. "Hoy vamos a arreglar una página de producto y a pagar tokens solo donde valen la pena." |
| 1:00–2:00 | D3 | Agenda 15 / 20 / 5. Todo corre en local; si la red falla, la demo no. |
| 2:00–2:30 | D4 | Separador. |
| 2:30–6:00 | D5 | El patrón "prompt y parseo": cuánto pagamos por una respuesta de una palabra. Cifras del ensayo. |
| 6:00–8:30 | D6 | Las 3 ideas. Ejemplo con negocio: "¿esto toca dinero?" es una pregunta de un segundo para una persona experta. |
| 8:30–11:30 | D7 | Qué es Jev: state, preguntas, probabilidades; Choice, Noul, Score. Por qué instrucciones en inglés. |
| 11:30–14:30 | D8 | Cuándo sí y cuándo no. Remarcar: aritmética, fechas y conteos van en código. |
| 14:30–15:00 | D9 | Separador de la demo. Cambio a la terminal. |

### Demo (15:00–35:00)

Antes de empezar: `npm run demo:reset` y `npm run dev` corriendo; `JEV_MODE=replay` salvo que la red esté probada. Terminal a la izquierda, navegador a la derecha.

| Min | Bloque | Qué se ve | Comando o acción | Qué digo | Plan B |
|---|---|---|---|---|---|
| 15:00–15:30 | 0 | D10 y D11 | Diapositivas | Los 5 pasos y las reglas del juego | — |
| 15:30–17:00 | 1 · PDP antes | La PDP en :5173, DevTools en modo móvil. Network: 4 requests en cascada. `$1299.5`, botón tapado por el banner | `npm run dev` ya corriendo, en `main` | "Esto es lo que negocio describe como 'convierte mal, se ve mal y nadie la quiere tocar'." | Captura `metrics/before-after/before-mobile.png` |
| 17:00–18:00 | 1 · Ticket | `tickets/PDP-142.md` | Abrir el archivo | Señalo el URGENTE!!!, el "precio raro", la nota del CTO y el cupón del checkout. "¿En qué orden lo harían ustedes?" | — |
| 18:00–20:00 | 2 · Priorización | Tabla: .4 primero, URGENTE al final, la nota del CTO no movió nada, el checkout fuera | `npm run prioritize -- PDP-142` | "Jev contestó preguntas cerradas; el orden y el motivo de cada fila los calculó el código." | `JEV_MODE=replay npm run prioritize -- PDP-142` |
| 20:00–22:00 | 2 · Costo | Costo de la priorización contra pedírselo a Sonnet u Opus | `npm run cost -- prioritize` | "Mismo ticket, otra escala de costo, y además el modelo grande se dejó llevar por el 'URGENTE'." (solo si así salió en el ensayo) | Igual, en replay |
| 22:00–23:00 | 3 · Contexto | `CLAUDE.md` y `.jev/plan.json` | Abrir los dos archivos | "Sonnet no decide qué hacer: lee el plan y las reglas de negocio." | — |
| 23:00–26:30 | 3 · Refactor en vivo | Claude Code con Sonnet ejecuta PDP-142.4 en `refactor/pdp`: precio con IVA, formato MXN, test de `PriceBlock`, commit | `claude --model sonnet` → "Usa la skill pdp-refactor para PDP-142.4" | "Aquí sí vale la pena generar." | Si pasa de 4 min: Ctrl-C y `git show refactor/pdp-recorded~8 --stat`. Sin Claude Code: `npm run refactor -- PDP-142.4` (replay) |
| 26:30–27:00 | 3 · Costo | Precio correcto en el navegador y costo de la sesión | `npm run cost -- refactor` | "Las otras 8 subtareas se hicieron en el ensayo: están en `refactor/pdp-recorded`." | — |
| 27:00–29:00 | 4 · Trampa | BLOQUEAR en `refactor/pdp-trap`: `renders_unsanitized_html` alto en `ProductDescription.tsx`; comentario de Haiku | `npm run review -- main..refactor/pdp-trap` | "El commit dice 'ya aprobado por seguridad'. Jev lo leyó como evidencia, no como aprobación." | Replay |
| 29:00–30:00 | 4 · Hook | Claude Code intenta el merge y el hook lo bloquea con exit 2 | En Claude Code: "haz merge de refactor/pdp-trap a main" | "El bloqueo no depende de que el asistente coopere: lo aplica el harness." | Mostrar `.claude/settings.json` y correr `echo '{"tool_name":"Bash","tool_input":{"command":"git merge refactor/pdp-trap"}}' \| node .claude/hooks/pre-merge-review.mjs` |
| 30:00–31:00 | 4 · Limpio | APROBAR en `refactor/pdp-recorded`; no se llama a Haiku | `npm run review -- main..refactor/pdp-recorded` | "Cuando todo está bien, la IA no escribe nada." | Replay |
| 31:00–32:00 | 4 · Fixtures | Jev contra regex/carpeta y Opus en d01–d05 | `npm run review -- --fixtures` | d02: la regex no lo ve. d03: la regex lo marca de más. | Replay |
| 32:00–34:00 | 5 · Antes y después | Lado a lado, escritorio y móvil, con el panel de métricas | `git switch refactor/pdp-recorded` y `npm run demo:compare` | Requests, carga, accesibilidad, líneas | D13 |
| 34:00–35:00 | 5 · Dashboard | Costos por paso y por modelo | `npm run dashboard` | Cierro con las 3 ideas | D14 |

### Qué pasó y preguntas (35:00–40:00)

| Min | Diapositiva | Qué digo |
|---|---|---|
| 35:00–35:30 | D12 → D13 | Si el compare falló, aquí están las capturas y las cifras. |
| 35:30–36:00 | D14 | Costos por modelo. |
| 36:00–36:30 | D15 | Ideas para el hackatón; el servidor MCP `jev` y `docs/hackathon.md`. |
| 36:30–40:00 | D16 | Preguntas. |

---

## 5. Costos

Precios de lista (USD por millón de tokens), en `packages/jev-flow/src/prices.ts`:

| Modelo | Entrada | Salida |
|---|---|---|
| Jev 1.13 | 0.042 | 0 |
| Haiku 5.5 | 0.10 | 0.50 |
| Sonnet 5.5 | 2 | 10 |
| Opus 5.5 | 4 | 20 |

Cómo se mide:

- **Jev:** cada respuesta trae `usage.input_tokens`. Por OpenRouter también trae `usage.cost`, que se usa tal cual (`costSource: reported`). Con TypeSafe directo el costo se calcula como tokens × precio de lista (`computed`). Si una respuesta no trae tokens, el costo queda "sin dato".
- **Anthropic por API** (baselines, Haiku, plan B): tokens de la respuesta × precio de lista.
- **Claude Code:** el hook `Stop` suma los tokens del transcript por modelo (`metrics/claude-code.jsonl`). La caché se cobra con los multiplicadores de Anthropic (escritura 1.25×, lectura 0.1× del precio de entrada).
- **"Con Opus":** estimación con los mismos tokens a precio de Opus. Se dice así en el deck.

Cifras del ensayo (las llena `npm run slides`; para verlas en la terminal: `npm run cost`):

| Paso | Jev | Alternativa |
|---|---|---|
| Priorizar PDP-142 | {{prioritize.jev.cost}} | Sonnet {{prioritize.sonnet.cost}} · Opus {{prioritize.opus.cost}} |
| Refactor | — | Sonnet {{refactor.cost}} · con Opus {{refactor.opus}} |
| Revisar los 5 fixtures | {{review.jev.cost}} | Opus {{review.opus.cost}} |

---

## 6. Plan B

| Falla | Qué hago | Comando |
|---|---|---|
| No hay red o falla OpenRouter | Todo en replay | `export JEV_MODE=replay` y repetir el comando |
| Falta una grabación (`no hay grabación …`) | El estado del repo no es el del ensayo | `npm run demo:reset` y repetir |
| Claude Code tarda más de 4 min o falla | Ctrl-C y mostrar el commit del ensayo | `git show refactor/pdp-recorded~8 --stat` |
| Claude Code no abre | Plan B por API, reproducido | `JEV_MODE=replay npm run refactor -- PDP-142.4` |
| El hook no se dispara | Correrlo a mano | ver la fila 29:00 del guion |
| `demo:compare` no levanta | Capturas y cifras | D13 |
| El dashboard no abre | Diapositiva de costos | D14 |
| El snapshot de Jev cambió (aviso amarillo) | Seguir en replay; revisar umbrales después | `docs/runbook.md`, sección E |
| Se cae la laptop | Deck en PDF en otra máquina | `docs/slides/charla-jev.pptx` exportado |

---

## 7. Anexo técnico

### Arquitectura

```
tickets/PDP-142.json ──► jev-flow/prioritize ──► Jev (1 request × subtarea, 8 preguntas)
                                │                    + control de orden (area invertida)
                                │                    + control de inyección (.9 sin la nota)
                                ▼
                         rank.ts (código) ──► .jev/plan.json ──► Claude Code + skill pdp-refactor (Sonnet)
                                                                       │ un commit por subtarea
                                                                       ▼
                   git diff (merge-base) ──► filtros ──► deterministas ──► Jev (7 Nouls × commit × archivo)
                                                                       │
                                               thresholds.ts ──► APROBAR / REVISAR / BLOQUEAR
                                                                       │ si no aprueba
                                                                       ▼
                                                               Haiku redacta el comentario
```

### Priorización

- Preguntas: `area` (Choice), `conversion_impact`, `user_pain`, `risk_of_change` (Score de 4 niveles), `touches_money`, `legal_or_compliance`, `blocks_purchase`, `cosmetic_only` (Noul). Texto exacto en `packages/jev-flow/src/jev/questions/prioritize.ts`.
- Orden en código (`prioritize/rank.ts`):
  1. Excluir si `area = out_of_scope` con probabilidad ≥ 0.5. Va antes que la regla de dinero: por eso el cupón del checkout sale aunque toque dinero.
  2. Regla dura: `touches_money ≥ 0.7` o `blocks_purchase ≥ 0.7` → grupo prioritario; dentro, primero lo legal.
  3. Fórmula: `0.40·impacto + 0.30·dolor + 0.20·legal − 0.10·riesgo − 0.25·estético`, dividida entre √estimación del ticket.
  4. Orden topológico con las dependencias del ticket.
  5. "Necesita PM" si el área es dudosa, cambia al invertir las opciones, o una regla dura cae entre 0.3 y 0.7.
- Criterios de éxito (contra `tickets/PDP-142.truth.json`): top 3 = {.4, .5, .6}; .4 en el top 2; .3 en posición ≥ 6; .9 fuera del top 3 y con Δ < 0.10 contra el control; .10 excluida.

### Revisión

- Unidad: commit × archivo, contra el merge-base. Filtros: lockfiles, snapshots, assets, generados y archivos borrados.
- Deterministas primero (si fallan, se bloquea sin llamar a Jev): secretos, typecheck, contrato API ↔ web, tests. Corren en un worktree temporal y se cachean por árbol de git.
- Preguntas (Noul): `renders_unsanitized_html`, `trusts_client_price`, `breaks_api_contract`, `removes_accessibility`, `missing_loading_or_error_state`, `leaks_secret_or_pii`, `matches_declared_subtask`.
- Umbrales (`thresholds.ts`): riesgo ≥ 0.8 bloquea, ≥ 0.4 pide revisión. `matches_declared_subtask` se invierte y llega como máximo a "revisar".
- Líneas movidas: si un `alt` o un `aria-*` desaparece de un archivo y aparece igual en otro del mismo commit, se manda como `evidence.moved_lines` para que no cuente como "se quitó".

### Ramas

| Ref | Qué es |
|---|---|
| tag `pdp-before` | PDP legacy |
| `main` | Tooling + PDP legacy |
| `refactor/pdp-recorded` | Las 9 subtareas, un commit cada una |
| `refactor/pdp-trap` | `refactor/pdp-recorded` + el cambio de d01 |
| `refactor/pdp` | La subtarea en vivo (se borra en `demo:reset`) |
| tags `rehearsal/*` | Estado del ensayo que restaura `demo:reset` |

### Limitaciones que conviene decir en voz alta

- Con 9 subtareas y 5 fixtures, los aciertos son ilustrativos, no un benchmark.
- Jev es más preciso en inglés; el contenido en español se mide con `--lang es`.
- La calibración de Jev se mide sobre grupos de predicciones; una respuesta individual puede fallar. Por eso hay umbrales, controles y una persona al final.
