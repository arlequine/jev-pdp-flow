/**
 * Descripción del producto con el formato que capturan en el back-office
 * (saltos de línea, negritas y listas).
 */
export function ProductDescription({ html }: { html: string }) {
  const withBreaks = html.replace(/\n\n/g, '<br /><br />');
  return <div className="pdp-description" dangerouslySetInnerHTML={{ __html: withBreaks }} />;
}
