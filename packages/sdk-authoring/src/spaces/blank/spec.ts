import { container, fontAwesome, heading, image, link, paragraph, text, themeToggle } from '../../elements';
import { styles } from '../../style';

import type { ElementSpec, SpaceSpec } from '../../schema';

/**
 * The space, declared.
 *
 * This is the whole site: a tree, some CSS and a palette. Everything else — element ids, style selector names, the
 * back-references between them — is derived from what is written here, so authoring it twice writes byte-identical
 * documents and there is no generated file to keep in step.
 *
 * It starts as the space Plitzi gives a new account, and it is yours: rename things, change the palette, delete the
 * guides. The guides are one function mapped over one list, which is not a saving of keystrokes — change `guideCard`
 * and all six follow, add an entry to `GUIDES` and a seventh appears, styled like the rest.
 *
 * Name anything a test, a binding or an agent should be able to point at (`id: 'hero-title'`). An element with no
 * name gets a positional one, which moves the moment something is inserted above it.
 */

/** Where the documentation lives. Every link on the page starts here, so moving the docs is one line. */
const DOCS = 'https://plitzi.com/docs';

// ── Classes ────────────────────────────────────────────────────────────────────────────────────────────────────
// Declared once and named by the elements that wear them, so re-theming a card re-themes every card.

/** The same outline on everything that can be focused from the keyboard. */
const focusRing = { outline: '2px solid var(--primary)', 'outline-offset': '3px' };

const shell = styles('shell', {
  css: {
    desktop: {
      display: 'flex',
      'flex-direction': 'column',
      width: '100%',
      'max-width': '1120px',
      'margin-left': 'auto',
      'margin-right': 'auto',
      'padding-left': '32px',
      'padding-right': '32px',
      position: 'relative',
      'z-index': '1'
    },
    tablet: { 'padding-left': '24px', 'padding-right': '24px' },
    mobile: { 'padding-left': '20px', 'padding-right': '20px' }
  }
});

/**
 * The grid behind everything, pinned to the viewport.
 *
 * Two gradients rather than an image: it scales to any screen, costs no request, and follows the theme — the line
 * colour is a variable, so it is faint on light and faint on dark without a second asset.
 */
const backdrop = styles('backdrop', {
  top: '0%',
  left: '0%',
  bottom: '0%',
  right: '0%',
  position: 'fixed',
  'background-image':
    'linear-gradient(0deg, var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
  'background-size': '48px 48px, 48px 48px',
  'background-position': '0% 0%, 0% 0%',
  'background-repeat': 'repeat, repeat',
  'background-attachment': 'scroll, scroll',
  'background-clip': 'border-box, border-box'
});

const navLink = styles('nav-link', {
  css: {
    display: 'flex',
    'align-items': 'center',
    gap: '8px',
    color: 'var(--muted)',
    'font-size': '14px',
    'font-weight': '500',
    'text-decoration': 'none',
    'border-radius': '8px',
    'padding-top': '6px',
    'padding-bottom': '6px',
    'padding-left': '10px',
    'padding-right': '10px'
  },
  states: { hover: { color: 'var(--foreground)' }, 'focus-visible': focusRing }
});

/** The theme switch, dressed like the rest of the bar: a browser draws a bare button grey and square. */
const iconButton = styles('icon-button', {
  css: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '36px',
    height: '36px',
    'border-radius': '8px',
    'border-width': '1px',
    'border-style': 'solid',
    'border-color': 'var(--border)',
    'background-color': 'var(--card)',
    color: 'var(--muted)',
    'font-size': '16px',
    cursor: 'pointer'
  },
  states: { hover: { color: 'var(--foreground)' }, 'focus-visible': focusRing }
});

/** A call to action. The base is the quiet one; `primary` is the one the eye should land on. */
const button = styles('button', {
  css: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '8px',
    height: '44px',
    'padding-left': '20px',
    'padding-right': '20px',
    'border-radius': '10px',
    'border-width': '1px',
    'border-style': 'solid',
    'border-color': 'var(--border)',
    'background-color': 'var(--card)',
    color: 'var(--foreground)',
    'font-size': '15px',
    'font-weight': '600',
    'text-decoration': 'none',
    'transition-property': 'background-color, border-color, transform',
    'transition-duration': '150ms',
    'transition-timing-function': 'ease-out'
  },
  states: {
    hover: { 'border-color': 'var(--muted)' },
    'focus-visible': focusRing
  },
  variants: {
    primary: {
      css: {
        'background-color': 'var(--primary)',
        'border-color': 'var(--primary)',
        color: 'var(--primary-foreground)',
        'box-shadow': 'var(--shadow-md)'
      },
      states: { hover: { 'background-color': 'var(--primary-hover)', 'border-color': 'var(--primary-hover)' } }
    }
  }
});

/** One guide: the whole card is the link, so the target is as large as what it describes. */
const card = styles('guide-card', {
  css: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '12px',
    'padding-top': '24px',
    'padding-bottom': '24px',
    'padding-left': '24px',
    'padding-right': '24px',
    'border-radius': '16px',
    'border-width': '1px',
    'border-style': 'solid',
    'border-color': 'var(--border)',
    'background-color': 'var(--card)',
    'box-shadow': 'var(--shadow-sm)',
    'text-decoration': 'none',
    'transition-property': 'transform, border-color, box-shadow',
    'transition-duration': '200ms',
    'transition-timing-function': 'ease-out'
  },
  states: {
    hover: { transform: 'translateY(-3px)', 'border-color': 'var(--primary)', 'box-shadow': 'var(--shadow-lg)' },
    'focus-visible': focusRing
  }
});

const cardHead = styles('guide-head', { display: 'flex', 'align-items': 'center', gap: '8px' });

/** The arrow slides while the card around it is hovered. */
const cardArrow = styles('guide-arrow', {
  css: {
    color: 'var(--muted)',
    'font-size': '13px',
    'margin-left': 'auto',
    'transition-property': 'transform, color',
    'transition-duration': '200ms',
    'transition-timing-function': 'ease-out'
  },
  ancestors: {
    [card.name]: { states: { hover: { transform: 'translateX(4px)', color: 'var(--primary)' } } }
  }
});

/** The square an icon sits in. Its colour is a tone, worn beside it: `class: [tile, tones.violet]`. */
const tile = styles('tile', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '40px',
  height: '40px',
  'border-radius': '10px',
  'font-size': '16px'
});

/** One class per tone, each a pair of palette variables — so a tone is dark-ready the moment it is declared. */
const tones = {
  violet: styles('tone-violet', { color: 'var(--tint-violet)', 'background-color': 'var(--tint-violet-bg)' }),
  cyan: styles('tone-cyan', { color: 'var(--tint-cyan)', 'background-color': 'var(--tint-cyan-bg)' }),
  amber: styles('tone-amber', { color: 'var(--tint-amber)', 'background-color': 'var(--tint-amber-bg)' }),
  emerald: styles('tone-emerald', { color: 'var(--tint-emerald)', 'background-color': 'var(--tint-emerald-bg)' }),
  rose: styles('tone-rose', { color: 'var(--tint-rose)', 'background-color': 'var(--tint-rose-bg)' }),
  blue: styles('tone-blue', { color: 'var(--tint-blue)', 'background-color': 'var(--tint-blue-bg)' })
};

/** Each band of the page wears `shell` for its width, and one of these for what is its own. */
const topBarBand = styles('top-bar', {
  'flex-direction': 'row',
  'align-items': 'center',
  'justify-content': 'space-between',
  'padding-top': '20px',
  'padding-bottom': '20px'
});

const heroBand = styles('hero', {
  css: {
    desktop: { 'align-items': 'center', gap: '24px', 'padding-top': '96px', 'padding-bottom': '80px' },
    tablet: { 'padding-top': '64px', 'padding-bottom': '56px' },
    mobile: { 'padding-top': '48px', 'padding-bottom': '40px' }
  }
});

const guidesBand = styles('guides', { gap: '20px', 'padding-bottom': '80px' });

const footerBand = styles('footer', {
  css: {
    desktop: {
      'flex-direction': 'row',
      'align-items': 'center',
      'justify-content': 'space-between',
      'margin-top': 'auto',
      'padding-top': '24px',
      'padding-bottom': '32px',
      'border-top-width': '1px',
      'border-top-style': 'solid',
      'border-top-color': 'var(--border)'
    },
    mobile: { 'flex-direction': 'column', gap: '8px' }
  }
});

// ── Content ────────────────────────────────────────────────────────────────────────────────────────────────────

type Guide = { id: string; title: string; body: string; path: string; icon: string; tone: keyof typeof tones };

/** Where to go next, as data: the grid below is this list, mapped. Each one is a page of the docs. */
const GUIDES: Guide[] = [
  {
    id: 'concepts',
    title: 'Core concepts',
    body: 'Spaces, pages and elements, the two documents behind them, and who owns what.',
    path: 'concepts',
    icon: 'fas fa-shapes',
    tone: 'violet'
  },
  {
    id: 'authoring',
    title: 'A space in code',
    body: 'Write this page as TypeScript: one declaration in, two documents out.',
    path: 'authoring',
    icon: 'fas fa-code',
    tone: 'cyan'
  },
  {
    id: 'styling',
    title: 'Styling and themes',
    body: 'Shared classes, states, breakpoints, and a palette that follows light and dark.',
    path: 'styling',
    icon: 'fas fa-palette',
    tone: 'rose'
  },
  {
    id: 'data',
    title: 'Data and bindings',
    body: 'Fetch from an API and bind what comes back to any element on the page.',
    path: 'data',
    icon: 'fas fa-database',
    tone: 'emerald'
  },
  {
    id: 'interactions',
    title: 'Interactions and flows',
    body: 'Clicks, forms and page loads wired to steps — no client code to write.',
    path: 'interactions',
    icon: 'fas fa-bolt',
    tone: 'amber'
  },
  {
    id: 'agents',
    title: 'Agents and MCP',
    body: 'Let an AI agent read and edit this space through the same rules you do.',
    path: 'agents',
    icon: 'fas fa-robot',
    tone: 'blue'
  }
];

const guideCard = (guide: Guide): ElementSpec =>
  link({
    id: guide.id,
    href: `${DOCS}/${guide.path}`,
    mode: 'external',
    target: 'blank',
    class: card,
    children: [
      container({
        class: cardHead,
        children: [
          container({ class: [tile, tones[guide.tone]], children: [fontAwesome({ icon: guide.icon })] }),
          fontAwesome({ icon: 'fas fa-arrow-right', class: cardArrow })
        ]
      }),
      heading({
        id: `${guide.id}-title`,
        content: guide.title,
        subType: 'h3',
        css: { 'font-size': '17px', 'font-weight': '600', 'margin-top': '4px', 'margin-bottom': '0px' }
      }),
      paragraph({
        content: guide.body,
        css: {
          color: 'var(--muted)',
          'font-size': '14px',
          'line-height': '1.6',
          'margin-top': '0px',
          'margin-bottom': '0px'
        }
      })
    ]
  });

// ── The page ───────────────────────────────────────────────────────────────────────────────────────────────────

const topBar = container({
  id: 'top-bar',
  class: [shell, topBarBand],
  children: [
    link({
      id: 'brand',
      href: 'https://plitzi.com',
      mode: 'external',
      target: 'blank',
      class: navLink,
      children: [
        image({ src: 'https://cdn.plitzi.com/resources/img/favicon.svg', css: { width: '24px', height: '24px' } }),
        text('Plitzi', { css: { color: 'var(--foreground)', 'font-size': '16px', 'font-weight': '700' } })
      ]
    }),
    container({
      id: 'top-actions',
      css: { display: 'flex', 'align-items': 'center', gap: '8px' },
      children: [
        link({
          id: 'top-docs',
          href: DOCS,
          mode: 'external',
          target: 'blank',
          class: navLink,
          children: [text('Docs')]
        }),
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
    'padding-top': '6px',
    'padding-bottom': '6px',
    'padding-left': '12px',
    'padding-right': '12px',
    'border-radius': '999px',
    'border-width': '1px',
    'border-style': 'solid',
    'border-color': 'var(--border)',
    'background-color': 'var(--card)',
    'font-size': '13px',
    'font-weight': '500'
  },
  children: [
    container({
      css: { width: '8px', height: '8px', 'border-radius': '999px', 'background-color': 'var(--tint-emerald)' }
    }),
    text('Your new space', { css: { color: 'var(--muted)' } })
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
      'margin-top': '0px',
      'margin-bottom': '0px'
    },
    tablet: { 'font-size': '48px' },
    mobile: { 'font-size': '38px' }
  }
});

const heroLede = paragraph({
  id: 'hero-lede',
  content:
    'This page is where your space starts. Change it in the builder, in code, or by asking an agent — ' +
    'and when you want to know how something works, the guides below go straight to it.',
  css: {
    desktop: {
      color: 'var(--muted)',
      'font-size': '18px',
      'line-height': '1.6',
      'text-align': 'center',
      'max-width': '620px',
      'margin-top': '0px',
      'margin-bottom': '0px'
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
      id: 'cta-docs',
      href: DOCS,
      mode: 'external',
      target: 'blank',
      class: button,
      variant: 'primary',
      children: [text('Read the docs'), fontAwesome({ icon: 'fas fa-arrow-right' })]
    }),
    link({
      id: 'cta-quickstart',
      href: `${DOCS}/quickstart`,
      mode: 'external',
      target: 'blank',
      class: button,
      children: [fontAwesome({ icon: 'fas fa-terminal' }), text('Quickstart')]
    })
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
   * `default` is what a browser with no preference gets. Nothing above names a colour directly — they are all
   * `var(--…)` — so switching the palette here re-themes the whole page, in both schemes, without touching a rule.
   */
  variables: {
    color: {
      background: { light: '#fbfbfd', dark: '#09090b', default: '#fbfbfd' },
      foreground: { light: '#17171c', dark: '#fafafa', default: '#17171c' },
      muted: { light: '#5f5f6e', dark: '#a1a1aa', default: '#5f5f6e' },
      card: { light: '#ffffff', dark: '#111115', default: '#ffffff' },
      border: { light: '#e6e6ee', dark: '#27272d', default: '#e6e6ee' },
      primary: { light: '#5b3df5', dark: '#7c66ff', default: '#5b3df5' },
      'primary-hover': { light: '#4a2de0', dark: '#9180ff', default: '#4a2de0' },
      'primary-foreground': { light: '#ffffff', dark: '#ffffff', default: '#ffffff' },
      glow: { light: 'rgba(91, 61, 245, 0.16)', dark: 'rgba(124, 102, 255, 0.24)', default: 'rgba(91, 61, 245, 0.16)' },
      grid: { light: '#0000000a', dark: '#ffffff0a', default: '#0000000a' },
      'tint-violet': { light: '#5b3df5', dark: '#b7a6ff', default: '#5b3df5' },
      'tint-violet-bg': { light: '#efecfe', dark: '#1c1836', default: '#efecfe' },
      'tint-cyan': { light: '#0e7490', dark: '#67d8ef', default: '#0e7490' },
      'tint-cyan-bg': { light: '#e0f5fa', dark: '#0c2a33', default: '#e0f5fa' },
      'tint-amber': { light: '#a45b00', dark: '#f5c169', default: '#a45b00' },
      'tint-amber-bg': { light: '#fcf0dc', dark: '#2e2314', default: '#fcf0dc' },
      'tint-rose': { light: '#c2255c', dark: '#f994bc', default: '#c2255c' },
      'tint-rose-bg': { light: '#fce8f0', dark: '#331623', default: '#fce8f0' },
      'tint-emerald': { light: '#0f7b55', dark: '#64d6a6', default: '#0f7b55' },
      'tint-emerald-bg': { light: '#e0f6ee', dark: '#0e2a21', default: '#e0f6ee' },
      'tint-blue': { light: '#2159c4', dark: '#8ab0f7', default: '#2159c4' },
      'tint-blue-bg': { light: '#e6edfc', dark: '#13203c', default: '#e6edfc' }
    },
    shadow: {
      'shadow-sm': {
        light: '0 1px 2px rgba(12, 12, 20, 0.05)',
        dark: '0 1px 2px rgba(0, 0, 0, 0.5)',
        default: '0 1px 2px rgba(12, 12, 20, 0.05)'
      },
      'shadow-md': {
        light: '0 1px 2px rgba(12, 12, 20, 0.06), 0 8px 20px -8px rgba(91, 61, 245, 0.45)',
        dark: '0 1px 2px rgba(0, 0, 0, 0.6), 0 8px 24px -8px rgba(124, 102, 255, 0.55)',
        default: '0 1px 2px rgba(12, 12, 20, 0.06), 0 8px 20px -8px rgba(91, 61, 245, 0.45)'
      },
      'shadow-lg': {
        light: '0 2px 4px rgba(12, 12, 20, 0.05), 0 24px 48px -20px rgba(12, 12, 20, 0.25)',
        dark: '0 2px 4px rgba(0, 0, 0, 0.6), 0 28px 56px -22px rgba(0, 0, 0, 0.85)',
        default: '0 2px 4px rgba(12, 12, 20, 0.05), 0 24px 48px -20px rgba(12, 12, 20, 0.25)'
      }
    },
    custom: {
      'font-sans':
        'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }
  },
  /** Loaded by the page itself: a face the space names here is the only one it ever fetches. */
  fonts: [
    {
      family: 'Geist',
      fallback: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      display: 'swap',
      preload: true,
      source: 'google'
    }
  ],
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
        container({ id: 'backdrop', class: backdrop }),
        topBar,
        container({
          id: 'hero',
          class: [shell, heroBand],
          children: [heroEyebrow, heroTitle, heroLede, heroActions]
        }),
        container({
          id: 'guides',
          class: [shell, guidesBand],
          children: [
            heading({
              id: 'guides-title',
              content: 'Where to go next',
              subType: 'h2',
              css: {
                'font-size': '14px',
                'font-weight': '600',
                color: 'var(--muted)',
                'margin-top': '0px',
                'margin-bottom': '0px'
              }
            }),
            container({
              id: 'cards',
              css: {
                desktop: { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '16px' },
                tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
                mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
              },
              children: GUIDES.map(guideCard)
            })
          ]
        }),
        container({
          id: 'footer',
          class: [shell, footerBand],
          children: [
            text('Made with Plitzi', { css: { color: 'var(--muted)', 'font-size': '13px' } }),
            link({
              id: 'footer-docs',
              href: DOCS,
              mode: 'external',
              target: 'blank',
              class: navLink,
              children: [text('plitzi.com/docs')]
            })
          ]
        })
      ]
    }
  ]
};
