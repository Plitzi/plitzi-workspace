import { container, fontAwesome, heading, image, link, paragraph } from '../../elements';
import { styles } from '../../style';

import type { ElementSpec, SpaceSpec } from '../../schema';

/**
 * The space, declared.
 *
 * This is the whole site: a tree, some CSS and a palette. Everything else — element ids, style selector names, the
 * back-references between them — is derived from what is written here, so authoring it twice writes byte-identical
 * documents and there is no generated file to keep in step.
 *
 * It starts as the space Plitzi gives a new account, and it is yours: rename things, change the palette, delete
 * the cards. The four cards are one function called four times, which is not a saving of keystrokes — change
 * `card` and all four follow, and that is the difference between a design and four copies of one.
 *
 * Name anything a test, a binding or an agent should be able to point at (`id: 'hero-title'`). An element with no
 * name gets a positional one, which moves the moment something is inserted above it.
 */

/** The classes the page shares. Declared once, so re-theming a card re-themes every card. */
const buttonLink = styles('button-link', {
  color: 'white',
  'flex-basis': '0px',
  'flex-grow': '1',
  'flex-shrink': '1'
});

const titleRow = styles('title-container', { display: 'flex', 'align-items': 'center' });

const titleIcon = styles('title-icon', { 'margin-left': '10px' });

/**
 * The grid behind everything, pinned to the viewport.
 *
 * Four gradients rather than an image: it scales to any screen, costs no request, and follows the theme — the two
 * line colours are variables, so it is faint on light and faint on dark without a second asset.
 */
const backdrop = styles('bg-rectangles', {
  top: '0%',
  left: '0%',
  bottom: '0%',
  right: '0%',
  position: 'fixed',
  'background-image':
    'linear-gradient(0deg, var(--grid-big) 1px, transparent 1px), ' +
    'linear-gradient(90deg, var(--grid-big) 1px, transparent 1px), ' +
    'linear-gradient(0deg, var(--grid-small) 1px, transparent 1px), ' +
    'linear-gradient(90deg, var(--grid-small) 1px, transparent 1px)',
  'background-size': '100px 100px, 100px 100px, 10px 10px, 10px 10px',
  'background-position': '0% 0%, 0% 0%, 0% 0%, 0% 0%',
  'background-repeat': 'repeat, repeat, repeat, repeat',
  'background-attachment': 'scroll, scroll, scroll, scroll',
  'background-clip': 'border-box, border-box, border-box, border-box'
});

/** One of the four links along the bottom: a title with an arrow, and a line about where it goes. */
const card = (id: string, title: string, body: string, href = '#'): ElementSpec =>
  link({
    id,
    href,
    class: buttonLink,
    children: [
      container({
        class: titleRow,
        children: [
          heading({ id: `${id}-title`, content: title, subType: 'h1' }),
          fontAwesome({ icon: 'fas fa-arrow-right', class: titleIcon })
        ]
      }),
      paragraph({ content: body })
    ]
  });

export const space: SpaceSpec = {
  name: 'New space',
  permanentUrl: 'new-space',
  mode: 'desktop-first',
  theme: { default: 'system', schemes: ['light', 'dark'] },
  /**
   * Every colour the page uses, per scheme.
   *
   * `default` is what a browser with no preference gets. Nothing below names a colour directly — they are all
   * `var(--…)` — so switching the palette here re-themes the whole page, in both schemes, without touching a rule.
   */
  variables: {
    color: {
      foreground: { light: '#17171c', dark: '#fafafa', default: '#17171c' },
      'grid-big': { light: '#00000010', dark: '#ffffff10', default: '#00000010' },
      'grid-small': { light: '#0000000A', dark: '#ffffff0A', default: '#0000000A' },
      'background-outer': { light: '#dce6ff', dark: '#000000', default: '#dce6ff' },
      'background-inner': { light: '#ffffff', dark: '#080866', default: '#ffffff' }
    }
  },
  /**
   * What text is, before any class touches it.
   *
   * Per element TYPE, so every heading and paragraph follows the palette without naming a colour — which is what
   * makes the dark scheme work: a hard-coded colour would win against the theme and leave black text on black.
   */
  elements: {
    heading: { base: { color: 'var(--foreground)' } },
    text: { base: { color: 'var(--foreground)' } },
    paragraph: { base: { color: 'var(--foreground)' } },
    fontAwesome: { base: { color: 'var(--foreground)' } }
  },
  /** The arrow slides on hover. A relationship between two elements, which is a stylesheet's job, not an element's. */
  customCss: `.button-link:hover .title-icon {
  transform: translateX(10px);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0.2, 1);
  transition-duration: 150ms;
}
`,
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      isDefault: true,
      css: {
        desktop: {
          'flex-direction': 'column',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '100px',
          position: 'relative',
          'min-width': '100vw',
          'min-height': '100vh',
          'background-image':
            'radial-gradient(circle at 50% 50%, var(--background-inner) -30%, var(--background-outer) 100%)',
          'background-size': 'auto',
          'background-position': '0% 0%',
          'background-repeat': 'no-repeat',
          'background-attachment': 'scroll',
          'background-clip': 'border-box'
        },
        tablet: { 'justify-content': 'flex-start', padding: '60px' }
      },
      body: [
        container({ id: 'backdrop', class: backdrop }),
        container({
          id: 'logo',
          css: { desktop: { width: '75vw', height: '75vh', position: 'absolute' } },
          children: [
            image({
              src: 'https://cdn.plitzi.com/resources/img/favicon.svg',
              css: { desktop: { width: '100%', height: '100%', opacity: '0.45' } }
            })
          ]
        }),
        container({
          id: 'hero',
          css: { desktop: { 'z-index': '1', color: 'white', 'margin-bottom': '40px' } },
          children: [heading({ id: 'hero-title', content: 'Welcome To Plitzi', subType: 'h1' })]
        }),
        container({
          id: 'cards',
          css: {
            desktop: { display: 'flex', 'align-items': 'center', 'z-index': '1', gap: '40px' },
            tablet: {
              'flex-direction': 'column',
              'min-height': 'auto',
              'min-width': 'auto',
              'flex-grow': '1',
              'flex-shrink': '1',
              'flex-basis': '0%',
              'align-items': 'flex-start'
            }
          },
          children: [
            card('docs', 'Docs', 'Find in-depth information about Plitzi features and API.'),
            card('learn', 'Learn', 'Learn about Plitzi in an interactive course with quizzes!'),
            card('templates', 'Templates', 'Explore the Plitzi playground'),
            card('deploy', 'Deploy', 'Instantly deploy your Plitzi Space')
          ]
        })
      ]
    }
  ]
};
