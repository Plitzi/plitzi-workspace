import { styles } from '../../style';

/**
 * The classes the page wears, declared once and named by the elements that wear them — so re-theming a card re-themes
 * every card. Every colour in them is a `var(--…)` of the palette in `tokens.ts`.
 */

/** The same outline on everything that can be focused from the keyboard. */
const focusRing = { outline: '2px solid var(--primary)', 'outline-offset': '3px' };

// A band wears `shell` for its sides and a class of its own for its top and bottom, so both write their sides apart: a
// `padding` shorthand in either would reset the other's. A class that owns its whole box writes the shorthand.
export const shell = styles('shell', {
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
export const backdrop = styles('backdrop', {
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

export const navLink = styles('nav-link', {
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
export const brandMark = styles('brand-mark', { width: '24px', height: '24px' });

/** The theme switch, dressed like the rest of the bar: a browser draws a bare button grey and square. */
export const iconButton = styles('icon-button', {
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
export const button = styles('button', {
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
export const kicker = styles('kicker', {
  color: 'var(--primary)',
  'font-size': '13px',
  'font-weight': '600',
  'letter-spacing': '0.04em',
  'text-transform': 'uppercase',
  margin: '0px'
});

export const sectionTitle = styles('section-title', {
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

export const sectionHead = styles('section-head', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'margin-bottom': '8px'
});

/** Copy under a title or in a card: the palette's quiet colour, at a size made for reading. */
export const bodyText = styles('body-text', {
  color: 'var(--muted)',
  'font-size': '15px',
  'line-height': '1.6',
  margin: '0px'
});

/** A card of either band: the whole card is the link, so the target is as large as what it describes. */
export const card = styles('card', {
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

export const cardHead = styles('card-head', { display: 'flex', 'align-items': 'center', gap: '10px' });

export const cardTitle = styles('card-title', {
  color: 'var(--foreground)',
  'font-size': '17px',
  'font-weight': '600',
  margin: '0px'
});

/** The arrow slides while the card around it is hovered. */
export const cardArrow = styles('card-arrow', {
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
export const tile = styles('tile', {
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
export const tones = {
  violet: styles('tone-violet', { color: 'var(--tint-violet)', 'background-color': 'var(--tint-violet-bg)' }),
  cyan: styles('tone-cyan', { color: 'var(--tint-cyan)', 'background-color': 'var(--tint-cyan-bg)' }),
  amber: styles('tone-amber', { color: 'var(--tint-amber)', 'background-color': 'var(--tint-amber-bg)' }),
  emerald: styles('tone-emerald', { color: 'var(--tint-emerald)', 'background-color': 'var(--tint-emerald-bg)' }),
  rose: styles('tone-rose', { color: 'var(--tint-rose)', 'background-color': 'var(--tint-rose-bg)' }),
  blue: styles('tone-blue', { color: 'var(--tint-blue)', 'background-color': 'var(--tint-blue-bg)' })
};

/** A path's number, in a circle: the order the three are worth reading in, not an order they must be taken in. */
export const step = styles('step', {
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
export const command = styles('command', {
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
export const guide = styles('guide', {
  'flex-direction': 'row',
  'align-items': 'flex-start',
  gap: '16px',
  padding: '20px'
});

export const guideCopy = styles('guide-copy', {
  display: 'flex',
  'flex-direction': 'column',
  gap: '4px',
  'min-width': '0px'
});

/** Each band of the page wears `shell` for its width, and one of these for what is its own. */
export const topBarBand = styles('top-bar', {
  'flex-direction': 'row',
  'align-items': 'center',
  'justify-content': 'space-between',
  'padding-top': '20px',
  'padding-bottom': '20px'
});

export const heroBand = styles('hero', {
  css: {
    desktop: { 'align-items': 'center', gap: '24px', 'padding-top': '88px', 'padding-bottom': '88px' },
    tablet: { 'padding-top': '64px', 'padding-bottom': '64px' },
    mobile: { 'padding-top': '40px', 'padding-bottom': '48px' }
  }
});

/** The two bands of cards: the paths first, the guides after, each under its own head. */
export const cardsBand = styles('cards-band', { gap: '20px', 'padding-bottom': '80px' });

/** Three columns that become two and then one, so a card is never narrower than its words. */
export const cardGrid = styles('card-grid', {
  css: {
    desktop: { display: 'grid', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', gap: '16px' },
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  }
});

/** The footer's line spans the content, not the band's padding: it belongs to what it closes. */
export const footerBand = styles('footer', {
  css: {
    desktop: { 'margin-top': 'auto', 'padding-bottom': '32px' },
    mobile: { 'padding-bottom': '24px' }
  }
});

export const footerRow = styles('footer-row', {
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

/** A tone by its name: what a card of `content.ts` says it is painted in. */
export type Tone = keyof typeof tones;
