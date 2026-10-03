import { TAILWIND_PALETTE } from './palette';
import {
  BLURS,
  CONTAINERS,
  DROP_SHADOWS,
  EASINGS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  LEADING,
  RADII,
  SHADOWS,
  SPACING_REM,
  TEXT_SIZES,
  TRACKING,
  TRANSITIONS
} from './scales';

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

type Resolved = Declarations | NoEquivalent | undefined;

const trim = (value: number): string => String(Number(value.toFixed(6)));

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

const custom = (value: string): string | undefined => arbitrary(value) ?? cssVariable(value);

const negated = (value: string | undefined, negative: boolean): string | undefined =>
  value === undefined ? undefined : negate(value, negative);

const negate = (value: string, negative: boolean): string => {
  if (!negative || value === '0px') {
    return value;
  }

  return /^[\d.]+[a-z%]*$/.test(value) ? `-${value}` : `calc(${value} * -1)`;
};

/** A step of the spacing scale (`4`, `0.5`), `px`, or a value of its own. */
const spacing = (value: string): string | undefined => {
  if (value === 'px') {
    return '1px';
  }

  if (/^\d+(\.(25|5|75))?$/.test(value)) {
    const rem = Number(value) * SPACING_REM;

    return rem === 0 ? '0px' : `${trim(rem)}rem`;
  }

  return custom(value);
};

const fraction = (value: string): string | undefined => {
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
const size = (value: string, axis: 'x' | 'y', containers: boolean): string | undefined => {
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
const color = (value: string, colors: TailwindColors): string | undefined => {
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

const looksLikeColor = (value: string): boolean =>
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

const sides = (properties: readonly string[], value: string | undefined): Declarations | undefined =>
  value === undefined ? undefined : Object.fromEntries(properties.map(property => [property, value]));

const SPACING_SIDES: Readonly<Record<string, readonly string[]>> = {
  '': ['top', 'right', 'bottom', 'left'],
  x: ['left', 'right'],
  y: ['top', 'bottom'],
  t: ['top'],
  r: ['right'],
  b: ['bottom'],
  l: ['left']
};

const RADIUS_CORNERS: Readonly<Record<string, readonly string[]>> = {
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

const ALIGN: Readonly<Record<string, string>> = {
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

const one = (property: string, value: string | undefined): Declarations | undefined =>
  value === undefined ? undefined : { [property]: value };

const lookup = (table: Readonly<Record<string, string>>, key: string): string | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

const integer = (value: string): string | undefined => (/^\d+$/.test(value) ? value : custom(value));

/** Classes that are one fixed set of declarations. */
const STATIC: Readonly<Record<string, Declarations>> = {
  block: { display: 'block' },
  'inline-block': { display: 'inline-block' },
  inline: { display: 'inline' },
  flex: { display: 'flex' },
  'inline-flex': { display: 'inline-flex' },
  grid: { display: 'grid' },
  'inline-grid': { display: 'inline-grid' },
  contents: { display: 'contents' },
  'flow-root': { display: 'flow-root' },
  table: { display: 'table' },
  'table-row': { display: 'table-row' },
  'table-cell': { display: 'table-cell' },
  'list-item': { display: 'list-item' },
  hidden: { display: 'none' },
  static: { position: 'static' },
  fixed: { position: 'fixed' },
  absolute: { position: 'absolute' },
  relative: { position: 'relative' },
  sticky: { position: 'sticky' },
  visible: { visibility: 'visible' },
  invisible: { visibility: 'hidden' },
  collapse: { visibility: 'collapse' },
  isolate: { isolation: 'isolate' },
  'isolation-auto': { isolation: 'auto' },
  'box-border': { 'box-sizing': 'border-box' },
  'box-content': { 'box-sizing': 'content-box' },
  'float-left': { float: 'left' },
  'float-right': { float: 'right' },
  'float-none': { float: 'none' },
  'clear-both': { clear: 'both' },
  'clear-none': { clear: 'none' },
  'flex-row': { 'flex-direction': 'row' },
  'flex-row-reverse': { 'flex-direction': 'row-reverse' },
  'flex-col': { 'flex-direction': 'column' },
  'flex-col-reverse': { 'flex-direction': 'column-reverse' },
  'flex-wrap': { 'flex-wrap': 'wrap' },
  'flex-wrap-reverse': { 'flex-wrap': 'wrap-reverse' },
  'flex-nowrap': { 'flex-wrap': 'nowrap' },
  'flex-1': { 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '0%' },
  'flex-auto': { 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': 'auto' },
  'flex-initial': { 'flex-grow': '0', 'flex-shrink': '1', 'flex-basis': 'auto' },
  'flex-none': { 'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': 'auto' },
  grow: { 'flex-grow': '1' },
  'grow-0': { 'flex-grow': '0' },
  shrink: { 'flex-shrink': '1' },
  'shrink-0': { 'flex-shrink': '0' },
  'grid-flow-row': { 'grid-auto-flow': 'row' },
  'grid-flow-col': { 'grid-auto-flow': 'column' },
  'grid-flow-dense': { 'grid-auto-flow': 'dense' },
  'grid-flow-row-dense': { 'grid-auto-flow': 'row dense' },
  'grid-flow-col-dense': { 'grid-auto-flow': 'column dense' },
  'col-auto': { 'grid-column-start': 'auto', 'grid-column-end': 'auto' },
  'col-span-full': { 'grid-column-start': '1', 'grid-column-end': '-1' },
  'row-auto': { 'grid-row-start': 'auto', 'grid-row-end': 'auto' },
  'row-span-full': { 'grid-row-start': '1', 'grid-row-end': '-1' },
  'items-start': { 'align-items': 'flex-start' },
  'items-end': { 'align-items': 'flex-end' },
  'items-center': { 'align-items': 'center' },
  'items-baseline': { 'align-items': 'baseline' },
  'items-stretch': { 'align-items': 'stretch' },
  'justify-items-start': { 'justify-items': 'start' },
  'justify-items-end': { 'justify-items': 'end' },
  'justify-items-center': { 'justify-items': 'center' },
  'justify-items-stretch': { 'justify-items': 'stretch' },
  'justify-self-auto': { 'justify-self': 'auto' },
  'justify-self-start': { 'justify-self': 'start' },
  'justify-self-end': { 'justify-self': 'end' },
  'justify-self-center': { 'justify-self': 'center' },
  'justify-self-stretch': { 'justify-self': 'stretch' },
  'self-auto': { 'align-self': 'auto' },
  'self-start': { 'align-self': 'flex-start' },
  'self-end': { 'align-self': 'flex-end' },
  'self-center': { 'align-self': 'center' },
  'self-stretch': { 'align-self': 'stretch' },
  'self-baseline': { 'align-self': 'baseline' },
  'place-items-center': { 'align-items': 'center', 'justify-items': 'center' },
  'place-content-center': { 'align-content': 'center', 'justify-content': 'center' },
  'place-self-center': { 'align-self': 'center', 'justify-self': 'center' },
  'overflow-auto': { 'overflow-x': 'auto', 'overflow-y': 'auto' },
  'overflow-hidden': { 'overflow-x': 'hidden', 'overflow-y': 'hidden' },
  'overflow-clip': { 'overflow-x': 'clip', 'overflow-y': 'clip' },
  'overflow-visible': { 'overflow-x': 'visible', 'overflow-y': 'visible' },
  'overflow-scroll': { 'overflow-x': 'scroll', 'overflow-y': 'scroll' },
  'overflow-x-auto': { 'overflow-x': 'auto' },
  'overflow-x-hidden': { 'overflow-x': 'hidden' },
  'overflow-x-clip': { 'overflow-x': 'clip' },
  'overflow-x-visible': { 'overflow-x': 'visible' },
  'overflow-x-scroll': { 'overflow-x': 'scroll' },
  'overflow-y-auto': { 'overflow-y': 'auto' },
  'overflow-y-hidden': { 'overflow-y': 'hidden' },
  'overflow-y-clip': { 'overflow-y': 'clip' },
  'overflow-y-visible': { 'overflow-y': 'visible' },
  'overflow-y-scroll': { 'overflow-y': 'scroll' },
  'overscroll-auto': { 'overscroll-behavior': 'auto' },
  'overscroll-contain': { 'overscroll-behavior': 'contain' },
  'overscroll-none': { 'overscroll-behavior': 'none' },
  'object-contain': { 'object-fit': 'contain' },
  'object-cover': { 'object-fit': 'cover' },
  'object-fill': { 'object-fit': 'fill' },
  'object-none': { 'object-fit': 'none' },
  'object-scale-down': { 'object-fit': 'scale-down' },
  'object-center': { 'object-position': 'center' },
  'object-top': { 'object-position': 'top' },
  'object-bottom': { 'object-position': 'bottom' },
  'object-left': { 'object-position': 'left' },
  'object-right': { 'object-position': 'right' },
  'aspect-auto': { 'aspect-ratio': 'auto' },
  'aspect-square': { 'aspect-ratio': '1 / 1' },
  'aspect-video': { 'aspect-ratio': '16 / 9' },
  italic: { 'font-style': 'italic' },
  'not-italic': { 'font-style': 'normal' },
  'text-left': { 'text-align': 'left' },
  'text-center': { 'text-align': 'center' },
  'text-right': { 'text-align': 'right' },
  'text-justify': { 'text-align': 'justify' },
  'text-start': { 'text-align': 'start' },
  'text-end': { 'text-align': 'end' },
  underline: { 'text-decoration-line': 'underline' },
  overline: { 'text-decoration-line': 'overline' },
  'line-through': { 'text-decoration-line': 'line-through' },
  'no-underline': { 'text-decoration-line': 'none' },
  'decoration-solid': { 'text-decoration-style': 'solid' },
  'decoration-double': { 'text-decoration-style': 'double' },
  'decoration-dotted': { 'text-decoration-style': 'dotted' },
  'decoration-dashed': { 'text-decoration-style': 'dashed' },
  'decoration-wavy': { 'text-decoration-style': 'wavy' },
  uppercase: { 'text-transform': 'uppercase' },
  lowercase: { 'text-transform': 'lowercase' },
  capitalize: { 'text-transform': 'capitalize' },
  'normal-case': { 'text-transform': 'none' },
  truncate: { 'overflow-x': 'hidden', 'overflow-y': 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' },
  'text-ellipsis': { 'text-overflow': 'ellipsis' },
  'text-clip': { 'text-overflow': 'clip' },
  'text-wrap': { 'text-wrap': 'wrap' },
  'text-nowrap': { 'text-wrap': 'nowrap' },
  'text-balance': { 'text-wrap': 'balance' },
  'text-pretty': { 'text-wrap': 'pretty' },
  'whitespace-normal': { 'white-space': 'normal' },
  'whitespace-nowrap': { 'white-space': 'nowrap' },
  'whitespace-pre': { 'white-space': 'pre' },
  'whitespace-pre-line': { 'white-space': 'pre-line' },
  'whitespace-pre-wrap': { 'white-space': 'pre-wrap' },
  'whitespace-break-spaces': { 'white-space': 'break-spaces' },
  'break-normal': { 'overflow-wrap': 'normal', 'word-break': 'normal' },
  'break-words': { 'overflow-wrap': 'break-word' },
  'wrap-break-word': { 'overflow-wrap': 'break-word' },
  'wrap-anywhere': { 'overflow-wrap': 'anywhere' },
  'break-all': { 'word-break': 'break-all' },
  'break-keep': { 'word-break': 'keep-all' },
  'hyphens-auto': { hyphens: 'auto' },
  'hyphens-none': { hyphens: 'none' },
  'align-top': { 'vertical-align': 'top' },
  'align-middle': { 'vertical-align': 'middle' },
  'align-bottom': { 'vertical-align': 'bottom' },
  'align-baseline': { 'vertical-align': 'baseline' },
  'align-text-top': { 'vertical-align': 'text-top' },
  'align-text-bottom': { 'vertical-align': 'text-bottom' },
  'list-none': { 'list-style-type': 'none' },
  'list-disc': { 'list-style-type': 'disc' },
  'list-decimal': { 'list-style-type': 'decimal' },
  'list-inside': { 'list-style-position': 'inside' },
  'list-outside': { 'list-style-position': 'outside' },
  'tabular-nums': { 'font-variant-numeric': 'tabular-nums' },
  'proportional-nums': { 'font-variant-numeric': 'proportional-nums' },
  'normal-nums': { 'font-variant-numeric': 'normal' },
  'bg-fixed': { 'background-attachment': 'fixed' },
  'bg-local': { 'background-attachment': 'local' },
  'bg-scroll': { 'background-attachment': 'scroll' },
  'bg-clip-border': { 'background-clip': 'border-box' },
  'bg-clip-padding': { 'background-clip': 'padding-box' },
  'bg-clip-content': { 'background-clip': 'content-box' },
  'bg-clip-text': { 'background-clip': 'text' },
  'bg-origin-border': { 'background-origin': 'border-box' },
  'bg-origin-padding': { 'background-origin': 'padding-box' },
  'bg-origin-content': { 'background-origin': 'content-box' },
  'bg-repeat': { 'background-repeat': 'repeat' },
  'bg-no-repeat': { 'background-repeat': 'no-repeat' },
  'bg-repeat-x': { 'background-repeat': 'repeat-x' },
  'bg-repeat-y': { 'background-repeat': 'repeat-y' },
  'bg-repeat-round': { 'background-repeat': 'round' },
  'bg-repeat-space': { 'background-repeat': 'space' },
  'bg-auto': { 'background-size': 'auto' },
  'bg-cover': { 'background-size': 'cover' },
  'bg-contain': { 'background-size': 'contain' },
  'bg-center': { 'background-position': 'center' },
  'bg-top': { 'background-position': 'top' },
  'bg-bottom': { 'background-position': 'bottom' },
  'bg-left': { 'background-position': 'left' },
  'bg-right': { 'background-position': 'right' },
  'bg-none': { 'background-image': 'none' },
  'border-solid': {
    'border-top-style': 'solid',
    'border-right-style': 'solid',
    'border-bottom-style': 'solid',
    'border-left-style': 'solid'
  },
  'border-dashed': {
    'border-top-style': 'dashed',
    'border-right-style': 'dashed',
    'border-bottom-style': 'dashed',
    'border-left-style': 'dashed'
  },
  'border-dotted': {
    'border-top-style': 'dotted',
    'border-right-style': 'dotted',
    'border-bottom-style': 'dotted',
    'border-left-style': 'dotted'
  },
  'border-double': {
    'border-top-style': 'double',
    'border-right-style': 'double',
    'border-bottom-style': 'double',
    'border-left-style': 'double'
  },
  'border-none': {
    'border-top-style': 'none',
    'border-right-style': 'none',
    'border-bottom-style': 'none',
    'border-left-style': 'none'
  },
  'border-collapse': { 'border-collapse': 'collapse' },
  'border-separate': { 'border-collapse': 'separate' },
  'table-auto': { 'table-layout': 'auto' },
  'table-fixed': { 'table-layout': 'fixed' },
  'outline-none': { 'outline-style': 'none' },
  'outline-hidden': {
    'outline-style': 'solid',
    'outline-color': 'transparent',
    'outline-width': '2px',
    'outline-offset': '2px'
  },
  'outline-solid': { 'outline-style': 'solid' },
  'outline-dashed': { 'outline-style': 'dashed' },
  'outline-dotted': { 'outline-style': 'dotted' },
  'outline-double': { 'outline-style': 'double' },
  'ring-inset': { '@ring-inset': 'inset ' },
  'transform-none': { transform: 'none' },
  'filter-none': { filter: 'none' },
  'backdrop-filter-none': { 'backdrop-filter': 'none' },
  'pointer-events-none': { 'pointer-events': 'none' },
  'pointer-events-auto': { 'pointer-events': 'auto' },
  'select-none': { 'user-select': 'none' },
  'select-text': { 'user-select': 'text' },
  'select-all': { 'user-select': 'all' },
  'select-auto': { 'user-select': 'auto' },
  resize: { resize: 'both' },
  'resize-none': { resize: 'none' },
  'resize-x': { resize: 'horizontal' },
  'resize-y': { resize: 'vertical' },
  'appearance-none': { appearance: 'none' },
  'appearance-auto': { appearance: 'auto' },
  'scroll-smooth': { 'scroll-behavior': 'smooth' },
  'scroll-auto': { 'scroll-behavior': 'auto' },
  'snap-none': { 'scroll-snap-type': 'none' },
  'snap-x': { 'scroll-snap-type': 'x mandatory' },
  'snap-y': { 'scroll-snap-type': 'y mandatory' },
  'snap-both': { 'scroll-snap-type': 'both mandatory' },
  'snap-start': { 'scroll-snap-align': 'start' },
  'snap-end': { 'scroll-snap-align': 'end' },
  'snap-center': { 'scroll-snap-align': 'center' },
  'snap-align-none': { 'scroll-snap-align': 'none' },
  'snap-always': { 'scroll-snap-stop': 'always' },
  'snap-normal': { 'scroll-snap-stop': 'normal' },
  'touch-auto': { 'touch-action': 'auto' },
  'touch-none': { 'touch-action': 'none' },
  'touch-pan-x': { 'touch-action': 'pan-x' },
  'touch-pan-y': { 'touch-action': 'pan-y' },
  'touch-manipulation': { 'touch-action': 'manipulation' },
  'will-change-auto': { 'will-change': 'auto' },
  'will-change-scroll': { 'will-change': 'scroll-position' },
  'will-change-contents': { 'will-change': 'contents' },
  'will-change-transform': { 'will-change': 'transform' },
  'origin-center': { 'transform-origin': 'center' },
  'origin-top': { 'transform-origin': 'top' },
  'origin-top-right': { 'transform-origin': 'top right' },
  'origin-right': { 'transform-origin': 'right' },
  'origin-bottom-right': { 'transform-origin': 'bottom right' },
  'origin-bottom': { 'transform-origin': 'bottom' },
  'origin-bottom-left': { 'transform-origin': 'bottom left' },
  'origin-left': { 'transform-origin': 'left' },
  'origin-top-left': { 'transform-origin': 'top left' },
  grayscale: { '@filter.grayscale': 'grayscale(100%)' },
  invert: { '@filter.invert': 'invert(100%)' },
  sepia: { '@filter.sepia': 'sepia(100%)' },
  'bg-linear-to-t': { '@gradient.position': 'to top' },
  'bg-linear-to-tr': { '@gradient.position': 'to top right' },
  'bg-linear-to-r': { '@gradient.position': 'to right' },
  'bg-linear-to-br': { '@gradient.position': 'to bottom right' },
  'bg-linear-to-b': { '@gradient.position': 'to bottom' },
  'bg-linear-to-bl': { '@gradient.position': 'to bottom left' },
  'bg-linear-to-l': { '@gradient.position': 'to left' },
  'bg-linear-to-tl': { '@gradient.position': 'to top left' },
  'bg-radial': { '@gradient.position': 'radial' },
  'sr-only': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    'padding-top': '0px',
    'padding-right': '0px',
    'padding-bottom': '0px',
    'padding-left': '0px',
    'margin-top': '-1px',
    'margin-right': '-1px',
    'margin-bottom': '-1px',
    'margin-left': '-1px',
    'overflow-x': 'hidden',
    'overflow-y': 'hidden',
    'clip-path': 'inset(50%)',
    'white-space': 'nowrap',
    'border-top-width': '0px',
    'border-right-width': '0px',
    'border-bottom-width': '0px',
    'border-left-width': '0px'
  },
  'not-sr-only': {
    position: 'static',
    width: 'auto',
    height: 'auto',
    'padding-top': '0px',
    'padding-right': '0px',
    'padding-bottom': '0px',
    'padding-left': '0px',
    'margin-top': '0px',
    'margin-right': '0px',
    'margin-bottom': '0px',
    'margin-left': '0px',
    'overflow-x': 'visible',
    'overflow-y': 'visible',
    'clip-path': 'none',
    'white-space': 'normal'
  },
  // Markers for `group-hover/<name>:` and the like: they say nothing of their own.
  group: {},
  peer: {}
};

/** Classes Tailwind has and Plitzi says otherwise — each with what to write instead. */
const ELSEWHERE: readonly [RegExp, string][] = [
  [
    /^container$/,
    '`container` changes its width per Tailwind breakpoint; write `mx-auto max-w-7xl px-4` (or the size meant).'
  ],
  [
    /^(space|divide)-/,
    'it styles the children, not the element: give the element `gap` (`flex gap-4`, `grid gap-4`), or the children a class of their own.'
  ],
  [/^animate-/, 'an animation needs its keyframes: declare them in `customCss` and name them with `animation`.'],
  [
    /^p[se]-|^m[se]-|^border-[se]-|^rounded-[se][se]?-|^(start|end)-/,
    'Plitzi holds the physical sides: write `l` or `r` (`pl-4`, `mr-2`).'
  ],
  [
    /^(ring-offset|inset-ring|inset-shadow|text-shadow|mask)-/,
    'it composes a property Plitzi does not hold this way: write the CSS itself with `[property:value]`.'
  ]
];

type Family = (rest: string, negative: boolean, colors: TailwindColors) => Resolved;

const spacingSides =
  (property: 'padding' | 'margin' | 'scroll-margin' | 'scroll-padding', side: string): Family =>
  (rest, negative) => {
    if (negative && property === 'padding') {
      return undefined;
    }

    const value = property === 'margin' && rest === 'auto' ? 'auto' : spacing(rest);
    if (value === undefined) {
      return undefined;
    }

    const longhands = SPACING_SIDES[side].map(edge => `${property}-${edge}`);
    if (property.startsWith('scroll-') && longhands.some(longhand => !longhand.endsWith('-top'))) {
      return new NoEquivalent(
        `Plitzi holds the top one alone: \`${property}-top\` (\`${property === 'scroll-margin' ? 'scroll-mt' : 'scroll-pt'}-…\`).`
      );
    }

    return sides(longhands, negate(value, negative));
  };

const sized =
  (
    properties: readonly string[],
    axis: 'x' | 'y',
    containers: boolean,
    extra: Readonly<Record<string, string>> = {}
  ): Family =>
  rest =>
    sides(properties, lookup(extra, rest) ?? size(rest, axis, containers));

const inset =
  (properties: readonly string[]): Family =>
  (rest, negative) => {
    const value = rest === 'auto' ? 'auto' : rest === 'full' ? '100%' : (fraction(rest) ?? spacing(rest));

    return value === undefined ? undefined : sides(properties, negate(value, negative));
  };

const borderWidth = (rest: string): string | undefined =>
  rest === '' ? '1px' : /^\d+$/.test(rest) ? `${rest}px` : custom(rest);

const borders =
  (edges: readonly string[]): Family =>
  (rest, _negative, colors) => {
    const width = borderWidth(rest);
    if (width !== undefined && !looksLikeColor(custom(rest) ?? '')) {
      return Object.fromEntries(
        edges.flatMap(edge => [
          [`border-${edge}-width`, width],
          [`border-${edge}-style`, 'solid']
        ])
      );
    }

    return sides(
      edges.map(edge => `border-${edge}-color`),
      color(rest, colors)
    );
  };

const transformPart =
  (parts: readonly string[], unit: (value: string) => string | undefined): Family =>
  (rest, negative) => {
    const value = unit(rest);

    return value === undefined ? undefined : sides(parts, negate(value, negative));
  };

const spanOf = (value: string): string | undefined => {
  const count = integer(value);

  return count === undefined ? undefined : `span ${count}`;
};

const lineClamp = (value: string): Declarations | undefined => {
  if (value === 'none') {
    return { 'overflow-x': 'visible', 'overflow-y': 'visible', display: 'block', '-webkit-line-clamp': 'unset' };
  }

  const lines = integer(value);

  return lines === undefined
    ? undefined
    : {
        'overflow-x': 'hidden',
        'overflow-y': 'hidden',
        display: '-webkit-box',
        '-webkit-box-orient': 'vertical',
        '-webkit-line-clamp': lines
      };
};

const wrapped = (fn: string, value: string | undefined): string | undefined =>
  value === undefined ? undefined : `${fn}(${value})`;

/** A family by name (`font-mono`), a weight (`font-bold`), or either written out — a number is a weight. */
const font = (value: string): Declarations | undefined => {
  if (Object.hasOwn(FONT_FAMILIES, value)) {
    return { 'font-family': FONT_FAMILIES[value] };
  }

  if (Object.hasOwn(FONT_WEIGHTS, value)) {
    return { 'font-weight': FONT_WEIGHTS[value] };
  }

  const own = custom(value);
  if (own === undefined) {
    return undefined;
  }

  return /^\d+$/.test(own) ? { 'font-weight': own } : { 'font-family': own };
};

const percent = (value: string): string | undefined => (/^\d+$/.test(value) ? `${value}%` : custom(value));
const degrees = (value: string): string | undefined => (/^\d+$/.test(value) ? `${value}deg` : custom(value));
const translation = (value: string): string | undefined =>
  value === 'full' ? '100%' : (fraction(value) ?? spacing(value));

const filterPart =
  (target: 'filter' | 'backdrop', name: string, unit: (value: string) => string | undefined): Family =>
  rest => {
    const value = unit(rest);

    return value === undefined ? undefined : { [`@${target}.${name}`]: `${name}(${value})` };
  };

const blur =
  (target: 'filter' | 'backdrop'): Family =>
  rest => {
    const value = lookup(BLURS, rest) ?? custom(rest);

    return value === undefined ? undefined : { [`@${target}.blur`]: `blur(${value})` };
  };

const gradientStop =
  (stop: 'from' | 'via' | 'to'): Family =>
  (rest, _negative, colors) => {
    if (/^\d+%$/.test(rest)) {
      return { [`@gradient.${stop}-position`]: rest };
    }

    return one(`@gradient.${stop}`, color(rest, colors));
  };

/** Every family, longest prefix first, so `border-t` is read before `border` and `max-w` before nothing. */
const FAMILY_LIST: [string, Family][] = [
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [`p${side}`, spacingSides('padding', side)]),
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [`m${side}`, spacingSides('margin', side)]),
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [
    `scroll-m${side}`,
    spacingSides('scroll-margin', side)
  ]),
  ...Object.keys(SPACING_SIDES).map((side): [string, Family] => [
    `scroll-p${side}`,
    spacingSides('scroll-padding', side)
  ]),
  ['gap', rest => sides(['row-gap', 'column-gap'], spacing(rest))],
  ['gap-x', rest => one('column-gap', spacing(rest))],
  ['gap-y', rest => one('row-gap', spacing(rest))],
  ['w', sized(['width'], 'x', true)],
  ['h', sized(['height'], 'y', false)],
  ['size', sized(['width', 'height'], 'x', false)],
  ['min-w', sized(['min-width'], 'x', true)],
  ['min-h', sized(['min-height'], 'y', false)],
  ['max-w', sized(['max-width'], 'x', true, { none: 'none', prose: '65ch' })],
  ['max-h', sized(['max-height'], 'y', false, { none: 'none' })],
  ['inset', inset(['top', 'right', 'bottom', 'left'])],
  ['inset-x', inset(['left', 'right'])],
  ['inset-y', inset(['top', 'bottom'])],
  ['top', inset(['top'])],
  ['right', inset(['right'])],
  ['bottom', inset(['bottom'])],
  ['left', inset(['left'])],
  ['z', (rest, negative) => one('z-index', rest === 'auto' ? 'auto' : negated(integer(rest), negative))],
  [
    'order',
    (rest, negative) =>
      one('order', lookup({ first: '-9999', last: '9999', none: '0' }, rest) ?? negated(integer(rest), negative))
  ],
  ['basis', rest => one('flex-basis', size(rest, 'x', true))],
  ['grow', rest => one('flex-grow', integer(rest))],
  ['shrink', rest => one('flex-shrink', integer(rest))],
  ['flex', rest => (/^\d+$/.test(rest) ? { 'flex-grow': rest, 'flex-shrink': '1', 'flex-basis': '0%' } : undefined)],
  [
    'grid-cols',
    rest =>
      one(
        'grid-template-columns',
        rest === 'none'
          ? 'none'
          : rest === 'subgrid'
            ? 'subgrid'
            : /^\d+$/.test(rest)
              ? `repeat(${rest}, minmax(0, 1fr))`
              : custom(rest)
      )
  ],
  [
    'grid-rows',
    rest =>
      one(
        'grid-template-rows',
        rest === 'none'
          ? 'none'
          : rest === 'subgrid'
            ? 'subgrid'
            : /^\d+$/.test(rest)
              ? `repeat(${rest}, minmax(0, 1fr))`
              : custom(rest)
      )
  ],
  ['col-span', rest => sides(['grid-column-start', 'grid-column-end'], spanOf(rest))],
  ['row-span', rest => sides(['grid-row-start', 'grid-row-end'], spanOf(rest))],
  ['col-start', rest => one('grid-column-start', rest === 'auto' ? 'auto' : integer(rest))],
  ['col-end', rest => one('grid-column-end', rest === 'auto' ? 'auto' : integer(rest))],
  ['row-start', rest => one('grid-row-start', rest === 'auto' ? 'auto' : integer(rest))],
  ['row-end', rest => one('grid-row-end', rest === 'auto' ? 'auto' : integer(rest))],
  [
    'auto-cols',
    rest =>
      one(
        'grid-auto-columns',
        lookup({ auto: 'auto', min: 'min-content', max: 'max-content', fr: 'minmax(0, 1fr)' }, rest) ?? custom(rest)
      )
  ],
  [
    'auto-rows',
    rest =>
      one(
        'grid-auto-rows',
        lookup({ auto: 'auto', min: 'min-content', max: 'max-content', fr: 'minmax(0, 1fr)' }, rest) ?? custom(rest)
      )
  ],
  ['justify', rest => one('justify-content', lookup(ALIGN, rest))],
  ['content', rest => one('align-content', lookup(ALIGN, rest))],
  ['place-content', rest => sides(['align-content', 'justify-content'], lookup(ALIGN, rest))],
  [
    'place-items',
    rest =>
      sides(
        ['align-items', 'justify-items'],
        lookup({ start: 'start', end: 'end', center: 'center', stretch: 'stretch', baseline: 'baseline' }, rest)
      )
  ],
  ['aspect', rest => one('aspect-ratio', /^\d+\/\d+$/.test(rest) ? rest.replace('/', ' / ') : custom(rest))],
  ['columns', rest => one('column-count', integer(rest))],
  ['opacity', rest => one('opacity', /^\d+$/.test(rest) ? trim(Number(rest) / 100) : custom(rest))],
  [
    'text',
    (rest, _negative, colors) => {
      const slash = rest.indexOf('/');
      const name = slash === -1 ? rest : rest.slice(0, slash);
      const leading = slash === -1 ? undefined : rest.slice(slash + 1);
      if (Object.hasOwn(TEXT_SIZES, name)) {
        const [fontSize, lineHeight] = TEXT_SIZES[name];
        const height = leading === undefined ? lineHeight : (lookup(LEADING, leading) ?? spacing(leading));

        return height === undefined ? undefined : { 'font-size': fontSize, 'line-height': height };
      }

      const own = custom(rest);
      if (own !== undefined && !rest.startsWith('(') && !looksLikeColor(own)) {
        return { 'font-size': own };
      }

      return one('color', color(rest, colors));
    }
  ],
  ['font', rest => font(rest)],
  ['tracking', (rest, negative) => one('letter-spacing', negated(lookup(TRACKING, rest) ?? custom(rest), negative))],
  ['leading', rest => one('line-height', lookup(LEADING, rest) ?? spacing(rest))],
  ['indent', (rest, negative) => one('text-indent', negated(spacing(rest), negative))],
  ['line-clamp', rest => lineClamp(rest)],
  [
    'decoration',
    (rest, _negative, colors) =>
      /^\d+$/.test(rest)
        ? { 'text-decoration-thickness': `${rest}px` }
        : rest === 'auto' || rest === 'from-font'
          ? { 'text-decoration-thickness': rest }
          : one('text-decoration-color', color(rest, colors))
  ],
  [
    'underline-offset',
    rest => one('text-underline-offset', /^\d+$/.test(rest) ? `${rest}px` : rest === 'auto' ? 'auto' : custom(rest))
  ],
  [
    'bg',
    (rest, _negative, colors) => {
      const own = custom(rest);
      if (own !== undefined && /^(url\(|linear-gradient|radial-gradient|conic-gradient|image\()/.test(own)) {
        return { 'background-image': own };
      }

      const angle = /^linear-(\d+)$/.exec(rest);
      if (angle) {
        return { '@gradient.position': `${angle[1]}deg` };
      }

      return one('background-color', color(rest, colors));
    }
  ],
  ['from', gradientStop('from')],
  ['via', gradientStop('via')],
  ['to', gradientStop('to')],
  ['border', borders(['top', 'right', 'bottom', 'left'])],
  ['border-x', borders(['left', 'right'])],
  ['border-y', borders(['top', 'bottom'])],
  ['border-t', borders(['top'])],
  ['border-r', borders(['right'])],
  ['border-b', borders(['bottom'])],
  ['border-l', borders(['left'])],
  ['border-spacing', rest => one('border-spacing', spacing(rest))],
  ...Object.entries(RADIUS_CORNERS).map(([corner, corners]): [string, Family] => [
    corner === '' ? 'rounded' : `rounded-${corner}`,
    rest =>
      sides(
        corners.map(name => `border-${name}-radius`),
        lookup(RADII, rest) ?? custom(rest)
      )
  ]),
  [
    'outline',
    (rest, _negative, colors) =>
      rest === ''
        ? { 'outline-width': '1px', 'outline-style': 'solid' }
        : /^\d+$/.test(rest)
          ? { 'outline-width': `${rest}px`, 'outline-style': 'solid' }
          : one('outline-color', color(rest, colors))
  ],
  [
    'outline-offset',
    (rest, negative) => one('outline-offset', /^\d+$/.test(rest) ? negate(`${rest}px`, negative) : custom(rest))
  ],
  [
    'ring',
    (rest, _negative, colors) =>
      rest === ''
        ? { '@ring-width': '1px' }
        : /^\d+$/.test(rest)
          ? { '@ring-width': `${rest}px` }
          : one('@ring-color', color(rest, colors))
  ],
  [
    'shadow',
    (rest, _negative, colors) =>
      one('@shadow', lookup(SHADOWS, rest) ?? custom(rest)) ?? one('@shadow-color', color(rest, colors))
  ],
  [
    'drop-shadow',
    rest => one('@filter.drop-shadow', lookup(DROP_SHADOWS, rest) ?? wrapped('drop-shadow', custom(rest)))
  ],
  ['blur', blur('filter')],
  ['brightness', filterPart('filter', 'brightness', percent)],
  ['contrast', filterPart('filter', 'contrast', percent)],
  ['saturate', filterPart('filter', 'saturate', percent)],
  ['grayscale', filterPart('filter', 'grayscale', percent)],
  ['invert', filterPart('filter', 'invert', percent)],
  ['sepia', filterPart('filter', 'sepia', percent)],
  ['hue-rotate', filterPart('filter', 'hue-rotate', degrees)],
  ['backdrop-blur', blur('backdrop')],
  ['backdrop-brightness', filterPart('backdrop', 'brightness', percent)],
  ['backdrop-contrast', filterPart('backdrop', 'contrast', percent)],
  ['backdrop-saturate', filterPart('backdrop', 'saturate', percent)],
  ['backdrop-grayscale', filterPart('backdrop', 'grayscale', percent)],
  ['mix-blend', rest => one('mix-blend-mode', /^[a-z-]+$/.test(rest) ? rest : undefined)],
  ['transition', rest => one('@transition', lookup(TRANSITIONS, rest) ?? custom(rest))],
  ['duration', rest => one('transition-duration', /^\d+$/.test(rest) ? `${rest}ms` : custom(rest))],
  ['delay', rest => one('transition-delay', /^\d+$/.test(rest) ? `${rest}ms` : custom(rest))],
  ['ease', rest => one('transition-timing-function', lookup(EASINGS, rest) ?? custom(rest))],
  ['scale', transformPart(['@scale-x', '@scale-y'], percent)],
  ['scale-x', transformPart(['@scale-x'], percent)],
  ['scale-y', transformPart(['@scale-y'], percent)],
  ['rotate', transformPart(['@rotate'], degrees)],
  ['skew-x', transformPart(['@skew-x'], degrees)],
  ['skew-y', transformPart(['@skew-y'], degrees)],
  ['translate', transformPart(['@translate-x', '@translate-y'], translation)],
  ['translate-x', transformPart(['@translate-x'], translation)],
  ['translate-y', transformPart(['@translate-y'], translation)],
  ['origin', rest => one('transform-origin', custom(rest))],
  ['cursor', rest => one('cursor', /^[a-z-]+$/.test(rest) ? rest : custom(rest))],
  ['accent', (rest, _negative, colors) => one('accent-color', color(rest, colors))],
  ['caret', (rest, _negative, colors) => one('caret-color', color(rest, colors))],
  ['fill', (rest, _negative, colors) => one('fill', rest === 'none' ? 'none' : color(rest, colors))],
  [
    'stroke',
    (rest, _negative, colors) =>
      /^\d+$/.test(rest) ? { 'stroke-width': rest } : one('stroke', rest === 'none' ? 'none' : color(rest, colors))
  ],
  ['will-change', rest => one('will-change', custom(rest))],
  ['object', rest => one('object-position', custom(rest))]
];

const FAMILIES: readonly [string, Family][] = FAMILY_LIST.toSorted(([a], [b]) => b.length - a.length);

/** The names `tw()` offers when it does not know one — every fixed class, and each family by an example. */
export const KNOWN_NAMES: readonly string[] = [
  ...Object.keys(STATIC),
  ...FAMILIES.map(([prefix]) => `${prefix}-4`),
  ...Object.keys(TAILWIND_PALETTE).map(hue => `bg-${hue}-500`)
];

/** `[mask-type:luminance]`: one property and its value, written out. */
const arbitraryProperty = (name: string): Declarations | undefined => {
  const match = /^\[([a-z-]+):(.+)\]$/.exec(name);

  return match ? { [match[1]]: match[2].replace(/(?<!\\)_/g, ' ').replaceAll('\\_', '_') } : undefined;
};

/** What a class without its variants says, or `undefined` for one Tailwind does not have. */
export const resolveUtility = (name: string, colors: TailwindColors): Resolved => {
  if (Object.hasOwn(STATIC, name)) {
    return STATIC[name];
  }

  const property = arbitraryProperty(name);
  if (property) {
    return property;
  }

  const elsewhere = ELSEWHERE.find(([pattern]) => pattern.test(name.replace(/^-/, '')));
  if (elsewhere) {
    return new NoEquivalent(elsewhere[1]);
  }

  const negative = name.startsWith('-');
  const bare = negative ? name.slice(1) : name;
  for (const [prefix, family] of FAMILIES) {
    if (bare === prefix || bare.startsWith(`${prefix}-`)) {
      const resolved = family(bare === prefix ? '' : bare.slice(prefix.length + 1), negative, colors);
      if (resolved !== undefined) {
        return resolved;
      }
    }
  }

  return undefined;
};
