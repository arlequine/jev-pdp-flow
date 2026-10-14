---
name: jev-cost
description: Muestra cuánto costó cada paso de la demo y cada modelo (Jev, Sonnet en Claude Code, Opus en la comparación) a partir de metrics/*.jsonl. Úsala cuando pregunten por costos, tokens, ahorro o el dashboard.
---

# Costos de la demo

1. `npm run cost` (o `npm run cost -- prioritize|refactor|review`). Herramienta MCP: `jev_cost`.
2. Resume en 3 líneas como máximo: costo y tiempo de priorizar con Jev contra Opus (`npm run compare`), costo del refactor con Sonnet en Claude Code contra la estimación con Opus, y costo de la revisión.
3. Para verlo en gráficas: `npm run dashboard` → http://localhost:4300. Para las diapositivas: `npm run dashboard:export`.

Reglas: las cifras salen de `metrics/*.jsonl`, nunca las estimes ni las redondees de memoria. Si una llamada a Jev no trae tokens, su costo es "sin dato": dilo así. La columna "con Opus" es una estimación (mismos tokens a precio de Opus) y hay que llamarla así.
