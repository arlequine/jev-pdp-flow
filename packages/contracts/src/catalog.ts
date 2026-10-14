import { z } from 'zod';

/** GET /api/products — listado mínimo del catálogo (fuera del alcance de PDP-142). */
export const CatalogItem = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  image: z.string(),
});
export type CatalogItem = z.infer<typeof CatalogItem>;

export const CatalogResponse = z.object({ items: z.array(CatalogItem) });
export type CatalogResponse = z.infer<typeof CatalogResponse>;
