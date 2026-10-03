/* eslint-disable quotes -- the families quote their own names, and read best in the other quotes */
/**
 * Tailwind CSS's default scales (v4.1, `theme.css`, the deprecated bare forms included), as `tw()` reads them. Copied
 * rather than imported — this package installs nothing.
 */

/** One step of the spacing scale: `p-4` is four of them. */
export const SPACING_REM = 0.25;

export const FONT_FAMILIES: Readonly<Record<string, string>> = {
  sans: "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
};

export const CONTAINERS: Readonly<Record<string, string>> = {
  '3xs': '16rem',
  '2xs': '18rem',
  xs: '20rem',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
  '5xl': '64rem',
  '6xl': '72rem',
  '7xl': '80rem'
};

/** A text size and the line height that comes with it. */
export const TEXT_SIZES: Readonly<Record<string, readonly [string, string]>> = {
  xs: ['0.75rem', 'calc(1 / 0.75)'],
  sm: ['0.875rem', 'calc(1.25 / 0.875)'],
  base: ['1rem', 'calc(1.5 / 1)'],
  lg: ['1.125rem', 'calc(1.75 / 1.125)'],
  xl: ['1.25rem', 'calc(1.75 / 1.25)'],
  '2xl': ['1.5rem', 'calc(2 / 1.5)'],
  '3xl': ['1.875rem', 'calc(2.25 / 1.875)'],
  '4xl': ['2.25rem', 'calc(2.5 / 2.25)'],
  '5xl': ['3rem', '1'],
  '6xl': ['3.75rem', '1'],
  '7xl': ['4.5rem', '1'],
  '8xl': ['6rem', '1'],
  '9xl': ['8rem', '1']
};

export const FONT_WEIGHTS: Readonly<Record<string, string>> = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900'
};

export const TRACKING: Readonly<Record<string, string>> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em'
};

export const LEADING: Readonly<Record<string, string>> = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2'
};

/** `rounded` alone is the deprecated bare radius, kept by Tailwind. */
export const RADII: Readonly<Record<string, string>> = {
  '': '0.25rem',
  none: '0px',
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  '4xl': '2rem',
  full: '9999px'
};

export const SHADOWS: Readonly<Record<string, string>> = {
  '': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  '2xs': '0 1px rgb(0 0 0 / 0.05)',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000'
};

export const DROP_SHADOWS: Readonly<Record<string, string>> = {
  '': 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow(0 1px 1px rgb(0 0 0 / 0.06))',
  xs: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.05))',
  sm: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.15))',
  md: 'drop-shadow(0 3px 3px rgb(0 0 0 / 0.12))',
  lg: 'drop-shadow(0 4px 4px rgb(0 0 0 / 0.15))',
  xl: 'drop-shadow(0 9px 7px rgb(0 0 0 / 0.1))',
  '2xl': 'drop-shadow(0 25px 25px rgb(0 0 0 / 0.15))',
  none: ''
};

export const BLURS: Readonly<Record<string, string>> = {
  '': '8px',
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '40px',
  '3xl': '64px'
};

export const EASINGS: Readonly<Record<string, string>> = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  initial: 'initial'
};

export const DEFAULT_TRANSITION = { duration: '150ms', timing: 'cubic-bezier(0.4, 0, 0.2, 1)' } as const;

/** What each `transition-*` animates; `transition` alone is Tailwind's list, less its own variables. */
export const TRANSITIONS: Readonly<Record<string, string>> = {
  '': 'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter, display, content-visibility, overlay, pointer-events',
  all: 'all',
  colors: 'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  opacity: 'opacity',
  shadow: 'box-shadow',
  transform: 'transform',
  none: 'none'
};
