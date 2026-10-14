// ProductPage.tsx
// PDP principal. NO TOCAR sin hablar con frontend (ver incidentes de marzo y julio).
// TODO: separar en componentes cuando haya tiempo
import { useEffect, useState } from 'react';
import { PriceBlock } from '../features/pdp/PriceBlock';
import '../features/pdp/pdp.css';
import { VariantSelector } from '../features/pdp/VariantSelector';
import { StockBadge } from '../features/pdp/StockBadge';
import { AddToCart } from '../features/pdp/AddToCart';
import { pickVariant, type VariantView } from '../features/pdp/variants';
import { SizeGuide } from '../features/pdp/SizeGuide';

export default function ProductPage(props: any) {
  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedColor, setSelectedColor] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<any>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('desc');
  const [showGuide, setShowGuide] = useState(false);
  const [wish, setWish] = useState(false);
  const [cp, setCp] = useState('');
  const [shipMsg, setShipMsg] = useState('');
  const [faqOpen, setFaqOpen] = useState(-1);
  const [promoLeft, setPromoLeft] = useState('');
  const [recent, setRecent] = useState<any[]>([]);
  // const [loading, setLoading] = useState(true)

  // countdown de la promo (fecha fija, la cambia marketing a mano)
  useEffect(() => {
    const end = new Date('2026-11-20T23:59:59-06:00').getTime();
    const t = setInterval(() => {
      const diff = end - Date.now();
      if (diff <= 0) {
        setPromoLeft('');
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setPromoLeft(d + 'd ' + h + 'h ' + m + 'm');
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // vistos recientemente + favoritos (localStorage)
  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem('recent') || '[]');
      setRecent(r.filter((x: any) => x !== props.slug).slice(0, 4));
      localStorage.setItem('recent', JSON.stringify([props.slug].concat(r.filter((x: any) => x !== props.slug)).slice(0, 8)));
      const w = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWish(w.indexOf(props.slug) !== -1);
    } catch (e) {
      console.log(e);
    }
  }, []);

  useEffect(() => {
    // 1) producto
    fetch('/api/legacy/products/' + props.slug)
      .then((r) => r.json())
      .then((p) => {
        setProduct(p);
        document.title = 'Tienda Norte';
        // 2) variantes
        fetch('/api/legacy/products/' + p.id + '/variants')
          .then((r) => r.json())
          .then((vs) => {
            setVariants(vs);
            if (vs.length > 0) {
              setSelectedColor(vs[0].color);
              setSelectedSize(vs[0].size);
            }
            // 3) stock
            fetch('/api/legacy/stock?variantIds=' + vs.map((v: any) => v.id).join(','))
              .then((r) => r.json())
              .then((st) => {
                setStock(st);
                // 4) reseñas
                fetch('/api/legacy/products/' + p.id + '/reviews')
                  .then((r) => r.json())
                  .then((rs) => {
                    setReviews(rs);
                  });
              });
          });
      })
      .catch((e) => {
        console.log('error cargando producto', e);
      });
  }, []);

  if (!product) return null;

  // colores únicos en el orden en que vienen
  const colors: any[] = [];
  variants.forEach((v) => {
    if (colors.indexOf(v.color) === -1) colors.push(v.color);
  });
  const sizes: any[] = [];
  variants.forEach((v) => {
    if (sizes.indexOf(v.size) === -1) sizes.push(v.size);
  });

  // variantes con su stock y su precio (PDP-142.5)
  const variantViews: VariantView[] = variants.map((v) => ({
    sku: v.sku,
    color: v.color,
    size: v.size,
    image: v.image,
    price: v.priceMoney,
    stock: (stock.find((x) => x.variantId === v.id) || { qty: 0 }).qty,
  }));
  const selected = pickVariant(variantViews, selectedColor, selectedSize);

  const chooseColor = (c: string) => {
    setSelectedColor(c);
    const v = variantViews.find((x) => x.color === c);
    if (v && product.images.indexOf(v.image) !== -1) setImageIndex(product.images.indexOf(v.image));
  };

  // promedio de reseñas
  let sum = 0;
  for (let i = 0; i < reviews.length; i++) {
    sum = sum + reviews[i].rating;
  }
  const avg = reviews.length > 0 ? Math.round((sum / reviews.length) * 10) / 10 : 0;

  const stars = (n: number) => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      s = s + (i < Math.round(n) ? '★' : '☆');
    }
    return s;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  };

  const colorHex = (name: string) => {
    if (name === 'Negro') return '#1f1f1f';
    if (name === 'Arena') return '#d8c3a5';
    if (name === 'Gris') return '#8a8d91';
    if (name === 'Marino') return '#1d2b4f';
    if (name === 'Blanco') return '#f4f4f2';
    if (name === 'Olivo') return '#6b7041';
    if (name === 'Terracota') return '#b5543a';
    if (name === 'Mezclilla') return '#3e5f8a';
    return '#ccc';
  };

  const toggleWish = () => {
    try {
      let w = JSON.parse(localStorage.getItem('wishlist') || '[]');
      if (w.indexOf(props.slug) !== -1) w = w.filter((x: any) => x !== props.slug);
      else w.push(props.slug);
      localStorage.setItem('wishlist', JSON.stringify(w));
      setWish(!wish);
    } catch (e) {
      console.log(e);
    }
  };

  // estimado de envío por CP (reglas que nos pasó logística en 2023)
  const calcShipping = () => {
    if (cp.length !== 5) {
      setShipMsg('CP inválido');
      return;
    }
    const zona = parseInt(cp.substring(0, 2));
    let dias = '5 a 8';
    if (zona <= 16) dias = '2 a 3';
    else if (zona >= 44 && zona <= 49) dias = '3 a 4';
    else if (zona >= 64 && zona <= 67) dias = '3 a 4';
    if (product.price > 999) setShipMsg('Envío gratis · llega en ' + dias + ' días');
    else setShipMsg('Envío $149 · llega en ' + dias + ' días');
  };

  const faqs = [
    ['¿Cómo sé mi talla?', 'Revisa la guía de tallas. Si estás entre dos tallas te recomendamos la más grande.'],
    ['¿Puedo cambiar el color?', 'Sí, dentro de los 30 días posteriores a tu compra.'],
    ['¿Hacen factura?', 'Sí, la puedes solicitar desde tu cuenta en el mes de tu compra.'],
  ];

  const images = product.images || [];
  const colorOfImage = (img: string) => (variants.find((v) => v.image === img) || { color: '' }).color;

  return (
    <div className="pdp">
      {promoLeft !== '' && <p className="pdp-promo">Buen Fin anticipado · termina en {promoLeft}</p>}
      <nav className="pdp-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/">Inicio</a> / <a href="/">Ropa</a> / <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp-row">
        {/* ---------------- IZQUIERDA: GALERIA ---------------- */}
        <div className="pdp-gallery">
          <img
            src={images[imageIndex]}
            className="pdp-main-image"
            width={800}
            height={800}
            alt={`${product.name} en color ${colorOfImage(images[imageIndex])}`}
          />
          <div className="pdp-thumbs" role="group" aria-label="Fotos del producto">
            {images.map((img: string, i: number) => (
              <button
                key={img}
                type="button"
                className={i === imageIndex ? 'pdp-thumb is-active' : 'pdp-thumb'}
                aria-label={`Ver foto ${i + 1}: ${product.name} en color ${colorOfImage(img)}`}
                aria-pressed={i === imageIndex}
                onClick={() => setImageIndex(i)}
              >
                <img src={img} alt="" width={90} height={90} />
              </button>
            ))}
          </div>
        </div>

        {/* ---------------- DERECHA: INFO ---------------- */}
        <div className="pdp-info">
          <p className="pdp-brand">{product.brand}</p>
          <h1 className="pdp-title">{product.name}</h1>
          <p className="pdp-rating">
            <span aria-hidden="true">{stars(avg)}</span> {avg} de 5 ({reviews.length} reseñas)
          </p>

          <PriceBlock price={selected ? selected.price : product.priceMoney} />
          <p className="pdp-note">Envío gratis en compras mayores a $999</p>

          <VariantSelector
            colors={colors.map((c) => ({ name: c, hex: colorHex(c) }))}
            sizes={sizes}
            variants={variantViews}
            color={selectedColor}
            size={selectedSize}
            onColor={chooseColor}
            onSize={setSelectedSize}
          />
          <button type="button" className="pdp-link" onClick={() => setShowGuide(true)}>
            Guía de tallas
          </button>

          {/* stock de la variante elegida */}
          <StockBadge stock={selected ? selected.stock : 0} />

          {/* cantidad */}
          <div className="pdp-qty" role="group" aria-label="Cantidad">
            <button type="button" aria-label="Disminuir cantidad" onClick={() => setQty(qty > 1 ? qty - 1 : 1)}>
              −
            </button>
            <output aria-live="polite">{qty}</output>
            <button type="button" aria-label="Aumentar cantidad" onClick={() => setQty(qty + 1)}>
              +
            </button>
          </div>

          {/* agregar al carrito: arriba de las reseñas; en móvil queda fijo abajo */}
          <AddToCart sku={selected?.sku} stock={selected ? selected.stock : 0} quantity={qty} />

          {/* tabs */}
          <div className="pdp-tabs" role="tablist" aria-label="Información del producto">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className={tab === id ? 'pdp-tab is-active' : 'pdp-tab'}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pdp-tab-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'desc' && product.description.split('\n\n').map((par: string, i: number) => <p key={i}>{par}</p>)}
            {tab === 'envio' && (
              <p>
                Entrega de 3 a 5 días hábiles en zona metropolitana y de 5 a 8 días en el resto del país. Envío gratis en
                compras mayores a $999.
              </p>
            )}
            {tab === 'dev' && <p>Tienes 30 días para cambios y devoluciones. La prenda debe estar sin uso y con etiquetas.</p>}
          </div>

          {/* reseñas */}
          <section className="pdp-reviews" aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="pdp-h2">
              Reseñas ({reviews.length})
            </h2>
            {reviews.map((r) => (
              <article key={r.id} className="pdp-review">
                <p className="pdp-review-head">
                  <span aria-label={`${r.rating} de 5 estrellas`}>{stars(r.rating)}</span> · {r.author} · {formatDate(r.createdAt)}
                </p>
                <p className="pdp-review-text">{r.text}</p>
              </article>
            ))}
          </section>

          {/* favoritos */}
          <button type="button" className="pdp-link" aria-pressed={wish} onClick={toggleWish}>
            {wish ? '♥ En tus favoritos' : '♡ Agregar a favoritos'}
          </button>

          {/* envío */}
          <div className="pdp-shipping">
            <label htmlFor="cp">Calcula tu envío</label>
            <div className="pdp-shipping-row">
              <input id="cp" value={cp} onChange={(e) => setCp(e.target.value)} placeholder="Código postal" inputMode="numeric" />
              <button type="button" onClick={calcShipping}>
                Calcular
              </button>
            </div>
            {shipMsg !== '' && <p aria-live="polite">{shipMsg}</p>}
          </div>
        </div>
      </div>

      {/* ---------------- PREGUNTAS FRECUENTES ---------------- */}
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

      {/* ---------------- VISTOS RECIENTEMENTE ---------------- */}
      {recent.length > 0 && (
        <section className="pdp-section" aria-labelledby="recent-title">
          <h2 id="recent-title" className="pdp-h2">
            Vistos recientemente
          </h2>
          <ul className="pdp-recent">
            {recent.map((r) => (
              <li key={r}>
                <a href={'/product/' + r}>
                  <img src={'/img/' + r + '-negro.svg'} alt="" width={120} height={120} />
                  {r.replace(/-/g, ' ')}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showGuide && <SizeGuide sizes={sizes} onClose={() => setShowGuide(false)} />}
    </div>
  );
}

const TABS: [string, string][] = [
  ['desc', 'Descripción'],
  ['envio', 'Envío'],
  ['dev', 'Devoluciones'],
];
