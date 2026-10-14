# Hackatón: ideas de e-commerce con "pregúntale a la IA lo justo"

El patrón de la charla, en una línea: **el código controla el flujo, Jev contesta preguntas cerradas con probabilidades y un modelo generativo escribe solo cuando hace falta texto o código.**

Este repo es un punto de partida. Puedes usar:

- el servidor MCP `jev` (herramienta `jev_ask`) desde Claude Code para probar preguntas rápido;
- `packages/jev-flow/src/jev/client.ts` (`askJev`) con versión fija, `JEV_MODE` y métricas;
- `thresholds.ts`, `rank.ts` y `review/verdict.ts` como ejemplos de cómo combinar probabilidades en código.

## Reglas para que funcione

1. **Una propiedad por pregunta.** "¿Es spam?" se divide en "¿pide datos de pago?", "¿promete un premio?", "¿presiona con tiempo?".
2. **Instrucciones en inglés, contenido tal cual.** El texto del cliente va bajo `evidence` y cada instrucción dice que es evidencia, no política.
3. **Todas las preguntas en un solo request.** Incluye las que solo aplican a algunos casos y deja que el código ignore las que no.
4. **Nada de aritmética, fechas ni conteos en Jev.** Si necesitas "¿cuántos días desde la compra?", lo calcula el código.
5. **Umbrales por costo del error.** Reembolsar dinero pide más certeza que etiquetar una reseña.
6. **Mide el costo.** Cada llamada queda en `metrics/*.jsonl`; `npm run cost` lo resume.

## Plantilla de una idea

Para cada proyecto define:

- **Decisión:** qué se decide y cuánto cuesta equivocarse.
- **Preguntas a Jev:** tipo (Choice, Noul o Score) y criterio de cada una.
- **Reglas en código:** qué se calcula y qué umbrales hay.
- **Generación:** qué escribe Claude, si es que escribe algo.
- **Éxito:** cómo sabes que funciona, con 20 o 30 casos etiquetados a mano.

---

## Ideas

### 1. Moderación y etiquetas de reseñas

Perfiles: negocio, marketing, desarrollo.

- **Decisión:** publicar, ocultar o mandar a revisión; etiquetar de qué habla cada reseña.
- **Preguntas:** `contains_personal_data`, `offensive_language`, `is_about_the_product` (no del envío), `mentions_size_fit`, `mentions_quality`, `mentions_delivery` (Noul) y `sentiment` (Score de 5 niveles).
- **Código:** datos personales → ocultar; ofensivo ≥ 0.8 → ocultar, ≥ 0.4 → revisión; etiquetas con umbral por etiqueta, calibradas con una muestra.
- **Generación:** ninguna. Opcional: Claude resume las reseñas de un producto una vez al día.
- **Éxito:** precisión al ocultar ≥ 95 % en 30 reseñas etiquetadas.

### 2. Gate de devoluciones y reembolsos

Perfiles: negocio, análisis, desarrollo. Encaja con experiencia en fraude y antilavado.

- **Decisión:** aprobar el reembolso, rechazarlo o pasarlo a una persona.
- **Código primero:** el pedido existe, está dentro de los 30 días (fecha en código), el monto no supera lo pagado.
- **Preguntas:** `customer_asks_refund`, `item_matches_order`, `policy_covers_reason`, `signals_of_abuse` (por ejemplo, devolución repetida descrita en el mensaje).
- **Código:** todas ≥ 0.9 y monto bajo → aprobar; alguna ≤ 0.1 → rechazar; el resto → persona.
- **Generación:** Claude redacta la respuesta al cliente solo cuando hay rechazo o revisión.
- **Éxito:** cero reembolsos automáticos equivocados en el set de prueba; % que se resuelve sin persona.

### 3. Fichas de producto que prometen de más

Perfiles: marketing, UX, negocio.

- **Decisión:** si la descripción afirma algo que los atributos del producto no respaldan.
- **State:** atributos del catálogo (materiales, tallas, cuidados) + descripción de marketing.
- **Preguntas:** una Noul por afirmación extraída (`claim_supported_by_attributes`); las afirmaciones las extrae el código con regex o una lista, o Claude si son libres.
- **Código:** cualquier afirmación sin respaldo ≥ 0.7 → la ficha va a corrección.
- **Generación:** Sonnet reescribe solo la ficha marcada, y Jev vuelve a verificarla (cascada verificada).
- **Éxito:** % de fichas corregidas que pasan la verificación al primer intento.

### 4. Triage de tickets de soporte

Perfiles: negocio, análisis.

- **Decisión:** a qué equipo va, qué tan urgente es y si toca dinero.
- **Preguntas:** `team` (Choice: pagos, envíos, producto, cuenta, otro), `urgency` (Score), `touches_money`, `customer_is_angry`, `mentions_legal_action` (Noul).
- **Código:** toca dinero o acción legal → prioridad alta; confianza del equipo < 0.5 → bandeja general.
- **Generación:** Claude sugiere la primera respuesta solo para tickets de prioridad alta.
- **Éxito:** % de tickets en el equipo correcto contra una muestra etiquetada.

### 5. Cumplimiento de precios en el catálogo

Perfiles: negocio, legal, desarrollo.

- **Decisión:** si una página de producto muestra el precio como lo pide la regulación (precio total, moneda, IVA incluido).
- **Código primero:** el HTML renderizado tiene un precio con formato MXN (regex); el monto coincide con el de la API (comparación en código).
- **Preguntas:** `shows_tax_included_notice`, `price_is_final_total`, `has_hidden_fees_language` sobre el texto visible.
- **Generación:** ninguna.
- **Éxito:** detecta el caso de PDP-142.4 en el tag `pdp-before` y no marca la versión corregida.

### 6. Gate de PRs de accesibilidad

Perfiles: UX, desarrollo.

- **Decisión:** si un PR empeora la accesibilidad.
- **Base:** extiende `npm run review` con preguntas nuevas (`removes_focus_style`, `adds_color_only_meaning`, `adds_unlabeled_control`) y combina con el score de Lighthouse de `npm run metrics`.
- **Código:** baja de Lighthouse > 5 puntos → bloquear sin preguntar a Jev.
- **Éxito:** bloquea `fixtures/diffs/d04` y aprueba `d05`.

### 7. Por qué abandonan el carrito

Perfiles: marketing, análisis, UX.

- **Decisión:** clasificar respuestas abiertas de una encuesta de salida.
- **Preguntas:** `reason` (Choice: precio, envío, talla, confianza, método de pago, otro), `mentions_competitor`, `would_return` (Noul).
- **Código:** conteos por motivo y por semana (en código, no en Jev).
- **Generación:** Claude escribe el resumen semanal a partir de los conteos ya calculados.
- **Éxito:** el resumen no contradice los conteos (lo verifica el código).

### 8. Asistente de tallas con reglas

Perfiles: UX, negocio.

- **Decisión:** qué talla sugerir a partir de lo que escribe la persona ("normalmente uso M pero me queda justa en los hombros").
- **Preguntas:** `usual_size` (Choice con las tallas), `prefers_loose_fit`, `mentions_shoulders_tight` (Noul).
- **Código:** la tabla de tallas y la regla de ajuste; Jev nunca convierte medidas (eso es aritmética).
- **Generación:** ninguna, o una frase corta de Claude explicando la sugerencia.
- **Éxito:** coincidencia con la talla que eligió el cliente en compras sin devolución.

---

## Cómo arrancar en 15 minutos

```bash
git clone <este repo> && cd jev-pdp-flow && npm install
cp .env.example .env   # pon tu TYPESAFE_API_KEY y JEV_MODE=live
claude --model sonnet  # /mcp debe mostrar "jev"
```

En Claude Code:

> Usa la herramienta `jev_ask` con este state `{ "evidence": { "review": "La tela es buena pero tardaron 3 semanas en llegar" } }` y estas preguntas: `is_about_the_product` (noul), `mentions_delivery` (noul), `sentiment` (score con 5 niveles). Las instrucciones en inglés.

Después pasa las preguntas a un archivo `.ts`, combina las respuestas en código y mide con 20 casos etiquetados.

## Criterios del jurado (sugeridos)

| Criterio | Pregunta |
|---|---|
| Lo justo | ¿Cada llamada a un modelo tiene una razón? ¿Lo determinista está en código? |
| Medido | ¿Hay costo por decisión y precisión en un set etiquetado? |
| Seguro | ¿El texto de terceros se trata como evidencia? ¿Qué pasa cuando la confianza es baja? |
| Útil | ¿Lo usaría mañana un equipo de negocio, UX o soporte? |
