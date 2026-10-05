/**
 * The data the pages read: one JSON file of the project's own (`src/data/products.json`). Its contents type every
 * path a page writes — `products.data.products` — so a misspelt field is a type error, not an empty card. Swapping the
 * file for a real endpoint later changes `PRODUCTS`, and nothing else.
 */
import { source } from '@plitzi/sdk-authoring';

import sample from '../data/products.json' with { type: 'json' };

/**
 * How a page asks for the products: on the server, which reads `src/data/` and never serves it — the page arrives
 * with them in it.
 */
export const PRODUCTS = { query: '/data/products.json', runtime: 'server' } as const;

/** The categories the catalog filters by, in the order its select offers them. */
export const CATEGORIES = [
  { value: 'lighting', label: 'Lighting' },
  { value: 'paper', label: 'Paper' },
  { value: 'writing', label: 'Writing' },
  { value: 'desk', label: 'Desk' }
] as const;

/** The products file as the source of the provider named `id` — one per page, as ids are one namespace. */
export const productsSource = (id: string) => source(id, sample);
