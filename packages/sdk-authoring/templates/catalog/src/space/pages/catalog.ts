/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * Every product, filtered by category: the select writes the choice to `state`, and the list shows only the rows
 * that match — with a count and an empty state read off the same predicate.
 */
import {
  apiContainer,
  container,
  formControl,
  heading,
  list,
  named,
  on,
  setState,
  styles,
  text
} from '@plitzi/sdk-authoring';

import { CATEGORIES, PRODUCTS, productsSource } from '../data.ts';
import { t } from '../tokens.ts';

import type { PageSpec } from '@plitzi/sdk-authoring';

/** The product grid, shared with the home page: a list is a `<ul>`, so the bullets and the indent go. */
export const grid = styles('product-grid', {
  desktop: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 20,
    margin: '0px',
    padding: '0px',
    listStyleType: 'none'
  },
  tablet: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  mobile: { gridTemplateColumns: 'minmax(0, 1fr)' }
});

const toolbar = styles('catalog-toolbar', {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: '24px'
});

const muted = styles('muted', { color: t.muted });

// One predicate, read three times: the rows, their count, and whether there are none.
const shown = "source|filter(p => (state.category ?? 'all') == 'all' or p.category == state.category)";

const products = productsSource('catalog-products');

export const catalog: PageSpec = {
  id: 'catalog',
  name: 'Products',
  slug: 'products',
  layout: { id: 'site', slot: 'site-main' },
  body: [
    heading('Products', { id: 'catalog-title', subType: 'h1' }),
    apiContainer({
      id: products.id,
      ...PRODUCTS,
      cache: true,
      children: [
        container({
          id: 'catalog-toolbar',
          class: toolbar,
          children: [
            // A control outside a form keeps its own value and fires `onChange` with `{ value, name }`.
            formControl({
              id: 'catalog-category',
              name: 'category',
              label: 'Category',
              subType: 'select',
              options: [
                { label: 'Everything', value: 'all' },
                ...CATEGORIES.map(({ value, label }) => ({ value, label }))
              ],
              defaultValue: 'all',
              // A filter always has an answer: the select is not a question that must be filled in.
              required: false,
              flows: [
                [
                  named('picked', on('onChange')),
                  setState({ key: 'category', type: 'text', value: '{{ picked.value }}' })
                ]
              ]
            }),
            text({ id: 'catalog-count', class: muted, from: products.data.products, as: `{{ ${shown}|length }} shown` })
          ]
        }),
        list({
          id: 'catalog-list',
          class: grid,
          from: products.data.products,
          as: `{{ ${shown} }}`,
          row: 'product-card'
        }),
        text('Nothing in that category yet.', {
          id: 'catalog-empty',
          class: muted,
          visible: { source: products.data.products, template: `{{ source is defined and ${shown}|length == 0 }}` }
        })
      ]
    })
  ]
};
