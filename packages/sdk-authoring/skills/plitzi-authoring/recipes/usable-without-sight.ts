/**
 * Controls a screen reader and a browser agent can use: an icon-only button says what it does, a clickable card IS a
 * button, a field keeps its label out of sight rather than dropping it, a picture says what it shows or that it only
 * decorates.
 */
import { button, fontAwesome, formControl, image, setState, styles, text, onClick } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const card = styles('plan-card', {
  display: 'flex',
  'flex-direction': 'column',
  padding: '16px',
  'text-align': 'left'
});

export const recipe: SpaceSpec = {
  name: 'Accessible',
  permanentUrl: 'accessible',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        button({ content: '', title: 'Search', children: [fontAwesome({ icon: 'fa-solid fa-magnifying-glass' })] }),
        button({
          content: '',
          class: card,
          children: [text('Pro'), text('12 € a month')],
          flows: [[onClick(), setState({ key: 'plan', type: 'text', value: 'pro' })]]
        }),
        formControl({ name: 'q', label: 'Search the docs', hideLabel: true, placeholder: 'Search…' }),
        image({ src: '/team.jpg', alt: 'The team at the 2026 offsite' }),
        image({ src: '/grain.png', decorative: true })
      ]
    }
  ]
};
