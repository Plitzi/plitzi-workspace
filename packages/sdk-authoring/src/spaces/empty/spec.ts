import { container, heading } from '../../elements';
import { styles } from '../../style';

import type { SpaceSpec } from '../../schema';

/**
 * The space, declared — and nothing in it yet but what every space starts from: tokens for both themes, a layout the
 * pages render in, and one page.
 *
 * Add a page to `pages`, chrome every page shares (a header, a footer) to the layout around `site-main`, and a look
 * used twice as a class beside the two below. Name anything a test, a binding or an agent should point at.
 */

/** The page around every page: the background, the type, and the column the pages render in. */
const shell = styles('shell', {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
  'background-color': 'var(--background)',
  color: 'var(--foreground)',
  'font-family': 'system-ui, sans-serif'
});

const main = styles('main', { width: '100%', 'max-width': '1120px', margin: '0px auto', padding: '48px 24px' });

export const space: SpaceSpec = {
  name: 'Empty space',
  permanentUrl: 'empty-space',
  theme: { default: 'system', schemes: ['light', 'dark'] },
  // Every colour, per scheme: elements say `var(--name)`, so the palette changes here and nowhere else.
  variables: {
    color: {
      background: { light: '#fbfbfd', dark: '#09090b', default: '#fbfbfd' },
      foreground: { light: '#17171c', dark: '#fafafa', default: '#17171c' },
      muted: { light: '#5f5f6e', dark: '#a1a1aa', default: '#5f5f6e' },
      border: { light: '#e6e6ee', dark: '#27272d', default: '#e6e6ee' },
      primary: { light: '#5b3df5', dark: '#7c66ff', default: '#5b3df5' }
    }
  },
  layouts: [
    {
      id: 'site',
      body: [
        container({
          id: 'site-shell',
          class: shell,
          children: [container({ id: 'site-main', subType: 'main', class: main })]
        })
      ]
    }
  ],
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      layout: { id: 'site', slot: 'site-main' },
      body: [heading('Home', { id: 'home-title', subType: 'h1' })]
    }
  ]
};
