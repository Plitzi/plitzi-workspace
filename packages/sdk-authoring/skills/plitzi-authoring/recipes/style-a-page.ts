/**
 * Style without copies: colours are tokens with a light and a dark value, a look used twice is a class, "this class
 * plus one thing" is rules on top of it (`class: [card, { … }]`, which needs an `id`), and a rule for tablet AND phone
 * is written once under `compact`.
 */
import { container, heading, styles, text } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

const card = styles('card', {
  css: {
    desktop: { display: 'flex', 'flex-direction': 'column', gap: '8px', padding: '24px', 'border-radius': '16px' },
    // Tablet (48–64rem) and mobile (below 48rem) each inherit from desktop alone: `compact` is both.
    compact: { padding: '16px' }
  },
  states: { hover: { 'border-color': 'var(--primary)' } }
});

export const recipe: SpaceSpec = {
  name: 'Styled',
  permanentUrl: 'styled',
  variables: {
    color: {
      foreground: { light: '#0c0c14', dark: '#ededf3', default: '#0c0c14' },
      card: { light: '#ffffff', dark: '#101019', default: '#ffffff' },
      primary: { light: '#4f46e5', dark: '#818cf8', default: '#4f46e5' }
    }
  },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      css: { 'background-color': 'var(--card)', color: 'var(--foreground)', padding: '48px 24px' },
      body: [
        container({ class: card, children: [heading('Plain', { subType: 'h2' }), text('The class as it is.')] }),
        container({
          id: 'featured',
          class: [card, { 'border-width': '2px', 'border-style': 'solid', 'border-color': 'var(--primary)' }],
          children: [heading('Featured', { subType: 'h2' }), text('The class, plus one thing.')]
        })
      ]
    }
  ]
};
