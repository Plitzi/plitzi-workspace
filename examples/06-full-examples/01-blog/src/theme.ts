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

/** Cuts a paragraph off at a line count instead of at a character, which is what keeps a grid of cards even. */
export const clamp = (lines: number): StyleRules => ({
  display: '-webkit-box',
  '-webkit-line-clamp': String(lines),
  '-webkit-box-orient': 'vertical',
  overflow: 'hidden'
});

const DISPLAY = "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Times New Roman', Georgia, serif";
const UI = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

const shell = column('0px', {
  'min-height': '100vh',
  'background-color': 'var(--background)',
  color: 'var(--foreground)',
  'font-family': UI
});

const wrap = (maxWidth = '1120px'): StyleRules => ({
  width: '100%',
  'max-width': maxWidth,
  'margin-left': 'auto',
  'margin-right': 'auto'
});

const surface = (): StyleRules => ({
  'background-color': 'var(--surface)',
  ...border('1px', 'var(--border)'),
  ...radius('18px')
});

const displayText = (size: string, extra: StyleRules = {}): StyleRules => ({
  'font-family': DISPLAY,
  'font-size': size,
  'font-weight': '600',
  'line-height': '1.12',
  'letter-spacing': '-0.4px',
  'margin-top': '0px',
  'margin-bottom': '0px',
  color: 'var(--foreground)',
  ...extra
});

const label = (extra: StyleRules = {}): StyleRules => ({
  'font-size': '12px',
  'font-weight': '600',
  'letter-spacing': '1.4px',
  'text-transform': 'uppercase',
  color: 'var(--muted)',
  ...extra
});

/**
 * Every class the blog uses, written once.
 *
 * Two elements naming one class share one rule, which is the difference between a stylesheet and a pile of
 * one-off declarations — and it is what makes the space re-themable: change `--accent` here and every chip,
 * link and button follows.
 */
export const classes: NonNullable<SpaceSpec['classes']> = {
  page: { desktop: shell },
  /**
   * The provider that wraps a whole page.
   *
   * A source is published to the elements BELOW the provider that owns it, so the header's answer — who is signed
   * in, and whether they may write — reaches the rest of the page only if the page sits inside it. Being a flex
   * column that grows is what keeps the footer at the bottom of a short page.
   */
  pageInner: { desktop: column('0px', { width: '100%', 'flex-grow': '1' }) },

  // ── Header ──────────────────────────────────────────────────────────────────────────────────────────────────
  headerBand: {
    desktop: {
      width: '100%',
      'background-color': 'var(--surface)',
      ...borderSide('bottom', '1px', 'var(--border)'),
      position: 'sticky',
      top: '0px',
      'z-index': '20'
    }
  },
  headerInner: {
    desktop: row('24px', { ...wrap(), ...padding('16px', '24px'), 'justify-content': 'space-between' }),
    mobile: { ...padding('14px', '16px'), ...gap('12px') }
  },
  brand: { desktop: row('10px', { 'text-decoration': 'none', color: 'var(--foreground)' }) },
  brandMark: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '34px',
      height: '34px',
      ...radius('10px'),
      'background-color': 'var(--accent)',
      color: '#ffffff',
      'font-family': DISPLAY,
      'font-size': '19px',
      'font-weight': '600'
    }
  },
  brandName: { desktop: displayText('20px', { 'letter-spacing': '-0.2px', 'white-space': 'nowrap' }) },
  brandTag: { desktop: label({ 'font-size': '10px', 'letter-spacing': '1.8px' }), mobile: { display: 'none' } },
  nav: { desktop: row('20px') },
  navLink: {
    desktop: {
      color: 'var(--muted)',
      'text-decoration': 'none',
      'font-size': '14px',
      'font-weight': '500',
      transition: 'color 150ms ease'
    }
  },
  accountPill: {
    desktop: row('8px', {
      ...padding('6px', '12px'),
      ...radius('999px'),
      ...border('1px', 'var(--border)'),
      'background-color': 'var(--background)',
      'text-decoration': 'none',
      color: 'var(--foreground)',
      'font-size': '14px',
      'font-weight': '600',
      'white-space': 'nowrap'
    })
  },
  avatarSm: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '24px',
      height: '24px',
      ...radius('999px'),
      'background-color': 'var(--accentSoft)',
      color: 'var(--accent)',
      'font-size': '12px',
      'font-weight': '700'
    }
  },
  avatar: {
    desktop: {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '42px',
      height: '42px',
      ...radius('999px'),
      'background-color': 'var(--accentSoft)',
      color: 'var(--accent)',
      'font-family': DISPLAY,
      'font-size': '18px',
      'font-weight': '600'
    }
  },

  // ── Shared furniture ────────────────────────────────────────────────────────────────────────────────────────
  /** A provider is a plain box in the layout, so the rhythm between its sections has to be stated. */
  pageStack: { desktop: column('56px'), mobile: { ...gap('36px') } },
  main: { desktop: column('56px', { ...wrap(), ...padding('48px', '24px') }), mobile: { ...padding('28px', '16px') } },
  sectionLabel: { desktop: label({ 'padding-bottom': '14px', ...borderSide('bottom', '1px', 'var(--border)') }) },
  chip: {
    desktop: {
      display: 'inline-flex',
      'align-self': 'flex-start',
      ...padding('5px', '11px'),
      ...radius('999px'),
      'background-color': 'var(--accentSoft)',
      color: 'var(--accent)',
      'font-size': '11px',
      'font-weight': '700',
      'letter-spacing': '0.8px',
      'text-transform': 'uppercase',
      'text-decoration': 'none'
    }
  },
  meta: { desktop: { color: 'var(--muted)', 'font-size': '13px' } },
  /**
   * A column of text runs.
   *
   * The SDK's `text` element is `display: inline` — it is a run of text, not a block — so two of them in a plain
   * container sit on one line. A flex column blockifies them, which is what a name over a date needs.
   */
  stack: { desktop: column('2px', { 'align-items': 'flex-start' }) },
  metaRow: { desktop: row('10px') },
  bylineName: { desktop: { color: 'var(--foreground)', 'font-size': '14px', 'font-weight': '600' } },

  // ── Hero ────────────────────────────────────────────────────────────────────────────────────────────────────
  hero: {
    desktop: grid('minmax(0, 1fr) minmax(0, 1fr)', '44px', { 'align-items': 'center' }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('24px') }
  },
  heroText: { desktop: column('18px', { 'align-items': 'flex-start' }) },
  heroTitle: {
    desktop: displayText('54px'),
    tablet: { 'font-size': '44px' },
    mobile: { 'font-size': '34px' }
  },
  heroStandfirst: {
    desktop: { color: 'var(--muted)', 'font-size': '19px', 'line-height': '1.6', 'max-width': '46ch' }
  },
  heroImage: {
    desktop: {
      width: '100%',
      'aspect-ratio': '4 / 3',
      'object-fit': 'cover',
      ...radius('22px'),
      'box-shadow': '0 30px 60px -30px rgba(20, 20, 30, 0.45)'
    }
  },
  readLink: {
    desktop: row('8px', {
      ...padding('11px', '20px'),
      ...radius('999px'),
      'background-color': 'var(--accent)',
      color: '#ffffff',
      'font-size': '14px',
      'font-weight': '600',
      'text-decoration': 'none'
    })
  },

  // ── The list ────────────────────────────────────────────────────────────────────────────────────────────────
  layout: {
    desktop: grid('minmax(0, 1fr) 300px', '48px', { 'align-items': 'flex-start' }),
    tablet: { 'grid-template-columns': 'minmax(0, 1fr)' },
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('36px') }
  },
  feed: { desktop: column('30px') },
  card: {
    desktop: grid('220px minmax(0, 1fr)', '22px', {
      'align-items': 'flex-start',
      'padding-bottom': '30px',
      ...borderSide('bottom', '1px', 'var(--border)')
    }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('14px') }
  },
  cardImage: {
    desktop: { width: '100%', 'aspect-ratio': '4 / 3', 'object-fit': 'cover', ...radius('14px') }
  },
  cardBody: { desktop: column('10px', { 'align-items': 'flex-start' }) },
  cardLink: { desktop: { 'text-decoration': 'none', color: 'var(--foreground)' } },
  cardTitle: { desktop: displayText('25px', { 'line-height': '1.2' }), mobile: { 'font-size': '22px' } },
  cardExcerpt: {
    desktop: { color: 'var(--muted)', 'font-size': '15px', 'line-height': '1.65', ...clamp(3) }
  },
  pager: { desktop: row('8px', { 'padding-top': '10px', color: 'var(--muted)' }) },

  // ── Sidebar ─────────────────────────────────────────────────────────────────────────────────────────────────
  sidebar: { desktop: column('24px', { position: 'sticky', top: '90px' }), tablet: { position: 'static' } },
  panel: { desktop: column('14px', { ...surface(), ...padding('20px') }) },
  panelTitle: { desktop: displayText('18px') },
  panelText: { desktop: { color: 'var(--muted)', 'font-size': '14px', 'line-height': '1.65' } },
  chipRow: { desktop: { display: 'flex', 'flex-wrap': 'wrap', ...gap('8px') } },
  chipQuiet: {
    desktop: {
      display: 'inline-flex',
      'align-self': 'flex-start',
      ...padding('5px', '11px'),
      ...radius('999px'),
      ...border('1px', 'var(--border)'),
      color: 'var(--muted)',
      'font-size': '12px',
      'font-weight': '600',
      'text-decoration': 'none'
    }
  },
  quietList: { desktop: column('12px', { 'padding-left': '0px', 'margin-top': '0px', 'margin-bottom': '0px' }) },
  quietItem: { desktop: column('3px', { 'text-decoration': 'none' }) },
  quietTitle: { desktop: { color: 'var(--foreground)', 'font-size': '14px', 'font-weight': '600', ...clamp(2) } },

  // ── Article ─────────────────────────────────────────────────────────────────────────────────────────────────
  article: { desktop: column('26px', { ...wrap('760px'), 'align-items': 'flex-start' }) },
  articleTitle: { desktop: displayText('46px'), mobile: { 'font-size': '32px' } },
  articleStandfirst: { desktop: { color: 'var(--muted)', 'font-size': '20px', 'line-height': '1.6' } },
  articleImage: {
    desktop: {
      width: '100%',
      'aspect-ratio': '16 / 9',
      'object-fit': 'cover',
      ...radius('20px'),
      'box-shadow': '0 30px 60px -34px rgba(20, 20, 30, 0.5)'
    }
  },
  prose: { desktop: { color: 'var(--foreground)', 'font-size': '18px', 'line-height': '1.75', width: '100%' } },
  authorBox: {
    desktop: row('16px', { ...surface(), ...padding('20px'), width: '100%', 'align-items': 'flex-start' })
  },
  moreGrid: {
    desktop: grid('repeat(3, minmax(0, 1fr))', '22px', { 'align-items': 'flex-start' }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)' }
  },
  moreCard: { desktop: column('10px', { 'text-decoration': 'none', 'align-items': 'flex-start' }) },
  moreImage: { desktop: { width: '100%', 'aspect-ratio': '16 / 10', 'object-fit': 'cover', ...radius('12px') } },
  moreTitle: { desktop: displayText('19px', { 'line-height': '1.25', ...clamp(2) }) },

  // ── Forms ───────────────────────────────────────────────────────────────────────────────────────────────────
  editor: {
    desktop: grid('minmax(0, 1fr) 280px', '40px', { 'align-items': 'flex-start' }),
    mobile: { 'grid-template-columns': 'minmax(0, 1fr)', ...gap('28px') }
  },
  form: { desktop: column('18px', { width: '100%' }) },
  fieldRow: { desktop: column('7px') },
  fieldLabel: {
    desktop: { color: 'var(--foreground)', 'font-size': '13px', 'font-weight': '600', cursor: 'pointer' }
  },
  input: {
    desktop: {
      width: '100%',
      ...padding('11px', '14px'),
      ...border('1px', 'var(--border)'),
      ...radius('12px'),
      'background-color': 'var(--surface)',
      color: 'var(--foreground)',
      'font-size': '15px',
      'font-family': 'inherit',
      'line-height': '1.6',
      'outline-style': 'none'
    }
  },
  textarea: {
    desktop: {
      width: '100%',
      'min-height': '260px',
      ...padding('14px', '16px'),
      ...border('1px', 'var(--border)'),
      ...radius('12px'),
      'background-color': 'var(--surface)',
      color: 'var(--foreground)',
      'font-family': MONO,
      'font-size': '14px',
      'line-height': '1.7',
      'outline-style': 'none'
    }
  },
  button: {
    desktop: {
      ...padding('12px', '22px'),
      ...border('0px', 'transparent'),
      ...radius('999px'),
      'background-color': 'var(--accent)',
      color: '#ffffff',
      'font-size': '15px',
      'font-weight': '600',
      'font-family': 'inherit',
      cursor: 'pointer',
      'align-self': 'flex-start'
    }
  },
  buttonQuiet: {
    desktop: {
      ...padding('10px', '18px'),
      ...border('1px', 'var(--border)'),
      ...radius('999px'),
      'background-color': 'var(--surface)',
      color: 'var(--foreground)',
      'font-size': '14px',
      'font-weight': '600',
      'font-family': 'inherit',
      cursor: 'pointer',
      'align-self': 'flex-start'
    }
  },
  notice: {
    desktop: {
      color: 'var(--accent)',
      'font-size': '14px',
      'font-weight': '600',
      'min-height': '20px'
    }
  },
  centred: { desktop: column('22px', { ...wrap('420px'), 'align-items': 'stretch' }) },

  // ── Footer ──────────────────────────────────────────────────────────────────────────────────────────────────
  footerBand: {
    desktop: {
      width: '100%',
      'margin-top': 'auto',
      ...borderSide('top', '1px', 'var(--border)'),
      'background-color': 'var(--surface)'
    }
  },
  footerInner: {
    // Room at the bottom for the SDK's own badge, which floats in the corner of every Plitzi page.
    desktop: row('16px', {
      ...wrap(),
      ...padding('26px', '24px'),
      'padding-bottom': '46px',
      'justify-content': 'space-between'
    }),
    mobile: { 'flex-direction': 'column', 'align-items': 'flex-start', ...gap('10px') }
  }
};

/** Light and dark, both stated: a theme that only names one is a page that reads as grey-on-grey in the other. */
export const variables: SpaceSpec['variables'] = {
  color: {
    foreground: { light: '#14141a', dark: '#f4f4f6', default: '#14141a' },
    muted: { light: '#6b6b78', dark: '#9c9caa', default: '#6b6b78' },
    background: { light: '#fbfaf8', dark: '#0d0d10', default: '#fbfaf8' },
    surface: { light: '#ffffff', dark: '#16161b', default: '#ffffff' },
    border: { light: '#e9e6e0', dark: '#26262e', default: '#e9e6e0' },
    accent: { light: '#5c3df5', dark: '#a394fb', default: '#5c3df5' },
    accentSoft: { light: '#efeaff', dark: '#221c46', default: '#efeaff' }
  }
};

/**
 * Type defaults, so an element carries the blog's look before any class touches it — and the markdown a post is
 * written in, which arrives as tags nobody authored and therefore cannot reach with a class.
 */
export const elements: SpaceSpec['elements'] = {
  heading: { base: { color: 'var(--foreground)', 'margin-top': '0px', 'margin-bottom': '0px' } },
  paragraph: { base: { color: 'var(--foreground)', 'margin-top': '0px', 'margin-bottom': '0px' } },
  text: { base: { color: 'var(--foreground)' } },
  image: { base: { display: 'block' } }
};

export const customCss = `
.prose > * { max-width: 100%; }
.prose h2 { font-family: ${DISPLAY}; font-size: 28px; line-height: 1.25; margin: 40px 0 14px; }
.prose h3 { font-family: ${DISPLAY}; font-size: 22px; margin: 32px 0 10px; }
.prose p { margin: 0 0 20px; }
.prose ul, .prose ol { margin: 0 0 20px; padding-left: 22px; }
.prose li { margin-bottom: 8px; }
.prose a { color: var(--accent); }
.prose strong { font-weight: 650; }
.prose blockquote {
  margin: 28px 0; padding: 4px 0 4px 22px; border-left: 3px solid var(--accent);
  font-family: ${DISPLAY}; font-size: 21px; line-height: 1.5; color: var(--foreground);
}
.prose code { font-family: ${MONO}; font-size: 0.88em; background: var(--accentSoft); color: var(--accent);
  padding: 2px 6px; border-radius: 6px; }
.prose pre { background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px 18px; overflow-x: auto; margin: 0 0 22px; }
.prose pre code { background: none; color: var(--foreground); padding: 0; font-size: 13px; line-height: 1.6; }
.navLink:hover, .cardLink:hover .cardTitle, .quietItem:hover .quietTitle { color: var(--accent); }
.readLink:hover, .button:hover { filter: brightness(1.08); }
.card:last-child { border-bottom-width: 0px; padding-bottom: 0px; }
.input:focus, .textarea:focus { border-color: var(--accent); }
`;
