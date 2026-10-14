import { useState } from 'react';

const faqs = [
  ['¿Cómo sé mi talla?', 'Revisa la guía de tallas. Si estás entre dos tallas te recomendamos la más grande.'],
  ['¿Puedo cambiar el color?', 'Sí, dentro de los 30 días posteriores a tu compra.'],
  ['¿Hacen factura?', 'Sí, la puedes solicitar desde tu cuenta en el mes de tu compra.'],
];

export function Faq() {
  const [faqOpen, setFaqOpen] = useState(-1);
  return (
      <section className="pdp-section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="pdp-h2">
          Preguntas frecuentes
        </h2>
        {faqs.map((f, i) => (
          <div key={i} className="pdp-faq">
            <button type="button" aria-expanded={faqOpen === i} aria-controls={`faq-${i}`} onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
              {faqOpen === i ? '−' : '+'} {f[0]}
            </button>
            {faqOpen === i && <p id={`faq-${i}`}>{f[1]}</p>}
          </div>
        ))}
      </section>
  );
}
