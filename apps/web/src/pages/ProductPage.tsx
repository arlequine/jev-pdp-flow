// ProductPage.tsx
// PDP principal. NO TOCAR sin hablar con frontend (ver incidentes de marzo y julio).
// TODO: separar en componentes cuando haya tiempo
// TODO: mover estilos a CSS
import { useEffect, useState } from 'react';
import { PriceBlock } from '../features/pdp/PriceBlock';
import '../features/pdp/pdp.css';
import { VariantSelector } from '../features/pdp/VariantSelector';
import { StockBadge } from '../features/pdp/StockBadge';
import { AddToCart } from '../features/pdp/AddToCart';
import { pickVariant, type VariantView } from '../features/pdp/variants';

const styles: any = {
  breadcrumbs: { fontSize: 12, color: '#bbb', marginBottom: 14 },
  crumbLink: { color: '#bbb', textDecoration: 'none' },
  brand: { fontSize: 12, color: '#bbb', textTransform: 'uppercase', letterSpacing: 2 },
  title: { fontSize: 30, margin: '6px 0 10px 0', color: '#222', fontWeight: 'normal' },
  rating: { fontSize: 13, color: '#aaa', marginBottom: 14 },
  priceNote: { fontSize: 11, color: '#ccc', marginBottom: 20 },
  sizeGuide: { fontSize: 12, color: '#bbb', textDecoration: 'underline', cursor: 'pointer', marginTop: 4 },
  qtyRow: { display: 'flex', alignItems: 'center', margin: '14px 0' },
  qtyBtn: { width: 30, height: 30, lineHeight: '30px', textAlign: 'center', border: '1px solid #eee', cursor: 'pointer', color: '#aaa' },
  qtyVal: { width: 40, textAlign: 'center', fontSize: 14 },
  tabs: { display: 'flex', borderBottom: '1px solid #eee', marginTop: 24 },
  tab: { padding: '10px 14px', fontSize: 13, color: '#bbb', cursor: 'pointer' },
  tabActive: { padding: '10px 14px', fontSize: 13, color: '#333', cursor: 'pointer', borderBottom: '2px solid #333' },
  tabBody: { fontSize: 13, color: '#999', lineHeight: 1.6, padding: '14px 0' },
  reviewsBox: { marginTop: 20 },
  reviewsTitle: { fontSize: 16, color: '#444', marginBottom: 10 },
  review: { borderTop: '1px solid #f0f0f0', padding: '12px 0' },
  reviewHead: { fontSize: 12, color: '#bbb' },
  reviewText: { fontSize: 13, color: '#999', marginTop: 4 },
  share: { marginTop: 18, fontSize: 12, color: '#ccc' },
  shareIcon: { display: 'inline-block', width: 22, height: 22, borderRadius: 11, background: '#eee', marginRight: 6, verticalAlign: 'middle' },
  modalBg: { position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,.4)', zIndex: 20 },
  modalClose: { float: 'right', cursor: 'pointer', color: '#bbb' },
  table: { width: '100%', fontSize: 12, color: '#999', borderCollapse: 'collapse' },
  td: { borderBottom: '1px solid #f3f3f3', padding: 6 },
};

const SIZE_TABLE: any = {
  S: [92, 70], M: [100, 72], L: [108, 74], XL: [116, 76],
  XS: [84, 68], '28': [72, 100], '30': [76, 102], '32': [81, 104], '34': [86, 106],
};

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

  return (
    <div className="pdp">
      {promoLeft !== '' && (
        <div style={{ background: '#f7f7f7', color: '#bbb', fontSize: 12, padding: 8, textAlign: 'center', marginBottom: 12 }}>
          Buen Fin anticipado · termina en {promoLeft}
        </div>
      )}
      <div style={styles.breadcrumbs}>
        <a href="/" style={styles.crumbLink}>
          Inicio
        </a>{' '}
        /{' '}
        <a href="/" style={styles.crumbLink}>
          Ropa
        </a>{' '}
        / {product.name}
      </div>

      <div className="pdp-row">
        {/* ---------------- IZQUIERDA: GALERIA ---------------- */}
        <div className="pdp-gallery">
          <img src={images[imageIndex]} className="pdp-main-image" width={800} height={800} />
          <div className="pdp-thumbs">
            {images.map((img: any, i: number) => (
              <img
                key={i}
                src={img}
                className={i === imageIndex ? 'pdp-thumb is-active' : 'pdp-thumb'}
                onClick={() => setImageIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* ---------------- DERECHA: INFO ---------------- */}
        <div className="pdp-info">
          <div style={styles.brand}>{product.brand}</div>
          <h1 style={styles.title}>{product.name}</h1>
          <div style={styles.rating}>
            {stars(avg)} {avg} ({reviews.length} reseñas)
          </div>

          <PriceBlock price={selected ? selected.price : product.priceMoney} />
          <div style={styles.priceNote}>Envío gratis en compras mayores a $999</div>

          <VariantSelector
            colors={colors.map((c) => ({ name: c, hex: colorHex(c) }))}
            sizes={sizes}
            variants={variantViews}
            color={selectedColor}
            size={selectedSize}
            onColor={chooseColor}
            onSize={setSelectedSize}
          />
          <div style={styles.sizeGuide} onClick={() => setShowGuide(true)}>
            Guía de tallas
          </div>

          {/* stock de la variante elegida */}
          <StockBadge stock={selected ? selected.stock : 0} />

          {/* cantidad */}
          <div style={styles.qtyRow}>
            <div style={styles.qtyBtn} onClick={() => setQty(qty > 1 ? qty - 1 : 1)}>
              -
            </div>
            <div style={styles.qtyVal}>{qty}</div>
            <div style={styles.qtyBtn} onClick={() => setQty(qty + 1)}>
              +
            </div>
          </div>

          {/* agregar al carrito: arriba de las reseñas; en móvil queda fijo abajo */}
          <AddToCart sku={selected?.sku} stock={selected ? selected.stock : 0} quantity={qty} />

          {/* tabs */}
          <div style={styles.tabs}>
            <div style={tab === 'desc' ? styles.tabActive : styles.tab} onClick={() => setTab('desc')}>
              Descripción
            </div>
            <div style={tab === 'envio' ? styles.tabActive : styles.tab} onClick={() => setTab('envio')}>
              Envío
            </div>
            <div style={tab === 'dev' ? styles.tabActive : styles.tab} onClick={() => setTab('dev')}>
              Devoluciones
            </div>
          </div>
          {tab === 'desc' && (
            <div style={styles.tabBody}>
              {product.description.split('\n\n').map((par: string, i: number) => (
                <p key={i}>{par}</p>
              ))}
            </div>
          )}
          {tab === 'envio' && (
            <div style={styles.tabBody}>
              Entrega de 3 a 5 días hábiles en zona metropolitana y de 5 a 8 días en el resto del país. Envío gratis en
              compras mayores a $999.
            </div>
          )}
          {tab === 'dev' && (
            <div style={styles.tabBody}>
              Tienes 30 días para cambios y devoluciones. La prenda debe estar sin uso y con etiquetas.
            </div>
          )}

          {/* reseñas */}
          <div style={styles.reviewsBox}>
            <div style={styles.reviewsTitle}>Reseñas ({reviews.length})</div>
            {reviews.map((r) => (
              <div key={r.id} style={styles.review}>
                <div style={styles.reviewHead}>
                  {stars(r.rating)} · {r.author} · {formatDate(r.createdAt)}
                </div>
                <div style={styles.reviewText}>{r.text}</div>
              </div>
            ))}
          </div>


          {/* favoritos */}
          <div style={{ marginTop: 12, fontSize: 12, color: wish ? '#c66' : '#bbb', cursor: 'pointer' }} onClick={toggleWish}>
            {wish ? '♥ En tus favoritos' : '♡ Agregar a favoritos'}
          </div>

          {/* envío */}
          <div style={{ marginTop: 18, fontSize: 12, color: '#aaa' }}>
            Calcula tu envío
            <div style={{ display: 'flex', marginTop: 6 }}>
              <input
                value={cp}
                onChange={(e) => setCp(e.target.value)}
                placeholder="Código postal"
                style={{ width: 140, border: '1px solid #eee', padding: 6, fontSize: 12, color: '#999' }}
              />
              <div style={{ marginLeft: 8, padding: '6px 10px', background: '#f0f0f0', cursor: 'pointer' }} onClick={calcShipping}>
                Calcular
              </div>
            </div>
            {shipMsg !== '' && <div style={{ marginTop: 6 }}>{shipMsg}</div>}
          </div>

          {/* compartir */}
          <div style={styles.share}>
            Compartir: <span style={styles.shareIcon} />
            <span style={styles.shareIcon} />
            <span style={styles.shareIcon} />
          </div>
        </div>
      </div>

      {/* ---------------- PREGUNTAS FRECUENTES ---------------- */}
      <div className="pdp-section">
        <div style={styles.reviewsTitle}>Preguntas frecuentes</div>
        {faqs.map((f, i) => (
          <div key={i} style={{ borderTop: '1px solid #f0f0f0', padding: '10px 0' }}>
            <div style={{ fontSize: 13, color: '#888', cursor: 'pointer' }} onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
              {faqOpen === i ? '−' : '+'} {f[0]}
            </div>
            {faqOpen === i && <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>{f[1]}</div>}
          </div>
        ))}
      </div>

      {/* ---------------- VISTOS RECIENTEMENTE ---------------- */}
      {recent.length > 0 && (
        <div className="pdp-section">
          <div style={styles.reviewsTitle}>Vistos recientemente</div>
          <div style={{ display: 'flex' }}>
            {recent.map((r) => (
              <a key={r} href={'/product/' + r} style={{ marginRight: 16, fontSize: 12, color: '#aaa' }}>
                <img src={'/img/' + r + '-negro.svg'} style={{ width: 120, height: 120, display: 'block', background: '#f5f5f5' }} />
                {r.replace(/-/g, ' ')}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- MODAL GUIA DE TALLAS ---------------- */}
      {showGuide && (
        <div style={styles.modalBg} onClick={() => setShowGuide(false)}>
          <div className="pdp-modal" onClick={(e) => e.stopPropagation()}>
            <span style={styles.modalClose} onClick={() => setShowGuide(false)}>
              ✕
            </span>
            <h3 style={{ fontWeight: 'normal', color: '#444' }}>Guía de tallas</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <td style={styles.td}>Talla</td>
                  <td style={styles.td}>Pecho / cintura (cm)</td>
                  <td style={styles.td}>Largo (cm)</td>
                </tr>
              </thead>
              <tbody>
                {sizes.map((s) => (
                  <tr key={s}>
                    <td style={styles.td}>{s}</td>
                    <td style={styles.td}>{SIZE_TABLE[s] ? SIZE_TABLE[s][0] : '-'}</td>
                    <td style={styles.td}>{SIZE_TABLE[s] ? SIZE_TABLE[s][1] : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
