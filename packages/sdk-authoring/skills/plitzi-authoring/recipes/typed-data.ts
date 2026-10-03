/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
/**
 * Data typed by a sample of it: `source()` turns the JSON the page reads into names the editor completes and checks —
 * `site.data.hero.titel` is a type error, not an empty heading. In a project the sample is the file itself:
 * `import home from '../../public/data/home.json' with { type: 'json' }`.
 */
import { apiContainer, heading, list, source, styles, text, twig } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const home = {
  hero: { title: 'Fresh this week', subtitle: 'Picked by the team' },
  products: [
    { title: 'Desk lamp', price: 49 },
    { title: 'Notebook', price: 12, badge: 'new' }
  ]
};

const site = source('site', home);

const grid = styles('typed-grid', {
  display: 'grid',
  gap: '12px',
  margin: '0px',
  padding: '0px',
  listStyleType: 'none'
});

export const recipe: SpaceSpec = {
  name: 'Typed data',
  permanentUrl: 'typed-data',
  formats: { price: "{{ source|currency('USD', 'en') }}" },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        apiContainer({
          id: site.id,
          query: '/data/home.json',
          cache: true,
          children: [
            heading({ from: site.data.hero.title }),
            text({ from: site.data.hero.subtitle }),
            // A template takes the paths through `twig`, each written in full.
            text({ content: twig`{{ ${site.data.products}|length }} products` }),
            list({
              id: 'products',
              class: grid,
              items: site.data.products,
              // The row's item is typed as the sample's: every field any product has.
              row: product => [
                text({ from: product.item.title }),
                text({ from: product.item.price, as: 'price' }),
                text({ from: product.item.badge, visible: product.item.badge })
              ]
            })
          ]
        })
      ]
    }
  ]
};
