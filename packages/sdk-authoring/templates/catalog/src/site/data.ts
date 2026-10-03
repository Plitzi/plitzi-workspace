/**
 * The data the pages read: one JSON file the project serves (`public/data/products.json`). Its contents type every
 * path a page writes — `products.data.products` — so a misspelt field is a type error, not an empty card. Swapping the
 * file for a real endpoint later changes `PRODUCTS_URL`, and nothing else.
 */
import { source } from '@plitzi/sdk-authoring';

import sample from '../../public/data/products.json' with { type: 'json' };

export const PRODUCTS_URL = '/data/products.json';

/** The categories the catalog filters by, in the order its select offers them. */
export const CATEGORIES = [
  { value: 'lighting', label: 'Lighting' },
  { value: 'paper', label: 'Paper' },
  { value: 'writing', label: 'Writing' },
  { value: 'desk', label: 'Desk' }
] as const;

/** The products file as the source of the provider named `id` — one per page, as ids are one namespace. */
export const productsSource = (id: string) => source(id, sample);
