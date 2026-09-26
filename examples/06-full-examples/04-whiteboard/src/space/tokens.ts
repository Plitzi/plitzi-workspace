import type { SpaceSpec } from '@plitzi/sdk-authoring';

/**
 * The palette, in two schemes: PAPER, dark ink on a warm sheet, and SLATE, chalk on a dark board.
 *
 * A board stores colour NAMES — `ink`, `red`, `blue` — and every name is one of the tokens below, so the same drawing
 * reads as ink on paper in one scheme and chalk on slate in the other. The canvas asks for `--board-*` properties,
 * which `css.ts` points here: the one place a colour is decided.
 */

const scheme = (light: string, dark: string) => ({ light, dark, default: light });

export const variables: SpaceSpec['variables'] = {
  color: {
    paper: scheme('#fbfaf7', '#17181c'),
    dots: scheme('rgba(30, 30, 40, 0.14)', 'rgba(235, 235, 245, 0.1)'),
    ink: scheme('#1e1e24', '#ebe9e4'),
    muted: scheme('#6b6b76', '#9d9daa'),
    surface: scheme('#ffffff', '#212328'),
    'surface-2': scheme('#f2f1ee', '#2a2c33'),
    edge: scheme('rgba(20, 20, 30, 0.09)', 'rgba(255, 255, 255, 0.08)'),
    shadow: scheme('rgba(20, 20, 40, 0.12)', 'rgba(0, 0, 0, 0.45)'),
    accent: scheme('#5b5bd6', '#8b8cf5'),
    'accent-soft': scheme('rgba(91, 91, 214, 0.12)', 'rgba(139, 140, 245, 0.18)'),
    'on-accent': scheme('#ffffff', '#101014'),
    danger: scheme('#d9383f', '#ff7178'),
    /** Strokes: saturated enough to read as lines, in both schemes. */
    red: scheme('#e03131', '#ff6b6b'),
    orange: scheme('#e8590c', '#ff922b'),
    green: scheme('#2f9e44', '#51cf66'),
    blue: scheme('#1971c2', '#4dabf7'),
    violet: scheme('#7048e8', '#9775fa'),
    /** Fills are hatched in strokes of these: pastel on paper, deep on slate, never louder than the outline. */
    'fill-red': scheme('#ffc9c9', '#8f3b3b'),
    'fill-orange': scheme('#ffd8a8', '#8f5a2b'),
    'fill-yellow': scheme('#ffec99', '#857628'),
    'fill-green': scheme('#b2f2bb', '#2f6b3a'),
    'fill-blue': scheme('#a5d8ff', '#2c5a85'),
    'fill-violet': scheme('#d0bfff', '#5a468f'),
    /** Sticky notes: paper you could buy, and its after-dark version. */
    'sticky-yellow': scheme('#fff3bf', '#5c5322'),
    'sticky-red': scheme('#ffe0e0', '#5e2c2f'),
    'sticky-orange': scheme('#ffe8cc', '#5f3d20'),
    'sticky-green': scheme('#d3f9d8', '#24452c'),
    'sticky-blue': scheme('#d0ebff', '#1f3a55'),
    'sticky-violet': scheme('#e5dbff', '#3b2f5e'),
    /** The people: one colour each, the same in both schemes, so a cursor and its avatar always match. */
    'collab-coral': scheme('#ff6b6b', '#ff6b6b'),
    'collab-amber': scheme('#f59f00', '#fab005'),
    'collab-lime': scheme('#74b816', '#94d82d'),
    'collab-teal': scheme('#12b886', '#20c997'),
    'collab-sky': scheme('#228be6', '#339af0'),
    'collab-indigo': scheme('#5c7cfa', '#748ffc'),
    'collab-orchid': scheme('#cc5de8', '#da77f2'),
    'collab-rose': scheme('#f06595', '#f783ac')
  },
  // Fonts are not a colour: `custom` is where a variable that is neither goes, emitted as a custom property.
  custom: {
    ui: "'Geist', ui-sans-serif, system-ui, sans-serif",
    hand: "'Kalam', 'Comic Sans MS', cursive"
  }
};

/** The faces the page asks for: a `font-family` above loads only if its face is listed here. */
export const fonts: NonNullable<SpaceSpec['fonts']> = [
  {
    source: 'google',
    family: 'Geist',
    fallback: 'ui-sans-serif, system-ui, sans-serif',
    weights: [400, 500, 600, 700],
    styles: ['normal'],
    display: 'swap',
    preload: true
  },
  {
    source: 'google',
    family: 'Kalam',
    fallback: 'cursive',
    weights: [400, 700],
    styles: ['normal'],
    display: 'swap',
    preload: true
  }
];

export const notifications: SpaceSpec['notifications'] = {
  background: 'var(--surface)',
  text: 'var(--ink)',
  success: 'var(--green)',
  info: 'var(--accent)',
  warning: 'var(--orange)',
  danger: 'var(--danger)',
  radius: '12px'
};
