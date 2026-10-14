import { useState } from 'react';
import type { ProductDetail } from '@jev/contracts';
import '../features/pdp/pdp.css';
import { useProduct } from '../features/pdp/useProduct';
import { PdpError, PdpLoading } from '../features/pdp/PdpStatus';
import { PromoBanner } from '../features/pdp/PromoBanner';
import { Gallery } from '../features/pdp/Gallery';
import { PriceBlock } from '../features/pdp/PriceBlock';
import { VariantSelector } from '../features/pdp/VariantSelector';
import { StockBadge } from '../features/pdp/StockBadge';
import { Quantity } from '../features/pdp/Quantity';
import { AddToCart } from '../features/pdp/AddToCart';
import { DetailsTabs } from '../features/pdp/DetailsTabs';
import { Reviews } from '../features/pdp/Reviews';
import { WishlistButton } from '../features/pdp/WishlistButton';
import { ShippingEstimator } from '../features/pdp/ShippingEstimator';
import { Faq } from '../features/pdp/Faq';
import { RecentlyViewed } from '../features/pdp/RecentlyViewed';
import { SizeGuide } from '../features/pdp/SizeGuide';
import { stars } from '../features/pdp/reviewFormat';
import { pickVariant, toViews } from '../features/pdp/variants';
import { useProductSeo } from '../features/pdp/seo';

/** PDP: una request, estados de carga y error, y composición de componentes chicos. */
export default function ProductPage({ slug }: { slug: string }) {
  const p = useProduct(slug);
  if (p.status === 'loading') return <PdpLoading />;
  if (p.status === 'error') return <PdpError message={p.error} onRetry={p.retry} />;
  return <ProductView product={p.data} />;
}

function ProductView({ product }: { product: ProductDetail }) {
  useProductSeo(product);
  const variants = toViews(product);
  const images = product.colors.map((c) => c.image);
  const [selectedColor, setSelectedColor] = useState(variants[0].color);
  const [selectedSize, setSelectedSize] = useState(variants[0].size);
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [showGuide, setShowGuide] = useState(false);
  const selected = pickVariant(variants, selectedColor, selectedSize);
  const colorOfImage = (img: string) => product.colors.find((c) => c.image === img)?.name ?? '';

  const chooseColor = (c: string) => {
    setSelectedColor(c);
    setImageIndex(Math.max(0, product.colors.findIndex((x) => x.name === c)));
  };

  return (
    <div className="pdp">
      <PromoBanner />
      <nav className="pdp-breadcrumbs" aria-label="Ruta de navegación">
        <a href="/">Inicio</a> / <a href="/">Ropa</a> / <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp-row">
        <Gallery product={product} images={images} imageIndex={imageIndex} setImageIndex={setImageIndex} colorOfImage={colorOfImage} />

        <div className="pdp-info">
          <p className="pdp-brand">{product.brand}</p>
          <h1 className="pdp-title">{product.name}</h1>
          <p className="pdp-rating">
            <span aria-hidden="true">{stars(product.reviews.average)}</span> {product.reviews.average} de 5 ({product.reviews.count} reseñas)
          </p>

          <PriceBlock price={selected ? selected.price : product.price} />
          <p className="pdp-note">Envío gratis en compras mayores a $999</p>

          <VariantSelector
            colors={product.colors}
            sizes={product.sizes}
            variants={variants}
            color={selectedColor}
            size={selectedSize}
            onColor={chooseColor}
            onSize={setSelectedSize}
          />
          <button type="button" className="pdp-link" onClick={() => setShowGuide(true)}>
            Guía de tallas
          </button>

          <StockBadge stock={selected ? selected.stock : 0} />
          <Quantity qty={qty} setQty={setQty} />
          {/* en móvil queda fijo abajo */}
          <AddToCart sku={selected?.sku} stock={selected ? selected.stock : 0} quantity={qty} />

          <DetailsTabs description={product.description} />
          <Reviews data={product.reviews} />
          <WishlistButton slug={product.slug} />
          <ShippingEstimator priceCents={(selected ? selected.price : product.price).amountCents} />
        </div>
      </div>

      <Faq />
      <RecentlyViewed slug={product.slug} />
      {showGuide && <SizeGuide sizes={product.sizes} onClose={() => setShowGuide(false)} />}
    </div>
  );
}
