import { TAILWIND_PALETTE } from '../palette';
import { CONTAINERS, SPACING_REM } from '../scales';

/**
 * What one Tailwind class says, as declarations: CSS properties by name, and — under a key starting with `@` — the
 * parts of a property several classes write together (`translate-x-2 rotate-3` is one `transform`), put together once
 * every class is read.
 */
export type Declarations = Record<string, string>;

/** Colour names beside the palette: a space's tokens (`surface: 'var(--surface)'`), or a palette name redefined. */
export type TailwindColors = Readonly<Record<string, string>>;

/** The answer for a class this table knows but Plitzi has no equivalent for — said, never guessed. */
export class NoEquivalent {
  constructor(readonly reason: string) {}
}

export type Resolved = Declarations | NoEquivalent | undefined;

export const trim = (value: number): string => String(Number(value.toFixed(6)));

/** `[220px]` → `220px`, `[0_0_20px_red]` → `0 0 20px red`; a type hint (`[length:2px]`) is dropped. */
const arbitrary = (value: string): string | undefined => {
  const match = /^\[(.+)\]$/.exec(value);
  if (!match) {
    return undefined;
  }

  const inner = match[1].replace(/^[a-z-]+:(?!\/\/)/, hint =>
    /^(url|var|calc|rgb|hsl|oklch):/.test(hint) ? hint : ''
  );

  return inner.replace(/(?<!\\)_/g, ' ').replaceAll('\\_', '_');
};

/** `(--accent)` → `var(--accent)`. */
const cssVariable = (value: string): string | undefined => {
  const match = /^\((--[\w-]+)\)$/.exec(value);

  return match ? `var(${match[1]})` : undefined;
};

export const custom = (value: string): string | undefined => arbitrary(value) ?? cssVariable(value);

export const negated = (value: string | undefined, negative: boolean): string | undefined =>
  value === undefined ? undefined : negate(value, negative);

export const negate = (value: string, negative: boolean): string => {
  if (!negative || value === '0px') {
    return value;
  }

  return /^[\d.]+[a-z%]*$/.test(value) ? `-${value}` : `calc(${value} * -1)`;
};

/** A step of the spacing scale (`4`, `0.5`), `px`, or a value of its own. */
export const spacing = (value: string): string | undefined => {
  if (value === 'px') {
    return '1px';
  }

  if (/^\d+(\.(25|5|75))?$/.test(value)) {
    const rem = Number(value) * SPACING_REM;

    return rem === 0 ? '0px' : `${trim(rem)}rem`;
  }

  return custom(value);
};

export const fraction = (value: string): string | undefined => {
  const match = /^(\d+)\/(\d+)$/.exec(value);

  return match && Number(match[2]) !== 0 ? `${trim((Number(match[1]) / Number(match[2])) * 100)}%` : undefined;
};

const SIZE_KEYWORDS: Readonly<Record<string, string>> = {
  auto: 'auto',
  full: '100%',
  min: 'min-content',
  max: 'max-content',
  fit: 'fit-content'
};

/** A width (`x`) or a height (`y`): the spacing scale, a fraction, a keyword, the viewport, a container size. */
export const size = (value: string, axis: 'x' | 'y', containers: boolean): string | undefined => {
  if (Object.hasOwn(SIZE_KEYWORDS, value)) {
    return SIZE_KEYWORDS[value];
  }

  const viewport = axis === 'x' ? 'vw' : 'vh';
  const viewports: Record<string, string> = {
    screen: `100${viewport}`,
    svw: '100svw',
    lvw: '100lvw',
    dvw: '100dvw',
    svh: '100svh',
    lvh: '100lvh',
    dvh: '100dvh'
  };
  if (Object.hasOwn(viewports, value)) {
    return viewports[value];
  }

  if (containers && Object.hasOwn(CONTAINERS, value)) {
    return CONTAINERS[value];
  }

  return fraction(value) ?? spacing(value);
};

/** A colour of the palette, of the space's own names, or one written out — with its opacity after a slash. */
export const color = (value: string, colors: TailwindColors): string | undefined => {
  const slash = value.lastIndexOf('/');
  const [name, alpha] =
    slash > 0 && !value.endsWith(']') ? [value.slice(0, slash), value.slice(slash + 1)] : [value, ''];
  const base = baseColor(name, colors);
  if (base === undefined || alpha === '') {
    return alpha === '' ? base : undefined;
  }

  const amount = /^\d+$/.test(alpha) ? `${alpha}%` : arbitrary(alpha);

  return amount === undefined ? undefined : `color-mix(in oklab, ${base} ${amount}, transparent)`;
};

const COLOR_KEYWORDS: Readonly<Record<string, string>> = {
  black: '#000',
  white: '#fff',
  transparent: 'transparent',
  current: 'currentcolor',
  inherit: 'inherit'
};

export const looksLikeColor = (value: string): boolean =>
  /^(#|rgb|hsl|oklch|oklab|lab|lch|color-mix|color\(|var\(--)/.test(value) || Object.hasOwn(COLOR_KEYWORDS, value);

const baseColor = (name: string, colors: TailwindColors): string | undefined => {
  if (Object.hasOwn(colors, name)) {
    return colors[name];
  }

  if (Object.hasOwn(COLOR_KEYWORDS, name)) {
    return COLOR_KEYWORDS[name];
  }

  const match = /^([a-z]+)-(\d+)$/.exec(name);
  if (match && Object.hasOwn(TAILWIND_PALETTE, match[1]) && Object.hasOwn(TAILWIND_PALETTE[match[1]], match[2])) {
    return TAILWIND_PALETTE[match[1]][match[2]];
  }

  const own = custom(name);

  return own !== undefined && (name.startsWith('(') || looksLikeColor(own)) ? own : undefined;
};

export const sides = (properties: readonly string[], value: string | undefined): Declarations | undefined =>
  value === undefined ? undefined : Object.fromEntries(properties.map(property => [property, value]));

export const SPACING_SIDES: Readonly<Record<string, readonly string[]>> = {
  '': ['top', 'right', 'bottom', 'left'],
  x: ['left', 'right'],
  y: ['top', 'bottom'],
  t: ['top'],
  r: ['right'],
  b: ['bottom'],
  l: ['left']
};

export const RADIUS_CORNERS: Readonly<Record<string, readonly string[]>> = {
  '': ['top-left', 'top-right', 'bottom-right', 'bottom-left'],
  t: ['top-left', 'top-right'],
  r: ['top-right', 'bottom-right'],
  b: ['bottom-right', 'bottom-left'],
  l: ['top-left', 'bottom-left'],
  tl: ['top-left'],
  tr: ['top-right'],
  br: ['bottom-right'],
  bl: ['bottom-left']
};

export const ALIGN: Readonly<Record<string, string>> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
  stretch: 'stretch',
  baseline: 'baseline',
  normal: 'normal'
};

export const one = (property: string, value: string | undefined): Declarations | undefined =>
  value === undefined ? undefined : { [property]: value };

export const lookup = (table: Readonly<Record<string, string>>, key: string): string | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

export const integer = (value: string): string | undefined => (/^\d+$/.test(value) ? value : custom(value));
