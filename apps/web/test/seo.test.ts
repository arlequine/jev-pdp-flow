import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { ProductDetail } from '@jev/contracts';
import { createApp } from '../../api/src/app';
import { metaDescription, productJsonLd } from '../src/features/pdp/seo';

const api = createApp({ latencyMs: 0 });
const get = async (slug: string) => ProductDetail.parse((await request(api).get(`/api/products/${slug}`)).body);

describe('SEO de la PDP (PDP-142.8)', () => {
  it('JSON-LD Product con precio con IVA, moneda y disponibilidad', async () => {
    const ld = productJsonLd(await get('sudadera-basica'), 'https://tienda.example');
    expect(ld['@type']).toBe('Product');
    expect(ld.offers).toMatchObject({ priceCurrency: 'MXN', price: '1507.42', availability: 'https://schema.org/InStock' });
    expect(ld.image[0]).toBe('https://tienda.example/img/sudadera-basica-negro.svg');
  });

  it('meta description distinta por producto y de máximo 155 caracteres', async () => {
    const a = metaDescription(await get('sudadera-basica'));
    const b = metaDescription(await get('camisa-lino'));
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(155);
  });
});
