import { useState } from 'react';
import { Catalog } from './pages/Catalog';
import ProductPage from './pages/ProductPage';

/** Router mínimo: el catálogo en "/" y la PDP en "/product/:slug". */
export function App() {
  const m = window.location.pathname.match(/^\/product\/([^/]+)/);
  const [cookiesOk, setCookiesOk] = useState(() => {
    try {
      return localStorage.getItem('cookies-ok') === '1';
    } catch {
      return false;
    }
  });
  const acceptCookies = () => {
    try {
      localStorage.setItem('cookies-ok', '1');
    } catch {}
    setCookiesOk(true);
  };
  return (
    <>
      <header className="site-header">
        <a href="/" className="logo">Tienda Norte</a>
      </header>
      <main>{m ? <ProductPage slug={decodeURIComponent(m[1])} /> : <Catalog />}</main>
      {!cookiesOk && <div className="cookie-banner">
        Usamos cookies para mejorar tu experiencia. Al seguir navegando aceptas nuestra política de privacidad y el uso de
        cookies de terceros para medición y publicidad.
        <div className="cookie-actions" onClick={acceptCookies}>
          Aceptar
        </div>
      </div>}
    </>
  );
}
