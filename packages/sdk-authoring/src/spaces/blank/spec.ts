import { DOCS, GUIDES, PATHS } from './content.ts';
import {
  backdrop,
  bodyText,
  brandMark,
  button,
  card,
  cardArrow,
  cardGrid,
  cardHead,
  cardsBand,
  cardTitle,
  command,
  footerBand,
  footerRow,
  guide,
  guideCopy,
  heroBand,
  iconButton,
  kicker,
  navLink,
  sectionHead,
  sectionTitle,
  shell,
  step,
  tile,
  tones,
  topBarBand
} from './theme.ts';
import { fonts, variables } from './tokens.ts';
import { container, fontAwesome, heading, image, link, paragraph, text, themeToggle } from '../../elements';

import type { Path } from './content.ts';
import type { ElementSpec, SpaceSpec } from '../../schema';

/**
 * The space, declared: this file is the page, and it assembles the rest — the palette in `tokens.ts`, the classes in
 * `theme.ts`, what the page says in `content.ts`. Everything else — element ids, style selector names, the
 * back-references between them — is derived from what is written in them, so authoring it twice writes byte-identical
 * documents and there is no generated file to keep in step.
 *
 * It starts as the space Plitzi gives a new account, and it is yours: rename things, change the palette, delete the
 * guides. The paths and the guides are each one function mapped over one list, which is not a saving of keystrokes —
 * change `guideCard` and all six follow, add an entry to `GUIDES` and a seventh appears, styled like the rest.
 *
 * Name anything a test, a binding or an agent should be able to point at (`id: 'hero-title'`). An element with no
 * name gets a positional one, which moves the moment something is inserted above it.
 */

// ── The cards ──────────────────────────────────────────────────────────────────────────────────────────────────

const pathCard = (entry: (typeof PATHS)[number], index: number): ElementSpec =>
  link({
    id: entry.id,
    href: `${DOCS}/${entry.path}`,
    mode: 'external',
    target: 'blank',
    class: card,
    children: [
      container({
        class: cardHead,
        children: [
          container({ class: [tile, tones[entry.tone]], children: [fontAwesome({ icon: entry.icon })] }),
          // The number is for the eye: read out, "1" before "In the builder" says nothing the order does not.
          container({ class: step, decorative: true, children: [text({ content: String(index + 1) })] }),
          fontAwesome({ icon: 'fas fa-arrow-right', class: cardArrow })
        ]
      }),
      heading({ id: `${entry.id}-title`, content: entry.title, subType: 'h3', class: cardTitle }),
      paragraph({ content: entry.body, class: bodyText }),
      ...(entry.command
        ? [
            container({
              class: command,
              children: [
                container({ decorative: true, css: { color: 'var(--muted)' }, children: [text({ content: '$' })] }),
                text({ content: entry.command })
              ]
            })
          ]
        : [])
    ]
  });

const guideCard = (entry: Path): ElementSpec =>
  link({
    id: entry.id,
    href: `${DOCS}/${entry.path}`,
    mode: 'external',
    target: 'blank',
    class: [card, guide],
    children: [
      container({ class: [tile, tones[entry.tone]], children: [fontAwesome({ icon: entry.icon })] }),
      container({
        class: guideCopy,
        children: [
          heading({ id: `${entry.id}-title`, content: entry.title, subType: 'h3', class: cardTitle }),
          paragraph({ content: entry.body, class: bodyText })
        ]
      }),
      fontAwesome({ icon: 'fas fa-arrow-right', class: cardArrow })
    ]
  });

/** A band's head: its kicker, its title, and a line saying what is in it. */
const sectionHeader = (id: string, kickerText: string, title: string, lede: string): ElementSpec =>
  container({
    class: sectionHead,
    children: [
      text({ content: kickerText, class: kicker }),
      heading({ id: `${id}-title`, content: title, subType: 'h2', class: sectionTitle }),
      paragraph({ content: lede, class: bodyText })
    ]
  });

// ── The page ───────────────────────────────────────────────────────────────────────────────────────────────────

const topBar = container({
  id: 'top-bar',
  subType: 'header',
  class: [shell, topBarBand],
  children: [
    link({
      id: 'brand',
      href: 'https://plitzi.com',
      mode: 'external',
      target: 'blank',
      class: navLink,
      children: [
        // The name beside it already says what the mark is: read out, it would say "Plitzi" twice.
        image({ src: 'https://cdn.plitzi.com/resources/img/favicon.svg', decorative: true, class: brandMark }),
        text({ content: 'Plitzi', css: { color: 'var(--foreground)', 'font-size': '16px', 'font-weight': '700' } })
      ]
    }),
    container({
      id: 'top-actions',
      subType: 'nav',
      label: 'Plitzi',
      css: { display: 'flex', 'align-items': 'center', gap: '8px' },
      children: [
        link({ id: 'top-docs', href: DOCS, mode: 'external', target: 'blank', class: navLink, content: 'Docs' }),
        themeToggle({ id: 'theme', class: iconButton })
      ]
    })
  ]
});

const heroEyebrow = container({
  id: 'hero-eyebrow',
  css: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    padding: '6px 12px',
    'border-radius': '999px',
    border: '1px solid var(--border)',
    'background-color': 'var(--card)',
    'font-size': '13px',
    'font-weight': '500'
  },
  children: [
    container({
      css: { width: '8px', height: '8px', 'border-radius': '999px', 'background-color': 'var(--tint-emerald)' }
    }),
    text({ content: 'Your new space', css: { color: 'var(--muted)' } })
  ]
});

const heroTitle = heading({
  id: 'hero-title',
  content: 'Welcome to Plitzi',
  subType: 'h1',
  css: {
    desktop: {
      'font-size': '64px',
      'font-weight': '700',
      'letter-spacing': '-0.03em',
      'line-height': '1.05',
      'text-align': 'center',
      margin: '0px'
    },
    tablet: { 'font-size': '48px' },
    mobile: { 'font-size': '38px' }
  }
});

const heroLede = paragraph({
  id: 'hero-lede',
  content:
    'This page is where your space starts, and it is already yours. Change any of it in the builder, in code, ' +
    'or by asking an agent — below is how, and where to read more.',
  css: {
    desktop: {
      color: 'var(--muted)',
      'font-size': '18px',
      'line-height': '1.6',
      'text-align': 'center',
      'max-width': '600px',
      margin: '0px'
    },
    mobile: { 'font-size': '16px' }
  }
});

const heroActions = container({
  id: 'hero-actions',
  css: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      gap: '12px',
      'margin-top': '8px'
    },
    mobile: { 'flex-direction': 'column', 'align-items': 'stretch', width: '100%' }
  },
  children: [
    link({
      id: 'cta-quickstart',
      href: `${DOCS}/quickstart`,
      mode: 'external',
      target: 'blank',
      class: button,
      variant: 'primary',
      content: 'Start the quickstart',
      icon: 'fas fa-arrow-right',
      iconPlacement: 'after'
    }),
    link({
      id: 'cta-docs',
      href: DOCS,
      mode: 'external',
      target: 'blank',
      class: button,
      content: 'Read the docs',
      icon: 'fas fa-book-open'
    })
  ]
});

export const space: SpaceSpec = {
  name: 'New space',
  permanentUrl: 'new-space',
  mode: 'desktop-first',
  theme: { default: 'system', schemes: ['light', 'dark'] },
  variables,
  fonts,
  /**
   * What text is, before any class touches it.
   *
   * Per element TYPE, so every heading and paragraph follows the palette without naming a colour — which is what
   * makes the dark scheme work: a hard-coded colour would win against the theme and leave black text on black.
   */
  elements: {
    page: { base: { 'font-family': 'var(--font-sans)' } },
    heading: { base: { color: 'var(--foreground)' } },
    text: { base: { color: 'inherit' } },
    paragraph: { base: { color: 'var(--foreground)' } },
    fontAwesome: { base: { color: 'inherit' } }
  },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      isDefault: true,
      css: {
        'flex-direction': 'column',
        position: 'relative',
        'min-width': '100%',
        'min-height': '100dvh',
        color: 'var(--foreground)',
        'background-color': 'var(--background)',
        // A glow over the top of the page, in the palette's primary, so it follows the scheme like everything else.
        'background-image': 'radial-gradient(60rem 32rem at 50% -8rem, var(--glow), transparent 70%)',
        'background-repeat': 'no-repeat'
      },
      body: [
        container({ id: 'backdrop', class: backdrop, decorative: true }),
        topBar,
        container({
          id: 'main',
          subType: 'main',
          css: { display: 'flex', 'flex-direction': 'column' },
          children: [
            container({
              id: 'hero',
              class: [shell, heroBand],
              children: [heroEyebrow, heroTitle, heroLede, heroActions]
            }),
            container({
              id: 'paths',
              subType: 'section',
              label: 'Make it yours',
              class: [shell, cardsBand],
              children: [
                sectionHeader(
                  'paths',
                  'Make it yours',
                  'Three ways in, one space',
                  'Start with whichever suits you — the others see every change it makes.'
                ),
                container({ id: 'path-cards', class: cardGrid, children: PATHS.map(pathCard) })
              ]
            }),
            container({
              id: 'guides',
              subType: 'section',
              label: 'Guides',
              class: [shell, cardsBand],
              children: [
                sectionHeader(
                  'guides',
                  'Guides',
                  'Learn the building blocks',
                  'Each one is a page of the docs, short enough to read before you change the page it explains.'
                ),
                container({ id: 'cards', class: cardGrid, children: GUIDES.map(guideCard) })
              ]
            })
          ]
        }),
        container({
          id: 'footer',
          subType: 'footer',
          class: [shell, footerBand],
          children: [
            container({
              class: footerRow,
              children: [
                text({ content: 'Made with Plitzi', css: { color: 'var(--muted)', 'font-size': '13px' } }),
                link({
                  id: 'footer-docs',
                  href: DOCS,
                  mode: 'external',
                  target: 'blank',
                  class: navLink,
                  content: 'plitzi.com/docs'
                })
              ]
            })
          ]
        })
      ]
    }
  ]
};
