/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * The space, assembled: a file per part, so each stays short enough to read whole — the tokens, the layout every page
 * shares, the product card, and one file per page. Add a page under `pages/` and list it here.
 *
 * The products are `src/data/products.json`, the project's own: a provider on each page reads it on the server.
 */
import { productCard } from './components/productCard.ts';
import { layout } from './layout.ts';
import { catalog } from './pages/catalog.ts';
import { home } from './pages/home.ts';
import { notFound } from './pages/notFound.ts';
import { product } from './pages/product.ts';
import { variables } from './tokens.ts';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const space: SpaceSpec = {
  name: 'Catalog',
  permanentUrl: 'catalog',
  theme: { default: 'system', schemes: ['light', 'dark'] },
  variables,
  // How a price is shown, said once: `text({ from: …, as: 'price' })` anywhere.
  formats: { price: "{{ source|currency('USD', 'en', { trimZeros: true }) }}" },
  layouts: [layout],
  components: [productCard],
  pages: [home, catalog, product, notFound]
};
