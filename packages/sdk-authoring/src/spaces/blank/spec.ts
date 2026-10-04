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
 * guides. The paths and the guides are each one function mapped over one list, which is not a saving of keystrokes —
 * change `guideCard` and all six follow, add an entry to `GUIDES` and a seventh appears, styled like the rest.
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

// A band wears `shell` for its sides and a class of its own for its top and bottom, so both write their sides apart: a
// `padding` shorthand in either would reset the other's. A class that owns its whole box writes the shorthand.
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
 * The grid behind the top of the page, fading into the background as it goes down.
 *
 * Gradients rather than an image: it scales to any screen, costs no request, and follows the theme — the line colour
 * and the fade are variables, so it is faint on light and faint on dark without a second asset. The fade is the first
 * layer, drawn over the lines, so the grid ends softly instead of at an edge.
 */
const backdrop = styles('backdrop', {
  css: {
    desktop: {
      position: 'absolute',
      top: '0px',
      left: '0px',
      right: '0px',
      height: '760px',
      'pointer-events': 'none',
      'background-image':
        'linear-gradient(180deg, transparent 0%, var(--background) 100%), linear-gradient(0deg, var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
      'background-size': '100% 100%, 48px 48px, 48px 48px',
      'background-position': '0% 0%, 50% 0%, 50% 0%',
      'background-repeat': 'no-repeat, repeat, repeat'
    },
    mobile: { height: '560px' }
  }
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
    padding: '6px 10px'
  },
  states: { hover: { color: 'var(--foreground)' }, 'focus-visible': focusRing }
});

/** The mark beside the name, at the size the bar wants. */
const brandMark = styles('brand-mark', { width: '24px', height: '24px' });

/** The theme switch, dressed like the rest of the bar: a browser draws a bare button grey and square. */
const iconButton = styles('icon-button', {
  css: {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '36px',
    height: '36px',
    'border-radius': '8px',
    border: '1px solid var(--border)',
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
    padding: '0px 20px',
    'border-radius': '10px',
    border: '1px solid var(--border)',
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

/** A section's small label over its title: what the band is about, in the palette's primary. */
const kicker = styles('kicker', {
  color: 'var(--primary)',
  'font-size': '13px',
  'font-weight': '600',
  'letter-spacing': '0.04em',
  'text-transform': 'uppercase',
  margin: '0px'
});

const sectionTitle = styles('section-title', {
  css: {
    desktop: {
      'font-size': '32px',
      'font-weight': '700',
      'letter-spacing': '-0.02em',
      'line-height': '1.15',
      margin: '0px'
    },
    mobile: { 'font-size': '26px' }
  }
});

const sectionHead = styles('section-head', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'margin-bottom': '8px'
});

/** Copy under a title or in a card: the palette's quiet colour, at a size made for reading. */
const bodyText = styles('body-text', {
  color: 'var(--muted)',
  'font-size': '15px',
  'line-height': '1.6',
  margin: '0px'
});

/** A card of either band: the whole card is the link, so the target is as large as what it describes. */
const card = styles('card', {
  css: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '12px',
    padding: '24px',
    'border-radius': '16px',
    border: '1px solid var(--border)',
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

const cardHead = styles('card-head', { display: 'flex', 'align-items': 'center', gap: '10px' });

const cardTitle = styles('card-title', {
  color: 'var(--foreground)',
  'font-size': '17px',
  'font-weight': '600',
  margin: '0px'
});

/** The arrow slides while the card around it is hovered. */
const cardArrow = styles('card-arrow', {
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
  'flex-shrink': '0',
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

/** A path's number, in a circle: the order the three are worth reading in, not an order they must be taken in. */
const step = styles('step', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '28px',
  height: '28px',
  'flex-shrink': '0',
  'border-radius': '999px',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
  'font-size': '13px',
  'font-weight': '600'
});

/** What a path does, as it would be typed — the one place the page shows code. */
const command = styles('command', {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'margin-top': 'auto',
  padding: '10px 12px',
  'border-radius': '10px',
  border: '1px solid var(--border)',
  'background-color': 'var(--code-bg)',
  color: 'var(--foreground)',
  'font-family': 'var(--font-mono)',
  'font-size': '13px',
  'white-space': 'nowrap',
  overflow: 'hidden'
});

/** A guide is smaller than a path: one line under its title, its icon beside it rather than above. */
const guide = styles('guide', { 'flex-direction': 'row', 'align-items': 'flex-start', gap: '16px', padding: '20px' });

const guideCopy = styles('guide-copy', { display: 'flex', 'flex-direction': 'column', gap: '4px', 'min-width': '0px' });

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
    desktop: { 'align-items': 'center', gap: '24px', 'padding-top': '88px', 'padding-bottom': '88px' },
    tablet: { 'padding-top': '64px', 'padding-bottom': '64px' },
    mobile: { 'padding-top': '40px', 'padding-bottom': '48px' }
  }
});

/** The two bands of cards: the paths first, the guides after, each under its own head. */
const cardsBand = styles('cards-band', { gap: '20px', 'padding-bottom': '80px' });

/** Three columns that become two and then one, so a card is never narrower than its words. */
const cardGrid = styles('card-grid', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '16px' },
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  }
});

/** The footer's line spans the content, not the band's padding: it belongs to what it closes. */
const footerBand = styles('footer', {
  css: {
    desktop: { 'margin-top': 'auto', 'padding-bottom': '32px' },
    mobile: { 'padding-bottom': '24px' }
  }
});

const footerRow = styles('footer-row', {
  css: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'space-between',
      gap: '16px',
      'padding-top': '24px',
      'border-top': '1px solid var(--border)'
    },
    mobile: { 'flex-direction': 'column', gap: '8px' }
  }
});

// ── Content ────────────────────────────────────────────────────────────────────────────────────────────────────

type Path = { id: string; title: string; body: string; path: string; icon: string; tone: keyof typeof tones };

/**
 * The three ways to change this page — the builder, code, an agent — as data: the band is this list, mapped. They
 * are the same space either way, so any one of them can be put down and another picked up.
 */
const PATHS: (Path & { command?: string })[] = [
  {
    id: 'path-builder',
    title: 'In the builder',
    body: 'Select anything on this page and change it: drag elements in, style them, wire them to data, and publish.',
    path: 'elements',
    icon: 'fas fa-pen-ruler',
    tone: 'violet'
  },
  {
    id: 'path-code',
    title: 'In code',
    body: 'The same space as TypeScript, in a project of your own — served by your server, or pushed back here.',
    path: 'cli',
    icon: 'fas fa-code',
    tone: 'cyan',
    command: 'npx @plitzi/cli create my-site'
  },
  {
    id: 'path-agent',
    title: 'With an agent',
    body: 'Connect Claude or any MCP client. It reads and edits this space under the same rules as you do.',
    path: 'agents',
    icon: 'fas fa-robot',
    tone: 'blue'
  }
];

/** Where to read on, as data: the grid below is this list, mapped. Each one is a page of the docs. */
const GUIDES: Path[] = [
  {
    id: 'concepts',
    title: 'Core concepts',
    body: 'Spaces, pages, elements, and who owns what.',
    path: 'concepts',
    icon: 'fas fa-shapes',
    tone: 'violet'
  },
  {
    id: 'authoring',
    title: 'A space in code',
    body: 'One declaration in, two documents out.',
    path: 'authoring',
    icon: 'fas fa-code',
    tone: 'cyan'
  },
  {
    id: 'styling',
    title: 'Styling and themes',
    body: 'Classes, states, breakpoints, light and dark.',
    path: 'styling',
    icon: 'fas fa-palette',
    tone: 'rose'
  },
  {
    id: 'data',
    title: 'Data and bindings',
    body: 'Fetch from an API, show it anywhere.',
    path: 'data',
    icon: 'fas fa-database',
    tone: 'emerald'
  },
  {
    id: 'interactions',
    title: 'Interactions and flows',
    body: 'Clicks and forms wired to steps, no code.',
    path: 'interactions',
    icon: 'fas fa-bolt',
    tone: 'amber'
  },
  {
    id: 'quickstart',
    title: 'Quickstart',
    body: 'From a new space to a published site.',
    path: 'quickstart',
    icon: 'fas fa-flag-checkered',
    tone: 'blue'
  }
];

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
      'code-bg': { light: '#f4f4f8', dark: '#18181d', default: '#f4f4f8' },
      border: { light: '#e6e6ee', dark: '#27272d', default: '#e6e6ee' },
      primary: { light: '#5b3df5', dark: '#7c66ff', default: '#5b3df5' },
      'primary-hover': { light: '#4a2de0', dark: '#9180ff', default: '#4a2de0' },
      'primary-foreground': { light: '#ffffff', dark: '#ffffff', default: '#ffffff' },
      glow: { light: 'rgba(91, 61, 245, 0.16)', dark: 'rgba(124, 102, 255, 0.24)', default: 'rgba(91, 61, 245, 0.16)' },
      grid: { light: '#0000000d', dark: '#ffffff0d', default: '#0000000d' },
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
        'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      'font-mono': '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
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
    },
    {
      family: 'Geist Mono',
      fallback: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      weights: [400],
      styles: ['normal'],
      display: 'swap',
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
