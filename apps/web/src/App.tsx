import { Catalog } from './pages/Catalog';
import ProductPage from './pages/ProductPage';

/** Router mínimo: el catálogo en "/" y la PDP en "/product/:slug". */
export function App() {
  const m = window.location.pathname.match(/^\/product\/([^/]+)/);
  return (
    <>
      <header className="site-header">
        <a href="/" className="logo">Tienda Norte</a>
      </header>
      <main>{m ? <ProductPage slug={decodeURIComponent(m[1])} /> : <Catalog />}</main>
      <div className="cookie-banner">
        Usamos cookies para mejorar tu experiencia. Al seguir navegando aceptas nuestra política de privacidad y el uso de
        cookies de terceros para medición y publicidad.
        <div className="cookie-actions">Aceptar</div>
      </div>
    </>
  );
}
