import { column, grid, row as flexRow } from '@plitzi/sdk-authoring';

import type { CssProps, ResponsiveCss, SpaceSpec, StyleRules } from '@plitzi/sdk-authoring';

/**
 * Ceniza's look, as data: two families, a palette with a value per scheme, and the shapes that repeat.
 *
 * Every colour is a variable, so light and dark are one decision each. `ink` is the deliberate exception: the
 * tasting band, the footer and anything laid over a photograph stay dark in both schemes, because they sit on
 * fire and food photography rather than on the page.
 */

const DISPLAY = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const UI = "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** The web fonts the page asks for: a `font-family` above loads only if its face is listed here. */
export const fonts: NonNullable<SpaceSpec['fonts']> = [
  {
    source: 'google',
    family: 'Fraunces',
    fallback: 'Georgia, serif',
    weights: [400, 500, 600],
    styles: ['normal', 'italic'],
    display: 'swap'
  },
  {
    source: 'google',
    family: 'Manrope',
    fallback: 'system-ui, sans-serif',
    weights: [400, 500, 600, 700],
    styles: ['normal'],
    display: 'swap',
    preload: true
  }
];

const row = (gap: string, extra: CssProps = {}): StyleRules => flexRow(gap, { 'align-items': 'center', ...extra });

const statusPill = (extra: CssProps): CssProps => ({
  'align-self': 'flex-start',
  'min-height': '30px',
  padding: '6px 12px',
  'border-radius': '999px',
  'font-size': '13px',
  'font-weight': '700',
  ...extra
});

const hoursLine = (extra: CssProps): CssProps => ({
  'justify-content': 'space-between',
  padding: '11px 0px',
  'border-top': '1px solid var(--line)',
  'margin-top': '-1px',
  'font-size': '15px',
  ...extra
});

const wrap = (maxWidth = '1240px'): CssProps => ({
  width: '100%',
  'max-width': maxWidth,
  'margin-left': 'auto',
  'margin-right': 'auto'
});

/**
 * A picture that fills its column at a fixed shape. `height: auto` hands the height back to the ratio: the image
 * element carries a square of its own so an unbound one is visible in the builder, and it would otherwise win.
 */
const media = (ratio: string, extra: CssProps = {}): CssProps => ({
  display: 'block',
  width: '100%',
  height: 'auto',
  'aspect-ratio': ratio,
  'object-fit': 'cover',
  ...extra
});

const displayType = (size: string, extra: CssProps = {}): CssProps => ({
  'font-family': DISPLAY,
  'font-size': size,
  'font-weight': '500',
  'line-height': '1.04',
  'letter-spacing': '-0.025em',
  'margin-top': '0px',
  'margin-bottom': '0px',
  color: 'var(--fg)',
  'text-wrap': 'balance',
  ...extra
});

const eyebrow = (extra: CssProps = {}): CssProps => ({
  'font-family': UI,
  'font-size': '12px',
  'font-weight': '700',
  'letter-spacing': '0.16em',
  'text-transform': 'uppercase',
  color: 'var(--accent-ink)',
  ...extra
});

const lead = (extra: CssProps = {}): CssProps => ({
  'font-size': '18px',
  'line-height': '1.65',
  color: 'var(--fg-muted)',
  'max-width': '60ch',
  ...extra
});

const card = (extra: CssProps = {}): CssProps => ({
  'background-color': 'var(--surface)',
  border: '1px solid var(--line)',
  'border-radius': '24px',
  ...extra
});

const pill = (extra: CssProps = {}): CssProps => ({
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '10px',
  padding: '15px 26px',
  'border-radius': '999px',
  border: '1px solid transparent',
  'font-family': UI,
  'font-size': '15px',
  'font-weight': '700',
  'letter-spacing': '0.01em',
  'text-decoration': 'none',
  'white-space': 'nowrap',
  cursor: 'pointer',
  transition: 'transform 220ms ease, box-shadow 220ms ease, background-color 220ms ease, border-color 220ms ease',
  ...extra
});

const chip = (extra: CssProps = {}): CssProps => ({
  display: 'inline-flex',
  'align-items': 'center',
  padding: '4px 10px',
  'border-radius': '999px',
  'background-color': 'var(--surface-2)',
  color: 'var(--fg-muted)',
  'font-size': '11px',
  'font-weight': '700',
  'letter-spacing': '0.06em',
  'text-transform': 'uppercase',
  'white-space': 'nowrap',
  ...extra
});

const threeUp = (gap: string, extra: CssProps = {}) => ({
  desktop: grid('repeat(3, minmax(0, 1fr))', gap, extra),
  tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
  mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
});

const iconTile = (size: string, extra: CssProps = {}): CssProps => ({
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: size,
  height: size,
  'min-width': size,
  'border-radius': '14px',
  'background-color': 'var(--accent-soft)',
  color: 'var(--accent-ink)',
  ...extra
});

/** A question that opens: a bare row the width of its list, with the sign drawn in `customCss`. */
const faqButton = (extra: CssProps = {}): StyleRules =>
  row('24px', {
    width: '100%',
    padding: '24px 0px',
    'justify-content': 'space-between',
    border: '0px solid transparent',
    'background-color': 'transparent',
    color: 'var(--fg)',
    cursor: 'pointer',
    'font-family': DISPLAY,
    'font-size': '22px',
    'font-weight': '500',
    'line-height': '1.3',
    'text-align': 'left',
    ...extra
  });

export const variables: SpaceSpec['variables'] = {
  color: {
    bg: { light: '#f5efe6', dark: '#0f0c0a', default: '#f5efe6' },
    'bg-glass': {
      light: 'rgba(245, 239, 230, 0.82)',
      dark: 'rgba(15, 12, 10, 0.78)',
      default: 'rgba(245, 239, 230, 0.82)'
    },
    surface: { light: '#fffaf3', dark: '#18130f', default: '#fffaf3' },
    'surface-2': { light: '#ede4d7', dark: '#231c17', default: '#ede4d7' },
    fg: { light: '#1d1713', dark: '#f4ece2', default: '#1d1713' },
    'fg-muted': { light: '#5f544b', dark: '#bcae9f', default: '#5f544b' },
    'fg-faint': { light: '#85786c', dark: '#8f8174', default: '#85786c' },
    line: { light: '#e3d8c9', dark: '#2e2620', default: '#e3d8c9' },
    'line-strong': { light: '#cbbca9', dark: '#40362d', default: '#cbbca9' },
    accent: { light: '#c2410c', dark: '#f07a3c', default: '#c2410c' },
    /** The accent as TEXT: the paint is too light to read at 12px on bone, and too dark on charcoal. */
    'accent-ink': { light: '#a3360a', dark: '#ff9d67', default: '#a3360a' },
    'accent-soft': { light: '#f7e0cf', dark: '#361a0e', default: '#f7e0cf' },
    /** What sits on the accent. White fails contrast on the brighter dark-scheme ember, so it flips to ink. */
    'on-accent': { light: '#ffffff', dark: '#160f0b', default: '#ffffff' },
    'accent-shadow': {
      light: 'rgba(194, 65, 12, 0.45)',
      dark: 'rgba(240, 122, 60, 0.35)',
      default: 'rgba(194, 65, 12, 0.45)'
    },
    brass: { light: '#e0b062', dark: '#e8b86a', default: '#e0b062' },
    ink: { light: '#16110e', dark: '#0a0807', default: '#16110e' },
    'ink-2': { light: '#221a15', dark: '#15100d', default: '#221a15' },
    'on-ink': { light: '#f6eee4', dark: '#f6eee4', default: '#f6eee4' },
    'on-ink-muted': {
      light: 'rgba(246, 238, 228, 0.72)',
      dark: 'rgba(246, 238, 228, 0.7)',
      default: 'rgba(246, 238, 228, 0.72)'
    },
    'on-ink-line': {
      light: 'rgba(246, 238, 228, 0.16)',
      dark: 'rgba(246, 238, 228, 0.14)',
      default: 'rgba(246, 238, 228, 0.16)'
    },
    shadow: { light: 'rgba(52, 30, 14, 0.28)', dark: 'rgba(0, 0, 0, 0.7)', default: 'rgba(52, 30, 14, 0.28)' }
  }
};

export const elements: SpaceSpec['elements'] = {
  heading: { base: { color: 'var(--fg)', 'margin-top': '0px', 'margin-bottom': '0px' } },
  paragraph: { base: { color: 'inherit', 'margin-top': '0px', 'margin-bottom': '0px' } },
  text: { base: { color: 'inherit' } },
  fontAwesome: { base: { color: 'inherit' } },
  image: { base: { display: 'block' } },
  link: { base: { color: 'inherit', 'text-decoration': 'none' } }
};

const declared: Record<string, ResponsiveCss> = {
  page: {
    desktop: column('0px', {
      'min-height': '100vh',
      'background-color': 'var(--bg)',
      color: 'var(--fg)',
      'font-family': UI,
      'font-size': '16px'
    })
  },
  /**
   * The text inside a pill, a link or a button. It states no type of its own: the box already carries the size,
   * weight and colour, and giving the words the box's class would draw the box a second time inside the first.
   */
  inlineLabel: {
    desktop: { color: 'inherit', 'font-size': 'inherit', 'font-weight': 'inherit', 'white-space': 'nowrap' }
  },
  /** `text` is inline; a flex column is what stacks two runs of it. */
  stack: { desktop: column('4px', { 'align-items': 'flex-start' }) },
  main: { desktop: column('0px', { width: '100%', 'align-items': 'stretch' }) },

  // ── Header ──────────────────────────────────────────────────────────────────────────────────────────────────
  headerBand: {
    desktop: {
      position: 'sticky',
      top: '0px',
      'z-index': '50',
      width: '100%',
      'background-color': 'var(--bg-glass)',
      'backdrop-filter': 'saturate(160%) blur(16px)',
      'border-bottom': '1px solid var(--line)'
    }
  },
  headerInner: {
    desktop: row('24px', { ...wrap('1320px'), padding: '14px 32px', 'justify-content': 'space-between' }),
    mobile: { padding: '12px 20px' }
  },
  brand: { desktop: row('12px', { color: 'var(--fg)' }) },
  brandMark: {
    desktop: iconTile('40px', {
      'border-radius': '999px',
      'background-image': 'linear-gradient(145deg, var(--accent), #e08a3c)',
      color: '#ffffff',
      'font-size': '17px',
      'box-shadow': '0 10px 24px -12px var(--accent-shadow)'
    })
  },
  brandName: { desktop: displayType('24px', { 'line-height': '1', 'letter-spacing': '-0.01em', color: 'inherit' }) },
  brandTag: { desktop: eyebrow({ 'font-size': '9px', color: 'var(--fg-faint)' }), mobile: { display: 'none' } },
  nav: { desktop: row('4px'), tablet: { display: 'none' } },
  navLink: {
    desktop: {
      padding: '9px 14px',
      'border-radius': '999px',
      color: 'var(--fg-muted)',
      'font-size': '14px',
      'font-weight': '600',
      transition: 'color 180ms ease, background-color 180ms ease'
    }
  },
  navLinkActive: {
    desktop: {
      padding: '9px 14px',
      'border-radius': '999px',
      color: 'var(--fg)',
      'background-color': 'var(--surface-2)',
      'font-size': '14px',
      'font-weight': '700'
    }
  },
  headerActions: { desktop: row('10px') },
  themeToggle: {
    desktop: {
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '40px',
      height: '40px',
      'border-radius': '999px',
      border: '1px solid var(--line)',
      'background-color': 'var(--surface)',
      color: 'var(--fg-muted)',
      cursor: 'pointer',
      'font-size': '15px',
      transition: 'color 180ms ease, border-color 180ms ease'
    }
  },
  headerCta: {
    desktop: pill({
      padding: '11px 20px',
      'font-size': '14px',
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)'
    }),
    mobile: { display: 'none' }
  },
  menuButton: {
    desktop: { display: 'none' },
    tablet: pill({
      padding: '10px 16px',
      'font-size': '14px',
      'background-color': 'var(--surface)',
      border: '1px solid var(--line)',
      color: 'var(--fg)'
    })
  },
  mobileMenu: {
    desktop: { display: 'none' },
    tablet: column('4px', { padding: '8px 20px 20px', 'border-top': '1px solid var(--line)' })
  },
  mobileLink: {
    desktop: row('0px', {
      'justify-content': 'space-between',
      padding: '14px 4px',
      'border-bottom': '1px solid var(--line)',
      'font-family': DISPLAY,
      'font-size': '24px',
      color: 'var(--fg)'
    })
  },
  mobileCta: {
    desktop: pill({ 'margin-top': '16px', 'background-color': 'var(--accent)', color: 'var(--on-accent)' })
  },

  // ── Buttons ─────────────────────────────────────────────────────────────────────────────────────────────────
  buttonPrimary: {
    desktop: pill({
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)',
      'box-shadow': '0 16px 32px -18px var(--accent-shadow)'
    })
  },
  buttonGhost: {
    desktop: pill({ 'background-color': 'transparent', 'border-color': 'var(--line-strong)', color: 'var(--fg)' })
  },
  buttonOnPhoto: {
    desktop: pill({
      'background-color': 'rgba(246, 238, 228, 0.08)',
      'border-color': 'rgba(246, 238, 228, 0.42)',
      color: 'var(--on-ink)',
      'backdrop-filter': 'blur(8px)'
    })
  },
  buttonOnInk: { desktop: pill({ 'background-color': 'var(--on-ink)', color: 'var(--ink)' }) },
  buttonWide: {
    desktop: pill({
      width: '100%',
      padding: '17px 26px',
      'font-size': '16px',
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)',
      'box-shadow': '0 16px 32px -18px var(--accent-shadow)'
    })
  },
  textLink: {
    desktop: row('8px', {
      color: 'var(--accent-ink)',
      'font-weight': '700',
      'font-size': '15px',
      'border-bottom': '1px solid var(--accent-soft)',
      'padding-bottom': '4px',
      transition: 'border-color 180ms ease, gap 180ms ease'
    })
  },

  // ── Hero ────────────────────────────────────────────────────────────────────────────────────────────────────
  hero: {
    desktop: {
      position: 'relative',
      display: 'flex',
      'align-items': 'flex-end',
      width: '100%',
      'min-height': '90vh',
      overflow: 'hidden',
      'background-color': 'var(--ink)'
    },
    mobile: { 'min-height': '86vh' }
  },
  pageHero: {
    desktop: {
      position: 'relative',
      display: 'flex',
      'align-items': 'flex-end',
      width: '100%',
      'min-height': '58vh',
      overflow: 'hidden',
      'background-color': 'var(--ink)'
    },
    mobile: { 'min-height': '52vh' }
  },
  heroImage: {
    desktop: {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      'object-fit': 'cover',
      transform: 'scale(1.03)'
    }
  },
  /** What keeps light type legible over a photograph nobody has seen yet. */
  heroScrim: {
    desktop: {
      position: 'absolute',
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
      'background-image':
        'linear-gradient(180deg, rgba(14, 10, 8, 0.25) 0%, rgba(14, 10, 8, 0.1) 35%, rgba(14, 10, 8, 0.82) 100%), linear-gradient(90deg, rgba(14, 10, 8, 0.55) 0%, rgba(14, 10, 8, 0) 60%)'
    }
  },
  heroContent: {
    desktop: column('28px', {
      ...wrap('1320px'),
      position: 'relative',
      'z-index': '1',
      'align-items': 'flex-start',
      padding: '0px 32px 88px'
    }),
    mobile: { padding: '0px 20px 56px', gap: '22px' }
  },
  heroEyebrow: {
    desktop: row('10px', eyebrow({ color: 'var(--brass)', 'max-width': '100%', 'flex-wrap': 'wrap' })),
    mobile: { 'font-size': '11px', 'letter-spacing': '0.1em' }
  },
  heroTitle: {
    desktop: displayType('88px', { color: 'var(--on-ink)', 'max-width': '13ch', 'line-height': '0.98' }),
    tablet: { 'font-size': '64px' },
    mobile: { 'font-size': '46px' }
  },
  pageHeroTitle: {
    desktop: displayType('76px', { color: 'var(--on-ink)', 'max-width': '16ch' }),
    tablet: { 'font-size': '58px' },
    mobile: { 'font-size': '42px' }
  },
  heroLead: {
    desktop: lead({ color: 'var(--on-ink-muted)', 'font-size': '20px', 'max-width': '46ch' }),
    mobile: { 'font-size': '17px' }
  },
  heroActions: { desktop: row('12px', { 'flex-wrap': 'wrap' }) },
  heroFacts: {
    desktop: row('40px', {
      'flex-wrap': 'wrap',
      'margin-top': '12px',
      'padding-top': '26px',
      'border-top': '1px solid var(--on-ink-line)',
      'align-items': 'flex-start'
    }),
    mobile: { gap: '22px' }
  },
  heroFactValue: { desktop: displayType('30px', { color: 'var(--on-ink)', 'line-height': '1.1' }) },
  heroFactLabel: { desktop: { color: 'var(--on-ink-muted)', 'font-size': '13px', 'letter-spacing': '0.02em' } },

  // ── Values strip ────────────────────────────────────────────────────────────────────────────────────────────
  strip: {
    desktop: {
      width: '100%',
      'background-color': 'var(--surface-2)',
      'border-bottom': '1px solid var(--line)',
      padding: '22px 32px'
    }
  },
  stripInner: {
    desktop: row('48px', { ...wrap('1320px'), 'justify-content': 'center', 'flex-wrap': 'wrap' }),
    mobile: { gap: '14px 28px', 'justify-content': 'flex-start' }
  },
  stripItem: {
    desktop: row('10px', {
      'font-size': '13px',
      'font-weight': '700',
      'letter-spacing': '0.08em',
      'text-transform': 'uppercase',
      color: 'var(--fg-muted)'
    })
  },
  stripIcon: { desktop: { color: 'var(--accent)', 'font-size': '14px' } },

  // ── Sections ────────────────────────────────────────────────────────────────────────────────────────────────
  section: {
    desktop: { width: '100%', padding: '128px 32px' },
    tablet: { padding: '96px 28px' },
    mobile: { padding: '72px 20px' }
  },
  sectionTight: {
    desktop: { width: '100%', padding: '0px 32px 128px' },
    tablet: { padding: '0px 28px 96px' },
    mobile: { padding: '0px 20px 72px' }
  },
  sectionInner: { desktop: column('56px', wrap('1240px')), mobile: { gap: '40px' } },
  sectionHead: { desktop: column('18px', { 'align-items': 'flex-start', 'max-width': '760px' }) },
  sectionHeadRow: {
    desktop: row('32px', { 'justify-content': 'space-between', 'align-items': 'flex-end', 'flex-wrap': 'wrap' })
  },
  eyebrow: { desktop: eyebrow() },
  sectionTitle: {
    desktop: displayType('56px'),
    tablet: { 'font-size': '44px' },
    mobile: { 'font-size': '36px' }
  },
  sectionLead: { desktop: lead(), mobile: { 'font-size': '16px' } },
  bodyText: { desktop: lead({ 'font-size': '17px' }) },

  split: {
    desktop: grid('minmax(0, 1fr) minmax(0, 1fr)', '80px', { 'align-items': 'center' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '48px' }
  },
  splitText: { desktop: column('26px', { 'align-items': 'flex-start' }) },
  splitMedia: { desktop: { position: 'relative', width: '100%' } },
  photoTall: {
    desktop: media('4 / 5', { 'border-radius': '28px', 'box-shadow': '0 50px 90px -60px var(--shadow)' }),
    tablet: { 'aspect-ratio': '16 / 11' }
  },
  photoWide: { desktop: media('16 / 10', { 'border-radius': '24px' }) },
  photoBadge: {
    desktop: column('4px', {
      position: 'absolute',
      left: '-28px',
      bottom: '40px',
      padding: '18px 22px',
      'border-radius': '20px',
      'background-color': 'var(--surface)',
      border: '1px solid var(--line)',
      'box-shadow': '0 30px 60px -30px var(--shadow)',
      'align-items': 'flex-start'
    }),
    tablet: { left: '20px', bottom: '20px' }
  },
  badgeValue: { desktop: displayType('36px', { color: 'var(--accent)', 'line-height': '1' }) },
  badgeLabel: { desktop: { 'font-size': '13px', color: 'var(--fg-muted)', 'font-weight': '600' } },

  statRow: {
    desktop: grid('repeat(3, minmax(0, 1fr))', '24px', { width: '100%' }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '0px' }
  },
  stat: {
    desktop: column('6px', {
      'align-items': 'flex-start',
      'padding-top': '18px',
      'border-top': '1px solid var(--line-strong)'
    }),
    mobile: { 'padding-bottom': '16px' }
  },
  statValue: { desktop: displayType('44px', { 'line-height': '1' }) },
  statLabel: { desktop: { 'font-size': '14px', color: 'var(--fg-muted)', 'line-height': '1.45' } },

  // ── Dishes ──────────────────────────────────────────────────────────────────────────────────────────────────
  dishGrid: threeUp('28px'),
  dishCard: {
    desktop: column('0px', {
      ...card(),
      overflow: 'hidden',
      transition: 'transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 320ms ease'
    })
  },
  dishImage: { desktop: media('4 / 3', { transition: 'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1)' }) },
  dishBody: { desktop: column('12px', { padding: '24px 26px 28px', 'align-items': 'flex-start' }) },
  dishTop: { desktop: row('16px', { width: '100%', 'justify-content': 'space-between', 'align-items': 'baseline' }) },
  dishName: { desktop: displayType('25px', { 'line-height': '1.15', 'letter-spacing': '-0.015em' }) },
  price: {
    desktop: { 'font-size': '16px', 'font-weight': '700', color: 'var(--accent-ink)', 'white-space': 'nowrap' }
  },
  dishDescription: { desktop: { 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg-muted)' } },
  tagRow: { desktop: row('6px', { 'flex-wrap': 'wrap' }) },
  tag: { desktop: chip() },

  // ── Dark band ───────────────────────────────────────────────────────────────────────────────────────────────
  inkBand: {
    desktop: {
      width: '100%',
      padding: '128px 32px',
      'background-color': 'var(--ink)',
      color: 'var(--on-ink)',
      'background-image': 'radial-gradient(120% 90% at 100% 0%, rgba(194, 65, 12, 0.28) 0%, rgba(22, 17, 14, 0) 55%)'
    },
    tablet: { padding: '96px 28px' },
    mobile: { padding: '72px 20px' }
  },
  inkGrid: {
    desktop: grid('minmax(0, 1.05fr) minmax(0, 1fr)', '80px', { ...wrap('1240px'), 'align-items': 'center' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '48px' }
  },
  inkEyebrow: { desktop: eyebrow({ color: 'var(--brass)' }) },
  inkTitle: {
    desktop: displayType('58px', { color: 'var(--on-ink)' }),
    tablet: { 'font-size': '46px' },
    mobile: { 'font-size': '38px' }
  },
  inkLead: { desktop: lead({ color: 'var(--on-ink-muted)' }) },
  inkPhoto: {
    desktop: media('1 / 1', { 'border-radius': '28px' }),
    tablet: { 'aspect-ratio': '16 / 10' }
  },
  priceRow: {
    desktop: row('40px', {
      'flex-wrap': 'wrap',
      'align-items': 'flex-start',
      'padding-top': '24px',
      'border-top': '1px solid var(--on-ink-line)'
    }),
    mobile: { gap: '24px' }
  },
  priceValue: { desktop: displayType('40px', { color: 'var(--brass)', 'line-height': '1' }) },
  priceLabel: { desktop: eyebrow({ color: 'var(--on-ink-muted)', 'font-size': '11px' }) },

  // ── Quotes ──────────────────────────────────────────────────────────────────────────────────────────────────
  quoteGrid: {
    desktop: grid('repeat(3, minmax(0, 1fr))', '24px'),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  /** A `figure`, so the browser's own 40px side margins have to be taken back. */
  quoteCard: {
    desktop: column('24px', {
      ...card(),
      margin: '0px',
      padding: '34px',
      'align-items': 'flex-start',
      'justify-content': 'space-between'
    })
  },
  stars: { desktop: { color: 'var(--accent)', 'font-size': '14px', 'letter-spacing': '0.18em' } },
  quoteText: {
    desktop: displayType('23px', {
      'line-height': '1.4',
      'letter-spacing': '-0.01em',
      'font-style': 'italic',
      'font-weight': '400'
    })
  },
  quoteName: { desktop: { 'font-size': '14px', 'font-weight': '700', color: 'var(--fg)' } },
  quoteRole: { desktop: { 'font-size': '13px', color: 'var(--fg-faint)' } },

  // ── Visit & info ────────────────────────────────────────────────────────────────────────────────────────────
  visitGrid: {
    desktop: grid('minmax(0, 1fr) minmax(0, 1fr)', '28px', { 'align-items': 'stretch' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  infoCard: {
    desktop: column('26px', { ...card({ 'border-radius': '28px' }), padding: '44px', 'align-items': 'stretch' }),
    mobile: { padding: '28px 22px' }
  },
  infoRow: { desktop: row('16px', { 'align-items': 'flex-start' }) },
  infoIcon: { desktop: iconTile('44px', { 'font-size': '16px' }) },
  infoLabel: { desktop: eyebrow({ color: 'var(--fg-faint)', 'font-size': '11px' }) },
  infoValue: { desktop: { 'font-size': '16px', 'font-weight': '600', color: 'var(--fg)', 'line-height': '1.5' } },
  infoLink: {
    desktop: {
      'font-size': '16px',
      'font-weight': '600',
      color: 'var(--fg)',
      'line-height': '1.5',
      'border-bottom': '1px solid var(--line-strong)'
    }
  },
  /**
   * A photo that takes the height of the card beside it. The picture is laid over its frame rather than sized by
   * it: a portrait photo in flow would impose its own height on the row and leave the card with a hole at the bottom.
   */
  photoFrame: {
    desktop: {
      position: 'relative',
      width: '100%',
      'min-height': '420px',
      overflow: 'hidden',
      'border-radius': '28px',
      'background-color': 'var(--surface-2)'
    },
    tablet: { 'min-height': '0px', 'aspect-ratio': '16 / 10' }
  },
  coverImage: {
    desktop: {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: '100%',
      height: '100%',
      'object-fit': 'cover'
    }
  },
  /** The week's hours, from the `consultar-horario` render action: a status pill above one row per day. */
  hoursBox: { desktop: column('14px', { width: '100%', 'align-items': 'stretch' }) },
  hoursStatus: {
    desktop: row('8px', statusPill({ 'background-color': 'var(--surface-2)', color: 'var(--fg-muted)' }))
  },
  hoursStatusOpen: {
    desktop: row('8px', statusPill({ 'background-color': 'var(--accent-soft)', color: 'var(--accent-ink)' }))
  },
  /**
   * Each day is drawn twice, today and not today, and the one that does not apply stays in the DOM hidden — so the
   * rows draw their own top line and pull it under the previous one, and the list clips the first.
   */
  hoursList: { desktop: column('0px', { 'align-items': 'stretch', 'padding-left': '0px', overflow: 'hidden' }) },
  hoursRow: { desktop: row('16px', hoursLine({ color: 'var(--fg-muted)' })) },
  hoursRowToday: { desktop: row('16px', hoursLine({ color: 'var(--fg)', 'font-weight': '700' })) },
  hoursToday: { desktop: { color: 'var(--accent-ink)', 'font-weight': '700' } },
  hoursTimes: { desktop: { 'text-align': 'right' } },

  // ── Footer ──────────────────────────────────────────────────────────────────────────────────────────────────
  footerBand: {
    desktop: {
      width: '100%',
      padding: '88px 32px 40px',
      'background-color': 'var(--ink)',
      color: 'var(--on-ink)'
    },
    mobile: { padding: '64px 20px 32px' }
  },
  footerInner: { desktop: column('64px', wrap('1320px')), mobile: { gap: '44px' } },
  footerTop: {
    desktop: grid('minmax(0, 1.6fr) repeat(3, minmax(0, 1fr))', '48px'),
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '36px' }
  },
  footerBrand: { desktop: column('18px', { 'align-items': 'flex-start', 'max-width': '360px' }) },
  footerTitle: { desktop: displayType('40px', { color: 'var(--on-ink)' }) },
  footerText: { desktop: { color: 'var(--on-ink-muted)', 'font-size': '15px', 'line-height': '1.7' } },
  footerHeading: { desktop: eyebrow({ color: 'var(--brass)', 'font-size': '11px' }) },
  footerColumn: { desktop: column('14px', { 'align-items': 'flex-start' }) },
  footerLink: {
    desktop: { color: 'var(--on-ink-muted)', 'font-size': '15px', transition: 'color 180ms ease' }
  },
  footerBottom: {
    desktop: row('16px', {
      'justify-content': 'space-between',
      'flex-wrap': 'wrap',
      'padding-top': '28px',
      'border-top': '1px solid var(--on-ink-line)',
      color: 'var(--on-ink-muted)',
      'font-size': '13px'
    })
  },

  // ── Carta ───────────────────────────────────────────────────────────────────────────────────────────────────
  menuSection: {
    desktop: grid('300px minmax(0, 1fr)', '64px', {
      'align-items': 'flex-start',
      'padding-top': '56px',
      'border-top': '1px solid var(--line)'
    }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '24px', 'padding-top': '40px' }
  },
  menuSectionHead: {
    desktop: column('12px', { position: 'sticky', top: '104px', 'align-items': 'flex-start' }),
    tablet: { position: 'static' }
  },
  menuSectionTitle: { desktop: displayType('38px'), mobile: { 'font-size': '32px' } },
  menuSectionNote: { desktop: { 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg-muted)' } },
  /**
   * A list whose rules sit BETWEEN its rows. Every row draws a rule above itself and is pulled up by its width, and
   * the list clips the one that ends up above its own top edge. A sibling selector cannot do it: a row the carta's
   * filters hide is still in the document, so "the row after another" would count it and draw its line anyway.
   */
  menuItems: { desktop: column('0px', { width: '100%', overflow: 'hidden' }) },
  menuItem: {
    desktop: column('8px', {
      padding: '22px 0px',
      'margin-top': '-1px',
      'border-top': '1px solid var(--line)',
      'align-items': 'stretch'
    })
  },
  menuItemTop: { desktop: row('16px', { 'align-items': 'baseline' }) },
  menuItemName: { desktop: displayType('23px', { 'line-height': '1.25', 'letter-spacing': '-0.01em' }) },
  /** The dotted leader between a dish and its price: an old menu's device, and still the fastest way to scan. */
  menuLeader: {
    desktop: {
      'flex-grow': '1',
      'min-width': '24px',
      height: '1px',
      'border-bottom': '1px dotted var(--line-strong)'
    }
  },
  menuItemDescription: {
    desktop: { 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg-muted)', 'max-width': '62ch' }
  },

  // ── Degustación ─────────────────────────────────────────────────────────────────────────────────────────────
  steps: {
    desktop: grid('repeat(2, minmax(0, 1fr))', '0px 56px'),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  step: {
    desktop: grid('64px minmax(0, 1fr)', '20px', { padding: '28px 0px', 'border-top': '1px solid var(--line)' })
  },
  stepNumber: { desktop: displayType('34px', { color: 'var(--accent)', 'line-height': '1', 'font-style': 'italic' }) },
  stepName: { desktop: displayType('24px', { 'line-height': '1.2', 'letter-spacing': '-0.01em' }) },
  stepDescription: { desktop: { 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg-muted)' } },
  priceGrid: {
    desktop: grid('repeat(3, minmax(0, 1fr))', '24px', { 'align-items': 'stretch' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  priceCard: { desktop: column('14px', { ...card(), padding: '34px', 'align-items': 'flex-start' }) },
  priceCardFeatured: {
    desktop: column('14px', {
      ...card({ 'border-color': 'var(--accent)' }),
      padding: '34px',
      'align-items': 'flex-start',
      'box-shadow': '0 40px 80px -50px var(--accent-shadow)'
    })
  },
  priceCardName: { desktop: displayType('26px') },
  priceCardValue: { desktop: displayType('54px', { color: 'var(--accent)', 'line-height': '1' }) },
  priceCardNote: { desktop: { 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg-muted)' } },
  noteList: { desktop: column('14px', { 'align-items': 'flex-start' }) },
  noteItem: {
    desktop: row('12px', {
      'font-size': '15px',
      color: 'var(--fg-muted)',
      'align-items': 'flex-start',
      'line-height': '1.55'
    })
  },
  noteIcon: { desktop: { color: 'var(--accent)', 'padding-top': '3px' } },

  // ── Nosotros ────────────────────────────────────────────────────────────────────────────────────────────────
  pillars: threeUp('24px', { 'align-items': 'stretch' }),
  pillar: { desktop: column('16px', { ...card(), padding: '34px', 'align-items': 'flex-start' }) },
  pillarIcon: { desktop: iconTile('54px', { 'border-radius': '16px', 'font-size': '20px' }) },
  pillarTitle: { desktop: displayType('28px') },
  quoteLarge: {
    desktop: displayType('40px', { 'line-height': '1.25', 'font-style': 'italic', 'font-weight': '400' }),
    mobile: { 'font-size': '30px' }
  },
  producers: {
    desktop: grid('repeat(2, minmax(0, 1fr))', '0px 56px'),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  producer: {
    desktop: row('20px', {
      'justify-content': 'space-between',
      padding: '22px 0px',
      'border-top': '1px solid var(--line)'
    })
  },
  producerName: { desktop: displayType('22px', { 'line-height': '1.2', 'letter-spacing': '-0.01em' }) },
  producerMeta: { desktop: { 'font-size': '14px', color: 'var(--fg-faint)' } },
  distance: { desktop: chip({ 'background-color': 'var(--accent-soft)', color: 'var(--accent-ink)' }) },
  gallery: {
    desktop: grid('minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)', '16px'),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  /** One height for three columns of different widths, so the row reads as a strip rather than a staircase. */
  galleryImage: {
    desktop: media('auto', { height: '460px', 'border-radius': '20px' }),
    mobile: { height: '280px' }
  },

  // ── Eventos ─────────────────────────────────────────────────────────────────────────────────────────────────
  roomGrid: threeUp('24px'),
  roomImage: { desktop: media('16 / 11', { transition: 'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1)' }) },
  capacity: { desktop: row('8px', eyebrow({ 'font-size': '11px' })) },
  eventList: { desktop: column('0px', { width: '100%' }) },
  eventRow: {
    desktop: grid('120px minmax(0, 1fr) auto', '32px', {
      'align-items': 'center',
      padding: '30px 0px',
      'border-top': '1px solid var(--line)'
    }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '14px' }
  },
  eventDate: { desktop: column('2px', { 'align-items': 'flex-start' }) },
  eventDay: { desktop: displayType('52px', { color: 'var(--accent)', 'line-height': '1' }) },
  eventMonth: { desktop: eyebrow({ color: 'var(--fg-faint)', 'font-size': '11px' }) },
  eventBody: { desktop: column('8px', { 'align-items': 'flex-start' }) },
  eventTitle: { desktop: displayType('27px', { 'line-height': '1.2', 'letter-spacing': '-0.012em' }) },
  eventAside: { desktop: column('10px', { 'align-items': 'flex-end' }), mobile: { 'align-items': 'flex-start' } },

  // ── Reservas ────────────────────────────────────────────────────────────────────────────────────────────────
  bookingGrid: {
    desktop: grid('minmax(0, 1.3fr) minmax(0, 1fr)', '32px', { 'align-items': 'flex-start' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  formCard: {
    desktop: column('28px', {
      ...card({ 'border-radius': '28px' }),
      padding: '48px',
      'align-items': 'stretch',
      'box-shadow': '0 50px 100px -70px var(--shadow)'
    }),
    mobile: { padding: '28px 22px' }
  },
  formTitle: { desktop: displayType('40px'), mobile: { 'font-size': '32px' } },
  form: { desktop: column('26px', { 'align-items': 'stretch' }) },
  formGrid: {
    desktop: grid('repeat(2, minmax(0, 1fr))', '20px'),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  field: { desktop: column('8px', { 'align-items': 'stretch' }) },
  fieldLabel: {
    desktop: { 'font-size': '13px', 'font-weight': '700', color: 'var(--fg)', 'letter-spacing': '0.01em' }
  },
  input: {
    desktop: {
      width: '100%',
      padding: '14px 16px',
      'border-radius': '14px',
      border: '1px solid var(--line-strong)',
      'background-color': 'var(--bg)',
      color: 'var(--fg)',
      'font-family': UI,
      'font-size': '15px',
      transition: 'border-color 180ms ease, box-shadow 180ms ease'
    }
  },
  textarea: {
    desktop: {
      width: '100%',
      'min-height': '120px',
      padding: '14px 16px',
      'border-radius': '14px',
      border: '1px solid var(--line-strong)',
      'background-color': 'var(--bg)',
      color: 'var(--fg)',
      'font-family': UI,
      'font-size': '15px',
      'line-height': '1.55',
      transition: 'border-color 180ms ease, box-shadow 180ms ease'
    }
  },
  fieldError: { desktop: { 'font-size': '13px', color: 'var(--accent-ink)', 'font-weight': '600' } },
  formNote: {
    desktop: { 'font-size': '13px', color: 'var(--fg-faint)', 'line-height': '1.6', 'text-align': 'center' }
  },
  confirmCard: {
    desktop: column('20px', {
      ...card({ 'border-radius': '28px', 'border-color': 'var(--accent)' }),
      padding: '56px 48px',
      'align-items': 'flex-start',
      'box-shadow': '0 50px 100px -60px var(--accent-shadow)'
    }),
    mobile: { padding: '36px 24px' }
  },
  confirmIcon: {
    desktop: iconTile('64px', {
      'border-radius': '999px',
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)',
      'font-size': '24px'
    })
  },
  /** What the server said when it refused: next to the button that sent it, in the accent, never as a pop-up. */
  formError: {
    desktop: {
      padding: '14px 18px',
      'border-radius': '14px',
      'background-color': 'var(--accent-soft)',
      color: 'var(--accent-ink)',
      'font-size': '14px',
      'font-weight': '600',
      'line-height': '1.55'
    }
  },
  // ── Reservas: the live availability ─────────────────────────────────────────────────────────────────────────
  stepTitle: { desktop: row('12px') },
  stepBadge: {
    desktop: iconTile('30px', {
      'border-radius': '999px',
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)',
      'font-size': '14px',
      'font-weight': '700'
    })
  },
  stepTitleText: { desktop: displayType('24px', { 'line-height': '1.2' }) },
  stepHint: { desktop: { 'margin-top': '-16px', 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg-muted)' } },
  slotPanel: {
    desktop: column('18px', {
      padding: '22px',
      'border-radius': '20px',
      border: '1px solid var(--line)',
      'background-color': 'var(--bg)',
      'align-items': 'stretch'
    }),
    mobile: { padding: '18px' }
  },
  slotIntro: { desktop: { 'font-size': '15px', 'font-weight': '600', 'line-height': '1.55', color: 'var(--fg)' } },
  slotGroup: { desktop: column('10px', { 'align-items': 'flex-start' }) },
  slotGroupLabel: { desktop: eyebrow({ 'font-size': '11px', color: 'var(--fg-faint)' }) },
  slotGrid: { desktop: row('8px', { 'flex-wrap': 'wrap' }) },
  slotChip: {
    desktop: pill({
      padding: '10px 16px',
      'font-size': '14px',
      'background-color': 'var(--surface)',
      'border-color': 'var(--accent)',
      color: 'var(--accent-ink)'
    })
  },
  /** A time that cannot be booked stays on screen, saying why: a gap where 14:30 was reads as a page that broke. */
  slotChipFull: {
    desktop: pill({
      padding: '10px 16px',
      'font-size': '14px',
      'font-weight': '600',
      'background-color': 'transparent',
      'border-color': 'var(--line)',
      color: 'var(--fg-faint)',
      cursor: 'not-allowed'
    })
  },
  bookingStep: {
    desktop: column('20px', { 'padding-top': '26px', 'border-top': '1px solid var(--line)', 'align-items': 'stretch' })
  },
  pickSummary: {
    desktop: row('14px', { padding: '16px 18px', 'border-radius': '16px', 'background-color': 'var(--accent-soft)' })
  },
  pickIcon: { desktop: { color: 'var(--accent-ink)', 'font-size': '20px' } },
  pickValue: { desktop: { 'font-size': '16px', 'font-weight': '700', color: 'var(--fg)' } },
  bookingReference: {
    desktop: displayType('30px', { color: 'var(--accent)', 'letter-spacing': '0.06em', 'line-height': '1.1' })
  },

  // ── Shared pieces ───────────────────────────────────────────────────────────────────────────────────────────
  /** An empty box that takes the room left in a column, so what follows it sits at the bottom. */
  grow: { desktop: { 'flex-grow': '1' } },
  /** Also the list of the journal's other articles: a `ul`, so its indent is taken back. */
  pairGrid: {
    desktop: grid('repeat(2, minmax(0, 1fr))', '24px', { 'align-items': 'stretch', 'padding-left': '0px' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  processGrid: threeUp('24px', { 'align-items': 'stretch' }),
  processStep: { desktop: column('14px', { ...card(), padding: '32px', 'align-items': 'flex-start' }) },
  callout: {
    desktop: row('16px', {
      padding: '22px 26px',
      'border-radius': '20px',
      'background-color': 'var(--accent-soft)',
      'align-items': 'flex-start'
    })
  },
  calloutIcon: { desktop: { color: 'var(--accent-ink)', 'font-size': '18px', 'padding-top': '2px' } },
  calloutText: { desktop: { 'font-size': '15px', 'line-height': '1.6', color: 'var(--fg)' } },

  // ── Carta filters ───────────────────────────────────────────────────────────────────────────────────────────
  filterBar: {
    desktop: row('10px', {
      'flex-wrap': 'wrap',
      padding: '20px 24px',
      'border-radius': '20px',
      'background-color': 'var(--surface-2)'
    }),
    mobile: { padding: '18px' }
  },
  /** On a phone the label takes a line of its own, so the two pills stay side by side instead of one wrapping alone. */
  filterLabel: {
    desktop: eyebrow({ color: 'var(--fg-faint)', 'font-size': '11px', 'margin-right': '6px' }),
    mobile: { width: '100%', 'margin-right': '0px' }
  },
  filterChip: {
    desktop: pill({
      padding: '9px 16px',
      'font-size': '14px',
      'background-color': 'var(--surface)',
      'border-color': 'var(--line-strong)',
      color: 'var(--fg)'
    })
  },
  filterChipActive: {
    desktop: pill({
      padding: '9px 16px',
      'font-size': '14px',
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)'
    })
  },
  filterNote: {
    desktop: { width: '100%', 'margin-top': '6px', 'font-size': '14px', 'line-height': '1.6', color: 'var(--fg-muted)' }
  },
  emptyNote: {
    desktop: { padding: '22px 0px', 'font-size': '15px', 'font-style': 'italic', color: 'var(--fg-faint)' }
  },

  // ── Season, promos and journal ──────────────────────────────────────────────────────────────────────────────
  seasonGrid: {
    desktop: grid('repeat(4, minmax(0, 1fr))', '20px', { 'align-items': 'stretch' }),
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  seasonCard: { desktop: column('0px', { ...card(), overflow: 'hidden', 'align-items': 'stretch' }) },
  seasonImage: { desktop: media('4 / 5'), tablet: { 'aspect-ratio': '4 / 3' } },
  seasonBody: { desktop: column('10px', { padding: '22px 22px 26px', 'align-items': 'flex-start' }) },
  seasonMonths: { desktop: chip({ 'background-color': 'var(--accent-soft)', color: 'var(--accent-ink)' }) },
  seasonName: { desktop: displayType('24px', { 'line-height': '1.15' }) },
  promoCard: {
    desktop: {
      position: 'relative',
      display: 'flex',
      'align-items': 'flex-end',
      'min-height': '460px',
      overflow: 'hidden',
      'border-radius': '28px',
      'background-color': 'var(--ink)'
    },
    mobile: { 'min-height': '420px' }
  },
  promoScrim: {
    desktop: {
      position: 'absolute',
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
      'background-image':
        'linear-gradient(180deg, rgba(14, 10, 8, 0.12) 0%, rgba(14, 10, 8, 0.58) 42%, rgba(14, 10, 8, 0.92) 100%)'
    }
  },
  promoContent: {
    desktop: column('14px', { position: 'relative', 'z-index': '1', padding: '38px', 'align-items': 'flex-start' }),
    mobile: { padding: '26px' }
  },
  promoTitle: { desktop: displayType('38px', { color: 'var(--on-ink)' }), mobile: { 'font-size': '30px' } },
  /** Also the list the journal's cards are rendered by: a `ul`, so its indent is taken back. */
  journalGrid: threeUp('28px', { 'align-items': 'stretch', 'padding-left': '0px' }),
  /** What a journal provider wraps: a column the width of its section, so the lists inside keep their grid. */
  journalProvider: { desktop: column('0px', { width: '100%', 'align-items': 'stretch' }) },
  articleCard: {
    desktop: column('0px', {
      ...card(),
      overflow: 'hidden',
      'align-items': 'stretch',
      color: 'var(--fg)',
      transition: 'transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 320ms ease'
    })
  },
  articleImage: { desktop: media('16 / 10', { transition: 'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1)' }) },
  articleMeta: {
    desktop: row(
      '8px',
      eyebrow({ 'font-size': '11px', color: 'var(--fg-faint)', 'letter-spacing': '0.1em', 'flex-wrap': 'wrap' })
    )
  },
  articleCategory: { desktop: { color: 'var(--accent-ink)' } },
  articleCardTitle: { desktop: displayType('25px', { 'line-height': '1.2', 'letter-spacing': '-0.015em' }) },
  featureCard: {
    desktop: grid('minmax(0, 1.25fr) minmax(0, 1fr)', '0px', {
      ...card({ 'border-radius': '28px' }),
      width: '100%',
      overflow: 'hidden',
      'align-items': 'stretch',
      color: 'var(--fg)',
      transition: 'box-shadow 320ms ease'
    }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  featureImage: {
    desktop: media('auto', { height: '100%', 'min-height': '440px' }),
    tablet: { height: 'auto', 'min-height': '0px', 'aspect-ratio': '16 / 10' }
  },
  featureBody: {
    desktop: column('20px', { padding: '52px', 'align-items': 'flex-start', 'justify-content': 'center' }),
    mobile: { padding: '28px 22px' }
  },
  featureTitle: {
    desktop: displayType('46px', { 'line-height': '1.08' }),
    tablet: { 'font-size': '38px' },
    mobile: { 'font-size': '30px' }
  },

  // ── Article ─────────────────────────────────────────────────────────────────────────────────────────────────
  articleBody: { desktop: column('26px', { ...wrap('720px'), 'align-items': 'stretch' }) },
  /** The parts and their paragraphs are lists — `ul`s — laid out as the column the article already was. */
  articleParts: { desktop: column('26px', { 'align-items': 'stretch', 'padding-left': '0px' }) },
  articlePart: { desktop: column('26px', { 'align-items': 'stretch' }) },
  articleParagraphs: { desktop: column('26px', { 'align-items': 'stretch', 'padding-left': '0px' }) },
  articleLead: {
    desktop: displayType('26px', { 'font-weight': '400', 'line-height': '1.5', 'letter-spacing': '-0.01em' }),
    mobile: { 'font-size': '21px' }
  },
  articleHeading: {
    desktop: displayType('34px', { 'margin-top': '22px', 'line-height': '1.15' }),
    mobile: { 'font-size': '28px' }
  },
  articleText: {
    desktop: { 'font-size': '18px', 'line-height': '1.8', color: 'var(--fg-muted)' },
    mobile: { 'font-size': '17px' }
  },
  /** A `figure`, so the browser's own 40px side margins have to be taken back. */
  articleFigure: { desktop: column('14px', { margin: '18px 0px', 'align-items': 'stretch' }) },
  articleFigureImage: { desktop: media('16 / 10', { 'border-radius': '20px' }) },
  articleCaption: { desktop: { 'font-size': '14px', color: 'var(--fg-faint)', 'text-align': 'center' } },
  pullQuote: {
    desktop: column('14px', {
      margin: '18px 0px',
      padding: '6px 0px 6px 28px',
      'border-left': '3px solid var(--accent)',
      'align-items': 'flex-start'
    })
  },
  pullQuoteText: {
    desktop: displayType('32px', { 'line-height': '1.3', 'font-style': 'italic', 'font-weight': '400' }),
    mobile: { 'font-size': '25px' }
  },
  articleFooter: {
    desktop: row('16px', {
      'justify-content': 'space-between',
      'flex-wrap': 'wrap',
      'margin-top': '22px',
      'padding-top': '28px',
      'border-top': '1px solid var(--line)'
    })
  },

  // ── Vinos ───────────────────────────────────────────────────────────────────────────────────────────────────
  wineHeadRow: {
    desktop: grid('minmax(0, 1fr) auto', '24px', { 'padding-bottom': '14px' }),
    mobile: { display: 'none' }
  },
  wineColumnLabel: { desktop: eyebrow({ 'font-size': '11px', color: 'var(--fg-faint)', 'text-align': 'right' }) },
  /** A row of `menuItems`, ruled the same way as a dish. */
  wineItem: {
    desktop: grid('minmax(0, 1fr) auto', '24px', {
      padding: '22px 0px',
      'margin-top': '-1px',
      'border-top': '1px solid var(--line)',
      'align-items': 'baseline'
    }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '12px' }
  },
  wineName: { desktop: displayType('23px', { 'line-height': '1.25', 'letter-spacing': '-0.01em' }) },
  wineMeta: { desktop: { 'font-size': '15px', 'line-height': '1.55', color: 'var(--fg-muted)' } },
  wineGrape: {
    desktop: chip({ 'margin-top': '8px', 'text-transform': 'none', 'letter-spacing': '0.01em', 'font-size': '12px' })
  },
  winePrices: {
    desktop: grid('72px 80px', '16px', { 'justify-items': 'end' }),
    mobile: { 'grid-template-columns': '96px 96px', 'justify-items': 'start' }
  },
  winePriceCell: { desktop: column('2px', { 'align-items': 'flex-end' }), mobile: { 'align-items': 'flex-start' } },
  /** Holds the column open on a wide screen; on a phone, where nothing lines up under a heading, it is not drawn. */
  winePriceCellEmpty: { desktop: column('2px', { 'align-items': 'flex-end' }), mobile: { display: 'none' } },
  winePrice: {
    desktop: { 'font-size': '16px', 'font-weight': '700', color: 'var(--accent-ink)', 'white-space': 'nowrap' }
  },
  winePriceLabel: {
    desktop: { display: 'none' },
    mobile: eyebrow({ display: 'block', 'font-size': '10px', color: 'var(--fg-faint)' })
  },

  // ── Nosotros: team and timeline ─────────────────────────────────────────────────────────────────────────────
  teamGrid: {
    desktop: grid('repeat(4, minmax(0, 1fr))', '20px', { 'align-items': 'stretch' }),
    tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  teamCard: { desktop: column('10px', { ...card(), padding: '30px', 'align-items': 'flex-start' }) },
  avatar: {
    desktop: iconTile('64px', {
      'border-radius': '999px',
      'margin-bottom': '10px',
      'font-family': DISPLAY,
      'font-size': '23px',
      'font-weight': '500',
      'letter-spacing': '0.02em'
    })
  },
  teamRole: { desktop: eyebrow({ 'font-size': '11px' }) },
  teamName: { desktop: displayType('25px', { 'line-height': '1.2' }) },
  timeline: { desktop: column('0px', { width: '100%' }) },
  milestone: {
    desktop: grid('160px minmax(0, 1fr)', '32px', {
      padding: '30px 0px',
      'border-top': '1px solid var(--line)',
      'align-items': 'baseline'
    }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '10px', padding: '24px 0px' }
  },
  milestoneYear: {
    desktop: displayType('48px', { color: 'var(--accent)', 'line-height': '1', 'font-style': 'italic' }),
    mobile: { 'font-size': '38px' }
  },

  // ── FAQ ─────────────────────────────────────────────────────────────────────────────────────────────────────
  faqList: {
    desktop: column('0px', { width: '100%', 'max-width': '880px', 'border-bottom': '1px solid var(--line)' })
  },
  faqItem: { desktop: column('0px', { 'border-top': '1px solid var(--line)', 'align-items': 'stretch' }) },
  faqQuestion: { desktop: faqButton(), mobile: { padding: '20px 0px', 'font-size': '19px' } },
  faqQuestionOpen: {
    desktop: faqButton({ color: 'var(--accent-ink)' }),
    mobile: { padding: '20px 0px', 'font-size': '19px' }
  },
  faqAnswer: { desktop: lead({ 'font-size': '16px', 'max-width': '70ch', 'padding-bottom': '26px' }) },

  // ── Newsletter ──────────────────────────────────────────────────────────────────────────────────────────────
  newsletterBand: {
    desktop: {
      width: '100%',
      padding: '104px 32px',
      'background-color': 'var(--surface-2)',
      'border-top': '1px solid var(--line)'
    },
    tablet: { padding: '80px 28px' },
    mobile: { padding: '64px 20px' }
  },
  newsletterInner: {
    desktop: grid('minmax(0, 1fr) minmax(0, 1fr)', '72px', { ...wrap('1240px'), 'align-items': 'center' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)', gap: '32px' }
  },
  newsletterTitle: { desktop: displayType('46px'), tablet: { 'font-size': '38px' }, mobile: { 'font-size': '32px' } },
  newsletterForm: {
    desktop: grid('minmax(0, 1fr) auto', '12px', { width: '100%', 'align-items': 'end' }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  formHint: { desktop: { 'margin-top': '10px', 'font-size': '13px', color: 'var(--fg-faint)' } },
  newsletterDone: { desktop: row('18px', { ...card(), padding: '26px 30px' }) },
  confirmIconSmall: {
    desktop: iconTile('50px', {
      'border-radius': '999px',
      'background-color': 'var(--accent)',
      color: 'var(--on-accent)',
      'font-size': '18px'
    })
  },
  newsletterDoneTitle: { desktop: displayType('25px') }
};

/**
 * Tablet and mobile are DISJOINT ranges (48–64rem and below 48rem), and both inherit only from desktop — so a rule
 * written for tablet never reaches a phone. Every layout here collapses at tablet and stays collapsed below it,
 * which is what copying tablet into mobile (under mobile's own overrides) says.
 */
const cascade = ({ tablet, mobile, ...rest }: ResponsiveCss): ResponsiveCss =>
  tablet ? { ...rest, tablet, mobile: { ...tablet, ...mobile } } : { ...rest, ...(mobile ? { mobile } : {}) };

export const classes: NonNullable<SpaceSpec['classes']> = Object.fromEntries(
  Object.entries(declared).map(([name, spec]) => [name, cascade(spec)])
);

/**
 * What a class cannot say: hover and focus, the arrival of the hero, the parts of elements nobody authored (the
 * theme toggle's icons, the hours plugin), and the respect owed to somebody who asked their machine for less motion.
 */
export const customCss = `
html { scroll-behavior: smooth; }
::selection { background: var(--accent-soft); color: var(--accent-ink); }

@keyframes ceniza-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes ceniza-settle { from { transform: scale(1.12); } to { transform: scale(1.03); } }
.heroImage { animation: ceniza-settle 2400ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.heroContent > * { animation: ceniza-rise 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.heroContent > *:nth-child(2) { animation-delay: 90ms; }
.heroContent > *:nth-child(3) { animation-delay: 180ms; }
.heroContent > *:nth-child(4) { animation-delay: 270ms; }
.heroContent > *:nth-child(5) { animation-delay: 360ms; }

.navLink:hover { color: var(--fg); background-color: var(--surface-2); }
.themeToggle:hover, .menuButton:hover { color: var(--accent-ink); border-color: var(--accent); }
.buttonPrimary:hover, .buttonWide:hover, .headerCta:hover, .mobileCta:hover {
  transform: translateY(-2px); box-shadow: 0 22px 40px -18px var(--accent-shadow);
}
.buttonGhost:hover { border-color: var(--fg); transform: translateY(-2px); }
.buttonOnPhoto:hover { background-color: rgba(246, 238, 228, 0.18); transform: translateY(-2px); }
.buttonOnInk:hover { transform: translateY(-2px); box-shadow: 0 22px 40px -20px rgba(0, 0, 0, 0.6); }
.textLink:hover { border-color: var(--accent); gap: 12px; }
.mobileLink:hover { color: var(--accent-ink); }
.footerLink:hover { color: var(--on-ink); }
.infoLink:hover { border-color: var(--accent); color: var(--accent-ink); }

.dishCard:hover, .articleCard:hover { transform: translateY(-4px); box-shadow: 0 40px 70px -46px var(--shadow); }
.dishCard:hover .dishImage, .dishCard:hover .roomImage, .articleCard:hover .articleImage { transform: scale(1.05); }
.featureCard:hover { box-shadow: 0 40px 80px -50px var(--shadow); }
.featureCard:hover .textLink { border-color: var(--accent); gap: 12px; }
.promoCard .coverImage { transition: transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.promoCard:hover .coverImage { transform: scale(1.04); }
.filterChip:hover { border-color: var(--accent); color: var(--accent-ink); }
/* The tick is decoration: drawn here, it stays out of the button's accessible name, which aria-pressed already says. */
.filterChipActive::before { content: '✓'; }
.slotChip:hover { background-color: var(--accent-soft); }
/* The time chosen is read off aria-pressed, the attribute a screen reader announces, so sight and speech agree. */
.slotChip[aria-pressed='true'] { background-color: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.slotChip[aria-pressed='true']::before { content: '✓'; }

/* Six links, a brand and two actions do not fit a narrow desktop: the tagline goes first, then the padding. */
@media (max-width: 80rem) {
  .brandTag { display: none; }
  .navLink, .navLinkActive { padding-left: 10px; padding-right: 10px; }
}

/* The sign beside a question. It turns rather than swaps, so opening one reads as the same control moving. */
.faqQuestion::after, .faqQuestionOpen::after {
  content: '+'; flex-shrink: 0; font-family: ${UI}; font-size: 28px; font-weight: 400; line-height: 1;
  color: var(--accent-ink); transition: transform 220ms ease;
}
.faqQuestionOpen::after { transform: rotate(45deg); }
.faqQuestion:hover { color: var(--accent-ink); }

.input:focus, .textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 3px;
}

/* The toggle ships both icons and no opinion: the scheme picks one, and a class on the root overrides the machine. */
.plitzi-component__theme-toggle [data-theme-icon] { display: none; align-items: center; }
.plitzi-component__theme-toggle [data-theme-icon='light'] { display: inline-flex; }
@media (prefers-color-scheme: dark) {
  :root:not(.light) .plitzi-component__theme-toggle [data-theme-icon='light'] { display: none; }
  :root:not(.light) .plitzi-component__theme-toggle [data-theme-icon='dark'] { display: inline-flex; }
}
:root.dark .plitzi-component__theme-toggle [data-theme-icon='light'] { display: none; }
:root.dark .plitzi-component__theme-toggle [data-theme-icon='dark'] { display: inline-flex; }
:root.light .plitzi-component__theme-toggle [data-theme-icon='light'] { display: inline-flex; }
:root.light .plitzi-component__theme-toggle [data-theme-icon='dark'] { display: none; }

/* The dot beside "Abierto ahora": a pseudo-element, which no class can declare. */
.hoursStatus::before, .hoursStatusOpen::before {
  content: ''; width: 8px; height: 8px; border-radius: 999px; background: currentColor; opacity: 0.6;
}
.hoursStatusOpen::before { opacity: 1; box-shadow: 0 0 0 4px var(--accent-soft); }

/* A form control marks its error slot even when empty; an empty slot should take no room. */
.fieldError:empty { display: none; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .dishCard:hover, .articleCard:hover, .buttonPrimary:hover, .buttonWide:hover, .buttonGhost:hover, .buttonOnPhoto:hover {
    transform: none;
  }
}
`;
