/**
 * Link to a section: the section carries an `anchor` — its id in the page; an element's `id` is only its name in the
 * space, `data-id` in the DOM — and a link's `hash` lands on it, from any page, even when the section renders late.
 */
import { container, heading, link, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const recipe: SpaceSpec = {
  name: 'Sections',
  permanentUrl: 'sections',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        link({ href: 'home', hash: 'plans', content: 'See the plans' }),
        container({
          id: 'plans-section',
          subType: 'section',
          anchor: 'plans',
          children: [heading('Plans', { subType: 'h2' }), text('Three of them.')]
        })
      ]
    },
    {
      id: 'about',
      name: 'About',
      slug: 'about',
      // → /#plans
      body: [link({ href: 'home', hash: 'plans', content: 'Plans' })]
    }
  ]
};
