const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Formatea centavos como pesos mexicanos: 150742 → "$1,507.42". Solo formato; no calcula impuestos. */
export const formatMXN = (cents: number) => mxn.format(cents / 100);
