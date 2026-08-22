import type { SpaceSpec, StyleRules } from '@plitzi/sdk-schema';

/**
 * The stylesheet, as data.
 *
 * Longhands, and no `padding` or `gap` shorthand anywhere: the builder's style vocabulary is a closed list of
 * properties and holds no shorthands, so a space authored with them renders and then cannot be read back by the
 * style editor. The shorthand stops here, at authoring time, and what reaches the document is what the editor
 * understands. These helpers are what make that bearable to write.
 */

export const gap = (value: string): StyleRules => ({ 'row-gap': value, 'column-gap': value });

export const padding = (value: string, horizontal = value): StyleRules => ({
  'padding-top': value,
  'padding-bottom': value,
  'padding-left': horizontal,
  'padding-right': horizontal
});

export const radius = (value: string): StyleRules => ({
  'border-top-left-radius': value,
  'border-top-right-radius': value,
  'border-bottom-right-radius': value,
  'border-bottom-left-radius': value
});

export const border = (width: string, color: string, style = 'solid'): StyleRules => ({
  'border-top-width': width,
  'border-right-width': width,
  'border-bottom-width': width,
  'border-left-width': width,
  'border-top-style': style,
  'border-right-style': style,
  'border-bottom-style': style,
  'border-left-style': style,
  'border-top-color': color,
  'border-right-color': color,
  'border-bottom-color': color,
  'border-left-color': color
});

export const borderSide = (side: 'top' | 'right' | 'bottom' | 'left', width: string, color: string): StyleRules => ({
  [`border-${side}-width`]: width,
  [`border-${side}-style`]: 'solid',
  [`border-${side}-color`]: color
});

export const column = (value: string, extra: StyleRules = {}): StyleRules => ({
  display: 'flex',
  'flex-direction': 'column',
  ...gap(value),
  ...extra
});

export const row = (value: string, extra: StyleRules = {}): StyleRules => ({
  display: 'flex',
  'flex-direction': 'row',
  'align-items': 'center',
  ...gap(value),
  ...extra
});

export const grid = (columns: string, value: string, extra: StyleRules = {}): StyleRules => ({
  display: 'grid',
  'grid-template-columns': columns,
  ...gap(value),
  ...extra
});

/**
 * A picture that fills its column at a fixed shape.
 *
 * `height: auto` is not decoration: the image element carries a `140px` square of its own so that an unbound one
 * is visible in the builder, and a class that sets only `width` and `aspect-ratio` loses to it — the ratio is
 * ignored and every cover comes out a letterbox. Saying `auto` is what hands the height back to the ratio.
 */
export const media = (ratio: string): StyleRules => ({
  display: 'block',
  width: '100%',
  height: 'auto',
  'aspect-ratio': ratio,
  'object-fit': 'cover'
});

/** Cuts a paragraph off at a line count instead of at a character, which is what keeps a grid of cards even. */
export const clamp = (lines: number): StyleRules => ({
  display: '-webkit-box',
  '-webkit-line-clamp': String(lines),
  '-webkit-box-orient': 'vertical',
  overflow: 'hidden'
});

/**
 * Two families and nothing else.
 *
 * A display serif for anything that is read at a glance and a text sans for everything that is read as interface,
 * both from what the machine already has: a demonstration that waits on a font server is a demonstration with a
 * blank first second in it. `ui-serif` resolves to New York on Apple platforms and to a decent Georgia elsewhere.
 */
const DISPLAY = "ui-serif, 'New York', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const UI = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI Variable Text', 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

const wrap = (maxWidth = '1180px'): StyleRules => ({
  width: '100%',
  'max-width': maxWidth,
  'margin-left': 'auto',
  'margin-right': 'auto'
});

/** Display type: tight, dark, and set at a size that reads as a headline rather than as large body text. */
const displayText = (size: string, extra: StyleRules = {}): StyleRules => ({
  'font-family': DISPLAY,
  'font-size': size,
  'font-weight': '600',
  'line-height': '1.08',
  'letter-spacing': '-0.022em',
  'margin-top': '0px',
  'margin-bottom': '0px',
  color: 'var(--fg)',
  'text-wrap': 'balance',
  ...extra
});

const eyebrow = (extra: StyleRules = {}): StyleRules => ({
  'font-size': '11px',
  'font-weight': '650',
  'letter-spacing': '0.14em',
  'text-transform': 'uppercase',
  color: 'var(--fg-faint)',
  ...extra
});

/**
 * Every class the blog uses, written once.
 *
 * Two elements naming one class share one rule, which is the difference between a stylesheet and a pile of
 * one-off declarations — and it is what makes the space re-themable: the colours are all variables, so the whole
 * site follows one edit, in either scheme.
 */
export const classes: NonNullable<SpaceSpec['classes']> = {
  page: {
    desktop: column('0px', {
      'min-height': '100vh',
      'background-color': 'var(--bg)',
      color: 'var(--fg)',
      'font-family': UI
    })
  },
  pageInner: { desktop: column('0px', { width: '100%', 'flex-grow': '1' }) },

  // ── Header ──────────────────────────────────────────────────────────────────────────────────────────────────
  headerBand: {
    desktop: {
      width: '100%',
      position: 'sticky',
      top: '0px',
      'z-index': '30',
      'background-color': 'var(--bg-glass)',
      'backdrop-filter': 'saturate(180%) blur(14px)',
      ...borderSide('bottom', '1px', 'var(--line)')
    }
  },
  headerInner: {
    desktop: row('20px', { ...wrap(), ...padding('14px', '28px'), 'justify-content': 'space-between' }),
    mobile: { ...padding('12px', '18px'), ...gap('10px') }
  },
  brand: { desktop: row('11px', { 'text-decoration': 'none', color: 'var(--fg)' }) },
  brandMark: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '32px',
      height: '32px',
      ...radius('11px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: '#ffffff',
      'font-family': DISPLAY,
      'font-size': '17px',
      'font-weight': '600',
      'box-shadow': '0 6px 16px -8px var(--accent-shadow)'
    }
  },
  brandName: {
    desktop: displayText('19px', { 'letter-spacing': '-0.01em', 'white-space': 'nowrap', 'line-height': '1.15' })
  },
  brandTag: { desktop: eyebrow({ 'font-size': '9px' }), mobile: { display: 'none' } },
  nav: { desktop: row('6px') },
  navLink: {
    desktop: {
      ...padding('7px', '12px'),
      ...radius('9px'),
      color: 'var(--fg-muted)',
      'text-decoration': 'none',
      'font-size': '14px',
      'font-weight': '500',
      transition: 'color 160ms ease, background-color 160ms ease'
    }
  },
  /**
   * The text inside a pill, button or link, and nothing else.
   *
   * It states no type of its own on purpose: the box it sits in already carries the size, the weight and the
   * colour, so the label inherits all three. Giving the text the box's class instead is what draws the border
   * twice — once around the pill, once around the words inside it.
   */
  inlineLabel: {
    desktop: {
      color: 'inherit',
      'font-size': 'inherit',
      'font-weight': 'inherit',
      'letter-spacing': 'inherit',
      'white-space': 'nowrap'
    }
  },
  signInLink: {
    desktop: row('0px', {
      ...padding('8px', '17px'),
      ...radius('999px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: '#ffffff',
      'font-size': '13px',
      'font-weight': '600',
      'text-decoration': 'none',
      'box-shadow': '0 10px 22px -14px var(--accent-shadow)',
      transition: 'transform 200ms ease, box-shadow 200ms ease'
    })
  },
  accountPill: {
    desktop: row('8px', {
      ...padding('5px', '6px'),
      'padding-right': '13px',
      ...radius('999px'),
      ...border('1px', 'var(--line)'),
      'background-color': 'var(--surface)',
      'text-decoration': 'none',
      color: 'var(--fg)',
      'font-size': '13px',
      'font-weight': '600',
      'white-space': 'nowrap',
      transition: 'border-color 160ms ease, box-shadow 160ms ease'
    })
  },
  themeToggle: {
    desktop: {
      display: 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '34px',
      height: '34px',
      ...radius('999px'),
      ...border('1px', 'var(--line)'),
      'background-color': 'var(--surface)',
      color: 'var(--fg-muted)',
      cursor: 'pointer',
      'font-size': '15px',
      transition: 'color 160ms ease, border-color 160ms ease'
    }
  },
  avatarSm: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '26px',
      height: '26px',
      ...radius('999px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: '#ffffff',
      'font-size': '11px',
      'font-weight': '700'
    }
  },
  avatar: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '44px',
      height: '44px',
      'min-width': '44px',
      ...radius('999px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: '#ffffff',
      'font-family': DISPLAY,
      'font-size': '19px',
      'font-weight': '600'
    }
  },

  // ── Shared furniture ────────────────────────────────────────────────────────────────────────────────────────
  pageStack: { desktop: column('72px'), mobile: { ...gap('44px') } },
  main: { desktop: column('72px', { ...wrap(), ...padding('64px', '28px') }), mobile: { ...padding('34px', '18px') } },
  sectionLabel: {
    desktop: eyebrow({ 'padding-bottom': '16px', ...borderSide('bottom', '1px', 'var(--line)'), width: '100%' })
  },
  chip: {
    desktop: {
      display: 'inline-flex',
      'align-self': 'flex-start',
      ...padding('4px', '10px'),
      ...radius('7px'),
      'background-color': 'var(--accent-soft)',
      color: 'var(--accent-ink)',
      'font-size': '10px',
      'font-weight': '700',
      'letter-spacing': '0.1em',
      'text-transform': 'uppercase',
      'text-decoration': 'none'
    }
  },
  meta: { desktop: { color: 'var(--fg-faint)', 'font-size': '13px', 'letter-spacing': '0.01em' } },
  metaRow: { desktop: row('11px') },
  bylineName: { desktop: { color: 'var(--fg)', 'font-size': '14px', 'font-weight': '600' } },
  /**
   * A column of text runs.
   *
   * The SDK's `text` element is `display: inline` — it is a run of text, not a block — so two of them in a plain
   * container sit on one line. A flex column blockifies them, which is what a name over a date needs.
   */
  stack: { desktop: column('2px', { 'align-items': 'flex-start' }) },

  // ── Hero ────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * The lead story, as one photograph with the headline inside it.
   *
   * The whole card is the link, the image fills it, and everything readable sits in a layer on top — which only
   * works because of the layer BETWEEN them: `heroScrim` is a gradient from transparent to `--scrim`, and it is
   * what keeps a white headline legible over a photograph nobody has seen yet. Without it the design is a bet on
   * every future cover being dark in the bottom third.
   */
  hero: {
    desktop: {
      position: 'relative',
      display: 'block',
      width: '100%',
      overflow: 'hidden',
      'text-decoration': 'none',
      ...radius('28px'),
      'background-color': 'var(--surface-2)',
      'box-shadow': '0 50px 90px -50px var(--shadow), 0 0 0 1px var(--line-soft)'
    },
    mobile: { ...radius('20px') }
  },
  heroImage: {
    desktop: {
      ...media('16 / 9'),
      transition: 'transform 900ms cubic-bezier(0.2, 0.7, 0.2, 1)'
    },
    tablet: { 'aspect-ratio': '4 / 3' },
    mobile: { 'aspect-ratio': '4 / 5' }
  },
  heroScrim: {
    desktop: column('18px', {
      position: 'absolute',
      left: '0px',
      right: '0px',
      bottom: '0px',
      'align-items': 'flex-start',
      ...padding('46px', '52px'),
      'background-image': 'linear-gradient(to top, var(--scrim) 12%, rgba(8, 6, 12, 0.35) 52%, transparent 100%)'
    }),
    tablet: { ...padding('34px', '32px'), ...gap('14px') },
    mobile: { ...padding('24px', '22px'), ...gap('12px') }
  },
  heroTitle: {
    desktop: displayText('60px', {
      color: 'var(--on-photo)',
      'max-width': '18ch',
      'text-shadow': '0 2px 30px rgba(0,0,0,0.35)'
    }),
    tablet: { 'font-size': '44px' },
    mobile: { 'font-size': '31px', 'max-width': '100%' }
  },
  heroStandfirst: {
    desktop: {
      color: 'var(--on-photo-muted)',
      'font-size': '19px',
      'line-height': '1.5',
      'max-width': '52ch',
      'letter-spacing': '-0.005em'
    },
    mobile: { 'font-size': '16px' }
  },
  /** The chip and the byline over a photograph: the same shapes, in the colours the scrim can carry. */
  chipOnPhoto: {
    desktop: {
      display: 'inline-flex',
      'align-self': 'flex-start',
      ...padding('5px', '11px'),
      ...radius('7px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: 'var(--on-photo)',
      'font-size': '10px',
      'font-weight': '700',
      'letter-spacing': '0.1em',
      'text-transform': 'uppercase',
      'text-decoration': 'none'
    }
  },
  metaOnPhoto: { desktop: { color: 'var(--on-photo-muted)', 'font-size': '13px', 'letter-spacing': '0.01em' } },
  readLink: {
    desktop: row('9px', {
      ...padding('12px', '22px'),
      ...radius('999px'),
      'background-color': 'var(--on-photo)',
      color: '#14131a',
      'font-size': '14px',
      'font-weight': '600',
      'text-decoration': 'none',
      transition: 'transform 200ms ease, box-shadow 200ms ease'
    })
  },

  // ── The list ────────────────────────────────────────────────────────────────────────────────────────────────
  layout: {
    desktop: grid('minmax(0, 1fr) 288px', '64px', { 'align-items': 'flex-start' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('48px') },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('40px') }
  },
  feed: { desktop: column('34px', { 'padding-left': '0px' }) },
  card: {
    desktop: grid('232px minmax(0, 1fr)', '26px', {
      'align-items': 'flex-start',
      'padding-bottom': '34px',
      ...borderSide('bottom', '1px', 'var(--line)')
    }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('16px') }
  },
  cardImage: {
    desktop: { ...media('4 / 3'), ...radius('14px'), transition: 'transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1)' }
  },
  cardBody: { desktop: column('11px', { 'align-items': 'flex-start' }) },
  cardLink: { desktop: { 'text-decoration': 'none', color: 'var(--fg)', display: 'block' } },
  cardTitle: {
    desktop: displayText('27px', { 'line-height': '1.18', transition: 'color 160ms ease' }),
    mobile: { 'font-size': '23px' }
  },
  cardExcerpt: {
    desktop: { color: 'var(--fg-muted)', 'font-size': '15px', 'line-height': '1.62', ...clamp(3) }
  },
  pager: { desktop: row('6px', { 'padding-top': '6px', color: 'var(--fg-muted)' }) },

  // ── Sidebar ─────────────────────────────────────────────────────────────────────────────────────────────────
  sidebar: { desktop: column('34px', { position: 'sticky', top: '96px' }), tablet: { position: 'static' } },
  panel: { desktop: column('14px', { 'align-items': 'flex-start' }) },
  panelTitle: {
    desktop: eyebrow({ 'padding-bottom': '12px', ...borderSide('bottom', '1px', 'var(--line)'), width: '100%' })
  },
  panelText: { desktop: { color: 'var(--fg-muted)', 'font-size': '14px', 'line-height': '1.65' } },
  /**
   * A row of chips, and the reset is not optional.
   *
   * A `list` in `controlled` mode renders a plain `div` — no bullets, no markers — and still inherits the `ul`
   * subtype's own default style, because a component with subtypes and no subtype named falls back to the FIRST
   * one. So every controlled list starts life indented forty pixels and carrying a bottom margin, which in a
   * 288-pixel sidebar is a seventh of the width thrown away. `quietList` below says the same thing.
   */
  chipRow: {
    desktop: {
      display: 'flex',
      'flex-wrap': 'wrap',
      ...gap('8px'),
      'padding-left': '0px',
      'margin-top': '0px',
      'margin-bottom': '0px'
    }
  },
  /** The chosen topic. A different shape rather than a tint: it should read as a state, not as a hover. */
  chipActive: {
    desktop: {
      display: 'inline-flex',
      'align-self': 'flex-start',
      ...padding('6px', '12px'),
      ...radius('999px'),
      ...border('1px', 'transparent'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: 'var(--on-photo)',
      'font-size': '12px',
      'font-weight': '700',
      'text-decoration': 'none',
      'box-shadow': '0 8px 18px -12px var(--accent-shadow)'
    }
  },
  chipQuiet: {
    desktop: {
      display: 'inline-flex',
      'align-self': 'flex-start',
      ...padding('6px', '12px'),
      ...radius('999px'),
      ...border('1px', 'var(--line)'),
      'background-color': 'var(--surface)',
      color: 'var(--fg-muted)',
      'font-size': '12px',
      'font-weight': '600',
      'text-decoration': 'none',
      transition: 'color 160ms ease, border-color 160ms ease'
    }
  },
  quietList: { desktop: column('16px', { 'padding-left': '0px', 'margin-top': '0px', 'margin-bottom': '0px' }) },
  quietItem: { desktop: column('3px', { 'text-decoration': 'none' }) },
  quietTitle: {
    desktop: { color: 'var(--fg)', 'font-size': '14px', 'font-weight': '600', 'line-height': '1.4', ...clamp(2) }
  },

  // ── Article ─────────────────────────────────────────────────────────────────────────────────────────────────
  article: { desktop: column('28px', { ...wrap('720px'), 'align-items': 'flex-start' }) },
  articleWide: { desktop: column('28px', { ...wrap('980px'), 'align-items': 'flex-start' }) },
  articleTitle: { desktop: displayText('52px'), tablet: { 'font-size': '42px' }, mobile: { 'font-size': '33px' } },
  articleStandfirst: {
    desktop: { color: 'var(--fg-muted)', 'font-size': '21px', 'line-height': '1.55', 'letter-spacing': '-0.005em' },
    mobile: { 'font-size': '18px' }
  },
  articleImage: { desktop: { ...media('2 / 1'), ...radius('20px') } },
  /**
   * The box around the space's own element.
   *
   * Written here and not in the plugin on purpose: the border, the padding and the radius are decisions of the
   * PAGE, the same way they are for a heading. The plugin draws what only it can draw and stays out of the rest.
   */
  speciesPanel: {
    desktop: column('14px', {
      width: '100%',
      ...padding('22px'),
      ...radius('20px'),
      ...border('1px', 'var(--line)'),
      'background-color': 'var(--surface)',
      'box-shadow': '0 24px 50px -44px var(--shadow)'
    })
  },
  bylineRow: {
    desktop: row('16px', { width: '100%', 'justify-content': 'space-between', 'flex-wrap': 'wrap' })
  },
  metaEdited: { desktop: { color: 'var(--accent-ink)', 'font-size': '12px', 'font-weight': '600' } },
  prose: { desktop: { color: 'var(--fg)', 'font-size': '19px', 'line-height': '1.72', width: '100%' } },
  /** The public write, given a box of its own so it reads as an invitation rather than as part of the article. */
  sightingBox: {
    desktop: row('16px', {
      width: '100%',
      'flex-wrap': 'wrap',
      ...padding('18px', '22px'),
      ...radius('18px'),
      ...border('1px', 'var(--line)'),
      'background-color': 'var(--surface-2)',
      'justify-content': 'space-between'
    })
  },
  authorBox: {
    desktop: row('16px', {
      width: '100%',
      'align-items': 'flex-start',
      'padding-top': '26px',
      ...borderSide('top', '1px', 'var(--line)')
    })
  },
  moreGrid: {
    desktop: grid('repeat(3, minmax(0, 1fr))', '26px', { 'align-items': 'flex-start' }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  moreCard: { desktop: column('11px', { 'text-decoration': 'none', 'align-items': 'flex-start' }) },
  moreImage: {
    desktop: { ...media('16 / 10'), ...radius('16px'), transition: 'transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1)' }
  },
  moreTitle: { desktop: displayText('19px', { 'line-height': '1.28', ...clamp(2) }) },

  // ── Forms ───────────────────────────────────────────────────────────────────────────────────────────────────
  editor: {
    desktop: grid('minmax(0, 1fr) 264px', '56px', { 'align-items': 'flex-start' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('40px') },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('32px') }
  },
  form: { desktop: column('20px', { width: '100%' }) },
  fieldRow: { desktop: column('7px') },
  fieldLabel: { desktop: { color: 'var(--fg)', 'font-size': '13px', 'font-weight': '600', cursor: 'pointer' } },
  input: {
    desktop: {
      width: '100%',
      ...padding('12px', '15px'),
      ...border('1px', 'var(--line-strong)'),
      ...radius('13px'),
      'background-color': 'var(--surface)',
      color: 'var(--fg)',
      'font-size': '15px',
      'font-family': 'inherit',
      'line-height': '1.6',
      'outline-style': 'none',
      transition: 'border-color 160ms ease, box-shadow 160ms ease'
    }
  },
  textarea: {
    desktop: {
      width: '100%',
      'min-height': '300px',
      ...padding('15px', '17px'),
      ...border('1px', 'var(--line-strong)'),
      ...radius('13px'),
      'background-color': 'var(--surface)',
      color: 'var(--fg)',
      'font-family': MONO,
      'font-size': '14px',
      'line-height': '1.7',
      'outline-style': 'none',
      transition: 'border-color 160ms ease, box-shadow 160ms ease'
    }
  },
  formTitle: { desktop: displayText('30px', { 'line-height': '1.15' }) },
  actionRow: { desktop: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', ...gap('10px') } },
  button: {
    desktop: {
      ...padding('12px', '24px'),
      ...border('0px', 'transparent'),
      ...radius('999px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: '#ffffff',
      'font-size': '15px',
      'font-weight': '600',
      'font-family': 'inherit',
      cursor: 'pointer',
      'align-self': 'flex-start',
      'box-shadow': '0 14px 30px -16px var(--accent-shadow)',
      transition: 'transform 200ms ease, box-shadow 200ms ease'
    }
  },
  buttonWide: {
    desktop: {
      width: '100%',
      ...padding('12px', '24px'),
      ...border('0px', 'transparent'),
      ...radius('999px'),
      'background-image': 'linear-gradient(140deg, var(--accent), var(--accent-2))',
      color: '#ffffff',
      'font-size': '15px',
      'font-weight': '600',
      'font-family': 'inherit',
      cursor: 'pointer',
      'box-shadow': '0 14px 30px -16px var(--accent-shadow)',
      transition: 'transform 200ms ease, box-shadow 200ms ease'
    }
  },
  buttonQuiet: {
    desktop: {
      ...padding('10px', '20px'),
      ...border('1px', 'var(--line-strong)'),
      ...radius('999px'),
      'background-color': 'var(--surface)',
      color: 'var(--fg)',
      'font-size': '14px',
      'font-weight': '600',
      'font-family': 'inherit',
      cursor: 'pointer',
      'align-self': 'flex-start',
      transition: 'border-color 160ms ease, color 160ms ease'
    }
  },
  notice: { desktop: { color: 'var(--accent-ink)', 'font-size': '14px', 'font-weight': '600', 'min-height': '20px' } },
  centred: { desktop: column('26px', { ...wrap('430px'), 'align-items': 'stretch' }) },
  cardSurface: {
    desktop: column('18px', {
      ...padding('26px'),
      ...radius('20px'),
      ...border('1px', 'var(--line)'),
      'background-color': 'var(--surface)',
      'box-shadow': '0 30px 60px -46px var(--shadow)',
      'align-items': 'flex-start'
    })
  },

  // ── Footer ──────────────────────────────────────────────────────────────────────────────────────────────────
  footerBand: {
    desktop: { width: '100%', 'margin-top': 'auto', ...borderSide('top', '1px', 'var(--line)') }
  },
  footerInner: {
    desktop: row('28px', {
      ...wrap(),
      ...padding('38px', '28px'),
      'padding-bottom': '56px',
      'justify-content': 'space-between',
      'align-items': 'flex-start'
    }),
    mobile: { 'flex-direction': 'column', ...gap('20px') }
  },
  footerEnd: {
    desktop: column('8px', { 'align-items': 'flex-end', 'max-width': '380px', 'text-align': 'right' }),
    mobile: { 'align-items': 'flex-start', 'text-align': 'left' }
  },
  /** The same eyebrow the sections use, without the rule under it: nothing follows this one. */
  footerLabel: { desktop: eyebrow() }
};

/**
 * The palette, stated for both schemes.
 *
 * Every colour in the space is one of these, so the whole site follows one edit — and the second value is not an
 * afterthought: dark is a design, not an inversion, which is why the surfaces lift rather than the text dimming.
 *
 * A warm orange-to-magenta accent on cream, because the photographs are the colour here and an accent has to hold
 * its own against green hummingbirds, teal water and a purple octopus without fighting any of them. The pair
 * beyond the palette proper — `scrim` and `on-photo` — is for the one place text sits ON an image, where the
 * background is whatever the photographer happened to shoot.
 */
export const variables: SpaceSpec['variables'] = {
  color: {
    fg: { light: '#14131a', dark: '#f7f5f2', default: '#14131a' },
    'fg-muted': { light: '#5b5768', dark: '#a9a4b6', default: '#5b5768' },
    'fg-faint': { light: '#867f93', dark: '#847f91', default: '#867f93' },
    bg: { light: '#fffcf7', dark: '#0b0a0f', default: '#fffcf7' },
    'bg-glass': {
      light: 'rgba(255, 252, 247, 0.78)',
      dark: 'rgba(11, 10, 15, 0.76)',
      default: 'rgba(255, 252, 247, 0.78)'
    },
    surface: { light: '#ffffff', dark: '#16141c', default: '#ffffff' },
    'surface-2': { light: '#f7f1e8', dark: '#201d29', default: '#f7f1e8' },
    line: { light: '#ece4d8', dark: '#2a2635', default: '#ece4d8' },
    'line-soft': {
      light: 'rgba(20, 19, 26, 0.06)',
      dark: 'rgba(255, 255, 255, 0.07)',
      default: 'rgba(20, 19, 26, 0.06)'
    },
    'line-strong': { light: '#ded3c3', dark: '#37324a', default: '#ded3c3' },
    accent: { light: '#f4511e', dark: '#ff7a4d', default: '#f4511e' },
    'accent-2': { light: '#e0158a', dark: '#ff5fb0', default: '#e0158a' },
    /** The accent as TEXT. The paint version is too bright to read at 13px on cream, and too dark on near-black. */
    'accent-ink': { light: '#cc3d10', dark: '#ffa183', default: '#cc3d10' },
    'accent-soft': { light: '#ffeee5', dark: '#33161f', default: '#ffeee5' },
    'accent-shadow': {
      light: 'rgba(244, 81, 30, 0.5)',
      dark: 'rgba(255, 122, 77, 0.42)',
      default: 'rgba(244, 81, 30, 0.5)'
    },
    shadow: { light: 'rgba(40, 20, 10, 0.5)', dark: 'rgba(0, 0, 0, 0.85)', default: 'rgba(40, 20, 10, 0.5)' },
    /** What a headline needs to stay readable on a photograph nobody has seen yet. */
    scrim: { light: 'rgba(8, 6, 12, 0.62)', dark: 'rgba(4, 3, 8, 0.68)', default: 'rgba(8, 6, 12, 0.62)' },
    'on-photo': { light: '#ffffff', dark: '#ffffff', default: '#ffffff' },
    'on-photo-muted': {
      light: 'rgba(255, 255, 255, 0.82)',
      dark: 'rgba(255, 255, 255, 0.8)',
      default: 'rgba(255, 255, 255, 0.82)'
    }
  }
};

/** Type defaults, so an element carries the blog's look before any class touches it. */
export const elements: SpaceSpec['elements'] = {
  heading: { base: { color: 'var(--fg)', 'margin-top': '0px', 'margin-bottom': '0px' } },
  paragraph: { base: { color: 'var(--fg)', 'margin-top': '0px', 'margin-bottom': '0px' } },
  text: { base: { color: 'var(--fg)' } },
  image: { base: { display: 'block' } }
};

/**
 * What a class cannot say.
 *
 * Three kinds of rule live here and nothing else does: **hover and focus**, which the style vocabulary has no
 * place for; the **markdown a post is written in**, which arrives as tags nobody authored and so cannot be
 * reached with a class; and the **theme toggle's two icons**, where the rule is not a colour but which of them
 * the current scheme shows — answered exactly the way the palette answers it, so a chosen theme wins over the
 * machine's.
 */
export const customCss = `
.prose > * { max-width: 100%; }
.prose > p:first-of-type { font-size: 1.06em; color: var(--fg); }
.prose h2 { font-family: ${DISPLAY}; font-size: 30px; line-height: 1.2; letter-spacing: -0.02em; margin: 48px 0 16px; }
.prose h3 { font-family: ${DISPLAY}; font-size: 23px; letter-spacing: -0.015em; margin: 36px 0 12px; }
.prose p { margin: 0 0 22px; }
.prose ul, .prose ol { margin: 0 0 22px; padding-left: 22px; }
.prose li { margin-bottom: 10px; }
.prose li::marker { color: var(--fg-faint); }
.prose a { color: var(--accent-ink); text-underline-offset: 3px; }
.prose strong { font-weight: 650; }
.prose blockquote {
  margin: 34px 0; padding: 2px 0 2px 26px; border-left: 2px solid var(--accent);
  font-family: ${DISPLAY}; font-size: 23px; line-height: 1.45; letter-spacing: -0.015em; color: var(--fg);
}
.prose code { font-family: ${MONO}; font-size: 0.84em; background: var(--accent-soft); color: var(--accent-ink);
  padding: 2px 6px; border-radius: 6px; }
.prose pre { background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px;
  padding: 18px 20px; overflow-x: auto; margin: 0 0 24px; }
.prose pre code { background: none; color: var(--fg); padding: 0; font-size: 13.5px; line-height: 1.65; }

/* ── The space's own element ─────────────────────────────────────────────────────────────────────────────────
   speciesStatus renders markup nobody authored, so its parts are out of reach of a class the way a post's
   markdown is. Everything here is written in the palette's variables, which is what makes a plugin that ships no
   colours of its own look like it was designed with the site — in both schemes, for free. */
.species__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.species__name { font-family: ${DISPLAY}; font-size: 21px; letter-spacing: -0.015em; color: var(--fg); }
.species__latin { font-size: 13px; font-style: italic; color: var(--fg-faint); }
.species__trend {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  background: var(--accent-soft); color: var(--accent-ink); font-size: 12px; font-weight: 700; white-space: nowrap;
}
.species__scale { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.species__step {
  padding: 7px 0; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2);
  color: var(--fg-faint); font: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
  cursor: pointer; transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
}
.species__step:hover { color: var(--fg); border-color: var(--line-strong); }
/* Where this species actually sits. The steps before it are tinted, so the scale reads as a level rather than
   as five buttons with one of them coloured in. */
.species__step[data-state='below'] { background: var(--accent-soft); color: var(--accent-ink); border-color: transparent; }
.species__step[data-state='current'] {
  background: linear-gradient(140deg, var(--accent), var(--accent-2)); color: #ffffff; border-color: transparent;
  box-shadow: 0 8px 18px -10px var(--accent-shadow);
}
.species__step[data-asked='true'] { outline: 2px solid var(--accent); outline-offset: 2px; }
.species__legend {
  font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-faint);
}
.species__chart .species__legend { padding-bottom: 6px; }
.species__meaning { margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--fg-muted); }
.species__aside { color: var(--fg-faint); }
.species__meaning strong { color: var(--fg); font-weight: 650; }
.species__chart { color: var(--accent); }
.species__chart svg { display: block; width: 100%; height: 46px; }
.species__axis {
  display: flex; justify-content: space-between; padding-top: 6px;
  font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-faint);
}
.species__note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--fg-faint); }

/* The slug the editor carries is a value, not a control: it takes no room on a page a person is reading. The
   builder still shows a placeholder for it, which is what makes it selectable there. */
.plitzi-component__form-control-hidden { display: none; }

.navLink:hover { color: var(--fg); background-color: var(--surface-2); }
.accountPill:hover, .chipQuiet:hover, .buttonQuiet:hover, .themeToggle:hover { border-color: var(--accent); color: var(--accent-ink); }
.cardLink:hover .cardTitle, .quietItem:hover .quietTitle, .moreCard:hover .moreTitle { color: var(--accent-ink); }
.hero:hover .heroImage { transform: scale(1.04); }
.cardLink:hover .cardImage, .moreCard:hover .moreImage { transform: scale(1.05); }
.button:hover, .buttonWide:hover, .signInLink:hover {
  transform: translateY(-1px); box-shadow: 0 18px 34px -16px var(--accent-shadow);
}
.hero:hover .readLink { transform: translateY(-1px); box-shadow: 0 14px 30px -14px rgba(0, 0, 0, 0.5); }
.input:focus, .textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
.card:last-child { border-bottom-width: 0px; padding-bottom: 0px; }

/* The pager is one element with four parts and only a base class, so its buttons are reachable by the names it
   renders them with and nowhere else. Same pills as everything else here, and a current page that looks it. */
.pager button {
  min-width: 34px; height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--surface); color: var(--fg-muted); font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
}
.pager button:hover:not(:disabled) { color: var(--accent-ink); border-color: var(--accent); }
.pager button:disabled { opacity: 0.45; cursor: default; }
.plitzi-component__pagination-page--current {
  background: linear-gradient(140deg, var(--accent), var(--accent-2)) !important;
  border-color: transparent !important; color: #ffffff !important;
}

::selection { background: var(--accent-soft); color: var(--accent-ink); }

/* One ring, for whoever is on a keyboard, and only for them — which is the whole of what :focus-visible says.
   It lives here because the style vocabulary has outline-style but no outline, and no pseudo-classes at all. */
a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px;
}

/* Every transition in this space is decoration. Somebody who has asked their machine for less gets less. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  .hero:hover .heroImage, .cardLink:hover .cardImage, .moreCard:hover .moreImage,
  .readLink:hover, .button:hover, .buttonWide:hover, .signInLink:hover { transform: none; }
}

/* The toggle ships both icons and no opinion about either. Which one shows is the same question the palette
   answers, so it is answered the same way: the machine decides until a class on the root says otherwise. */
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
`;
