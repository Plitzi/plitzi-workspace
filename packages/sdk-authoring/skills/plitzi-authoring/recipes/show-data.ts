/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * Show data with no backend, in a project with no server: a JSON file the browser fetches (`public/data/products.json`,
 * public), read by a provider — one card per product, a skeleton while it loads, a count, a computed value, and an
 * empty state that never flashes. A server project reads its `src/data/` on the server instead (`server-data.ts`).
 */
import { apiContainer, container, heading, list, styles, text, listItem } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

// A list is a `<ul>`, its rows `<li>`s straight inside: the grid is all its class says, the indent taken off.
const grid = styles('product-grid', {
  display: 'grid',
  'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '16px',
  margin: '0px',
  padding: '0px'
});

const card = styles('product-card', { padding: '16px', 'border-radius': '12px', 'background-color': 'var(--card)' });

// The shape of what is coming, shown until the file answers.
const skeleton = styles('product-skeleton', {
  height: '96px',
  'border-radius': '12px',
  'background-color': 'var(--card)'
});

export const recipe: SpaceSpec = {
  name: 'Catalogue',
  permanentUrl: 'catalogue',
  variables: { color: { card: { light: '#ffffff', dark: '#16161d', default: '#ffffff' } } },
  // Read anywhere as `computed.cartCount`, declared once.
  computed: { cartCount: '{{ (state.cart ?? [])|length }}' },
  // How a price is shown, said once: `text({ from: …, as: 'price' })` anywhere.
  formats: { price: "{{ source|currency('USD', 'en', { trimZeros: true }) }}" },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        text({ from: 'computed.cartCount', as: '{{ source }} in the cart' }),
        apiContainer({
          id: 'catalog',
          query: '/data/products.json',
          cache: true,
          // Shown in place of the rest until the first answer, and gone after it.
          loadingSlot: 'catalog-skeleton',
          children: [
            container({ id: 'catalog-skeleton', class: skeleton }),
            // Inside a template a source is spelled in full; a binding's own source is `source`.
            text({ from: 'catalog.data.products', as: '{{ source|length }} products' }),
            list({
              id: 'products',
              class: grid,
              items: 'catalog.data.products',
              children: [
                // One `<li>` per product. Inside a row, a binding names the row short (`products.item`), a template in
                // full (`list_products`).
                listItem({
                  class: card,
                  children: [
                    heading({ subType: 'h3', from: 'products.item.title' }),
                    text({ from: 'products.item.price', as: 'price' })
                  ]
                })
              ]
            }),
            // Revealed by the data, so it starts hidden: nothing flashes while the file loads.
            text('No products yet.', {
              visible: { source: 'catalog.data.products', template: '{{ source is defined and source|length == 0 }}' }
            })
          ]
        })
      ]
    }
  ]
};
