/** The home page: what the shop is, and the first products of the file as a way in. */
import { apiContainer, container, heading, link, list, styles, text } from '@plitzi/sdk-authoring';

import { grid } from './catalog.ts';
import { PRODUCTS, productsSource } from '../data.ts';
import { t } from '../tokens.ts';

import type { PageSpec } from '@plitzi/sdk-authoring';

export const hero = styles('hero', { display: 'flex', flexDirection: 'column', gap: 16, padding: '48px 0px' });

export const lede = styles('lede', { margin: '0px', maxWidth: '560px', color: t.muted, fontSize: '18px' });

export const cta = styles('cta', {
  css: {
    alignSelf: 'flex-start',
    padding: '10px 18px',
    borderRadius: '10px',
    backgroundColor: t.primary,
    color: t['on-primary'],
    fontWeight: 600,
    textDecoration: 'none'
  },
  states: { hover: { opacity: 0.9 } }
});

const featured = productsSource('home-products');

export const home: PageSpec = {
  id: 'home',
  name: 'Home',
  slug: '',
  layout: { id: 'site', slot: 'site-main' },
  body: [
    container({
      id: 'home-hero',
      subType: 'section',
      class: hero,
      children: [
        heading('Good things for a good desk', { id: 'home-title', subType: 'h1', css: { margin: '0px' } }),
        text('Lamps, paper and pens we would use ourselves.', { id: 'home-lede', class: lede }),
        link({ id: 'home-cta', href: '/products', class: cta, content: 'See every product' })
      ]
    }),
    apiContainer({
      id: featured.id,
      ...PRODUCTS,
      cache: true,
      children: [
        heading('Featured', { id: 'home-featured-title', subType: 'h2' }),
        list({
          id: 'home-featured',
          class: grid,
          from: featured.data.products,
          as: '{{ source|slice(0, 3) }}',
          row: 'product-card'
        })
      ]
    })
  ]
};
