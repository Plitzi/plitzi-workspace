/** The page of every address no other page answers — a mistyped link, a product taken down — sent with status 404. */
import { container, heading, link, text } from '@plitzi/sdk-authoring';

import { cta, hero, lede } from './home.ts';

import type { PageSpec } from '@plitzi/sdk-authoring';

export const notFound: PageSpec = {
  id: 'not-found',
  name: 'Not found',
  slug: '*',
  seoTitle: 'Page not found',
  layout: { id: 'site', slot: 'site-main' },
  body: [
    container({
      id: 'not-found-hero',
      subType: 'section',
      class: hero,
      children: [
        heading('Nothing on this shelf', { id: 'not-found-title', subType: 'h1', css: { margin: '0px' } }),
        text('The page you asked for is not here — it may have moved, or the link has a typo.', {
          id: 'not-found-lede',
          class: lede
        }),
        link({ id: 'not-found-cta', href: '/products', class: cta, content: 'See every product' })
      ]
    })
  ]
};
