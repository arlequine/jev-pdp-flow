/**
 * Genera apps/api/src/data/seed.json y las imágenes SVG de apps/web/public/img.
 * Determinista: misma salida en cada corrida (PRNG con semilla fija).
 *
 *   npm run seed
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let s = 142;
const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

type Color = { name: string; hex: string };
const C: Record<string, Color> = {
  negro: { name: 'Negro', hex: '#1f1f1f' },
  arena: { name: 'Arena', hex: '#d8c3a5' },
  gris: { name: 'Gris', hex: '#8a8d91' },
  marino: { name: 'Marino', hex: '#1d2b4f' },
  blanco: { name: 'Blanco', hex: '#f4f4f2' },
  olivo: { name: 'Olivo', hex: '#6b7041' },
  terracota: { name: 'Terracota', hex: '#b5543a' },
  mezclilla: { name: 'Mezclilla', hex: '#3e5f8a' },
};

const products = [
  { slug: 'sudadera-basica', name: 'Sudadera básica', brand: 'Norte', category: 'Sudaderas', net: 129950, colors: ['negro', 'arena', 'gris'], sizes: ['S', 'M', 'L', 'XL'], xl: 5000,
    description: 'Sudadera de felpa perchada, 80 % algodón y 20 % poliéster.\n\nCorte recto, puños y cintura con resorte. Ideal para capas en otoño.' },
  { slug: 'playera-cuello-redondo', name: 'Playera cuello redondo', brand: 'Norte', category: 'Playeras', net: 34900, colors: ['blanco', 'negro', 'olivo'], sizes: ['S', 'M', 'L', 'XL'],
    description: 'Playera de algodón peinado de 180 g.\n\nNo se deforma después de lavarla.' },
  { slug: 'chamarra-mezclilla', name: 'Chamarra de mezclilla', brand: 'Bruma', category: 'Chamarras', net: 189900, colors: ['mezclilla', 'negro'], sizes: ['S', 'M', 'L'],
    description: 'Mezclilla de 12 oz con lavado medio.\n\nBotones metálicos y dos bolsas al pecho.' },
  { slug: 'pantalon-chino', name: 'Pantalón chino', brand: 'Bruma', category: 'Pantalones', net: 99900, colors: ['arena', 'marino', 'olivo'], sizes: ['28', '30', '32', '34'],
    description: 'Gabardina elástica de corte slim.\n\nCintura con presillas y bolsas sesgadas.' },
  { slug: 'gorra-cinco-paneles', name: 'Gorra de cinco paneles', brand: 'Norte', category: 'Accesorios', net: 44900, colors: ['negro', 'arena'], sizes: ['Única'],
    description: 'Nylon ripstop con ajuste trasero.\n\nSecado rápido.' },
  { slug: 'camisa-lino', name: 'Camisa de lino', brand: 'Marea', category: 'Camisas', net: 119900, colors: ['blanco', 'arena', 'terracota'], sizes: ['S', 'M', 'L', 'XL'],
    description: 'Lino 100 % prelavado.\n\nCuello italiano y manga larga.' },
  { slug: 'shorts-deportivos', name: 'Shorts deportivos', brand: 'Marea', category: 'Deportivo', net: 52900, colors: ['negro', 'marino'], sizes: ['S', 'M', 'L'],
    description: 'Tela ligera con malla interior.\n\nBolsa con cierre para llaves.' },
  { slug: 'chaleco-acolchado', name: 'Chaleco acolchado', brand: 'Bruma', category: 'Chamarras', net: 149950, colors: ['negro', 'olivo'], sizes: ['S', 'M', 'L', 'XL'],
    description: 'Relleno sintético ligero que se guarda en su propia bolsa.\n\nRepele llovizna.' },
  { slug: 'calcetines-pack-3', name: 'Calcetines, paquete de 3', brand: 'Norte', category: 'Accesorios', net: 22900, colors: ['blanco', 'negro', 'gris'], sizes: ['Única'],
    description: 'Algodón con refuerzo en talón y punta.\n\nTres pares del mismo color.' },
  { slug: 'mochila-urbana', name: 'Mochila urbana', brand: 'Marea', category: 'Accesorios', net: 109900, colors: ['negro', 'gris'], sizes: ['Única'],
    description: 'Compartimento acolchado para laptop de 15".\n\n22 litros de capacidad.' },
  { slug: 'falda-midi', name: 'Falda midi plisada', brand: 'Marea', category: 'Faldas', net: 79950, colors: ['negro', 'terracota', 'arena'], sizes: ['XS', 'S', 'M', 'L'],
    description: 'Plisado permanente y cintura elástica.\n\nForro interior.' },
  { slug: 'sueter-punto', name: 'Suéter de punto', brand: 'Bruma', category: 'Sudaderas', net: 114900, colors: ['gris', 'marino', 'arena'], sizes: ['S', 'M', 'L', 'XL'],
    description: 'Punto grueso con mezcla de lana.\n\nCuello redondo y orillas acanaladas.' },
];

const authors = ['Ana G.', 'Luis M.', 'Carla P.', 'Jorge R.', 'Mariana T.', 'Pedro S.', 'Valeria C.', 'Diego H.', 'Sofía L.', 'Iván N.', 'Paola V.', 'Rubén A.', 'Daniela F.', 'Héctor B.'];
const texts = [
  ['Me quedó perfecta, la talla es exacta.', 5], ['Buena calidad por el precio.', 4], ['El color es un poco distinto al de la foto.', 3],
  ['Llegó rápido y bien empacado.', 5], ['Se encogió un poco después de lavarla.', 2], ['La volvería a comprar.', 5],
  ['Tela gruesa, se siente resistente.', 4], ['Me hubiera gustado más variedad de tallas.', 3], ['Muy cómoda para diario.', 5],
  ['Las costuras se ven bien hechas.', 4], ['No era lo que esperaba.', 2], ['Excelente, ya es mi favorita.', 5],
] as const;

let variantId = 1000;
let reviewId = 5000;
const out = products.map((p, i) => {
  const variants = p.colors.flatMap((c) =>
    p.sizes.map((size) => {
      let stock = Math.floor(rand() * 18);
      if (rand() < 0.15) stock = 0;
      if (p.slug === 'sudadera-basica' && c === 'arena' && size === 'XL') stock = 0; // caso de PDP-142.5
      if (p.slug === 'sudadera-basica' && c === 'negro') stock = Math.max(stock, 4);
      const v: Record<string, unknown> = {
        id: variantId++,
        sku: `${p.slug.slice(0, 3).toUpperCase()}-${C[c].name.slice(0, 3).toUpperCase()}-${size.toUpperCase()}`,
        color: C[c].name,
        size,
        stock,
      };
      if ('xl' in p && size === 'XL') v.netPriceCents = p.net + (p as { xl: number }).xl;
      return v;
    }),
  );
  const nReviews = 3 + Math.floor(rand() * 12);
  const reviews = Array.from({ length: nReviews }, (_, k) => {
    const [text, rating] = pick([...texts]);
    const day = 1 + Math.floor(rand() * 27);
    const month = 1 + Math.floor(rand() * 9);
    return { id: reviewId++, author: pick(authors), rating, text, createdAt: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T1${k % 10}:00:00.000Z` };
  });
  return {
    id: i + 1,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
    netPriceCents: p.net,
    colors: p.colors.map((c) => ({ name: C[c].name, hex: C[c].hex, image: `/img/${p.slug}-${c}.svg` })),
    sizes: p.sizes,
    variants,
    reviews,
  };
});

const seedPath = join(root, 'apps/api/src/data/seed.json');
mkdirSync(dirname(seedPath), { recursive: true });
writeFileSync(seedPath, JSON.stringify({ taxRate: 0.16, currency: 'MXN', products: out }, null, 2) + '\n');

// Imágenes: un SVG por producto y color. Sin red, sin assets externos.
const imgDir = join(root, 'apps/web/public/img');
mkdirSync(imgDir, { recursive: true });
for (const p of products) {
  for (const c of p.colors) {
    const { hex, name } = C[c];
    const light = ['blanco', 'arena'].includes(c);
    const fg = light ? '#2b2b2b' : '#f4f4f2';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<rect width="800" height="800" fill="#ecebe7"/>
<path d="M250 170 L330 130 Q400 190 470 130 L550 170 L640 290 L570 340 L540 300 L540 660 L260 660 L260 300 L230 340 L160 290 Z" fill="${hex}" stroke="${light ? '#b9b4aa' : 'none'}" stroke-width="4"/>
<text x="400" y="740" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="#2b2b2b">${p.name} · ${name}</text>
<text x="400" y="420" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="${fg}" opacity="0.6">${p.brand}</text>
</svg>
`;
    writeFileSync(join(imgDir, `${p.slug}-${c}.svg`), svg);
  }
}
console.log(`seed: ${out.length} productos, ${out.reduce((n, p) => n + p.variants.length, 0)} variantes → ${seedPath}`);
