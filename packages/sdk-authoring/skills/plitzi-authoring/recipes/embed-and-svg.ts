/**
 * Something drawn elsewhere — a map, a video player — in an `embed`, and a drawing of your own in an `svg`.
 *
 * An embed says what it shows in `title`, which is what a screen reader announces, and loads lazily. An `svg` takes
 * the markup alone, checked to be an SVG and with anything that runs taken out; drawn with `currentColor`, it follows
 * the colour of its class in both themes. Without a `label` it is decoration, hidden from readers; with one it is an
 * image that says it.
 */
import { container, embed, heading, styles, svg } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const frame = styles('map-frame', { aspectRatio: '16 / 9', width: '100%', borderRadius: '12px' });

const badge = styles('badge-icon', { width: 24, height: 24, color: 'var(--primary)' });

const CHECK =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">' +
  '<path d="M5 12l5 5L20 7"/></svg>';

export const recipe: SpaceSpec = {
  name: 'Embeds',
  permanentUrl: 'embeds',
  variables: { color: { primary: { light: '#4f46e5', dark: '#818cf8', default: '#4f46e5' } } },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        container({
          subType: 'section',
          children: [
            heading('Find us', { subType: 'h2' }),
            embed({
              id: 'shop-map',
              class: frame,
              src: 'https://www.openstreetmap.org/export/embed.html?bbox=-3.71,40.41,-3.69,40.42',
              title: 'Our shop on the map'
            })
          ]
        }),
        svg(CHECK, { class: badge }),
        svg(CHECK, { class: badge, label: 'Verified' })
      ]
    }
  ]
};
