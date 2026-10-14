---
name: jev-vs-opus
description: Compara costo y tiempo de respuesta al priorizar las subtareas de un ticket con Jev (API nativa de TypeSafe + código) y con Opus en Claude Code. Úsala cuando pidan comparar Jev contra Opus, medir cuánto cuesta o tarda priorizar, o mostrar el ahorro.
---

# Jev vs Opus al priorizar un ticket

Misma decisión, dos formas de tomarla:

- **Jev + código:** 8 preguntas cerradas por subtarea a la API nativa de TypeSafe; el orden y los motivos los calcula el código.
- **Opus en Claude Code:** "prompt y parseo". Se le pasa el ticket completo a `claude -p --model opus` y se le pide el orden en JSON. No se usa la API de Anthropic.

## Pasos

1. Corre `npm run compare -- <TICKET>` (por defecto `PDP-142`). Con `JEV_MODE=replay` reproduce lo grabado en el ensayo, incluidos los tiempos.
   - Opus corre en un directorio temporal, sin herramientas ni MCP, para medir solo la respuesta del modelo.
   - Si falla con "No pude ejecutar Claude Code", verifica que `claude -p "hola"` funcione en esa terminal.
2. Muestra la tabla tal como sale: criterios de éxito, tiempo de respuesta, costo a precio de lista, costo que reporta Claude Code y tokens.
3. Resume en 2 o 3 líneas:
   - cuántas veces más costó y tardó Opus (la línea "Opus costó N× … y tardó M×");
   - qué criterios falló cada uno (por ejemplo, si Opus subió el "URGENTE" o no excluyó el checkout);
   - que es un solo ticket: la comparación es ilustrativa, no un benchmark.
4. Para verlo en gráficas: `npm run dashboard` (sección 1, con tiempo de respuesta).

## No hagas

- No estimes ni redondees cifras de memoria: todo sale de la salida del comando o de `metrics/compare-runs.jsonl`.
- No priorices tú el ticket para "ayudar" a la comparación: Opus se mide solo con `npm run compare`.
- Si Claude Code incluye su prompt de sistema y por eso hay muchos tokens en caché, dilo así: es el costo real de pedírselo a Opus dentro de Claude Code.
