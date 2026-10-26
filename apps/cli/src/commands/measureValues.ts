/**
 * What `page measure` reads of an element, and how two readings are told apart: one colour in one notation, a number
 * to two decimals, a transition held still alike to any — what a browser writes two ways for one look is no
 * difference to ask a developer for.
 */

/** What is read of each element: its type, its colours, its box's dress, its size, and how it moves. */
export const MEASURED = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color',
  'background-color',
  'background-image',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'box-shadow',
  // A focus ring: a run's design-2 reviewed one (t-stats-focus) and could only picture it.
  'outline',
  'outline-offset',
  'text-shadow',
  // A link's hover that only underlines it read as "nothing changed": a run's designer needed a picture to see it.
  'text-decoration',
  'text-underline-offset',
  'opacity',
  'padding',
  'margin',
  'gap',
  'display',
  // Where a row's parts sit across it: a legend's hairline, its ::after, centred beside two lines or on the baseline.
  'align-items',
  // How a row lays its parts out, and how much one of them grows or holds: the rules a shared class carries — a run's
  // designer, sharing five, read them through display, gap and width, `--only` refusing them.
  'flex-direction',
  'justify-content',
  'flex-grow',
  'min-width',
  // A list's marker — its type, inside or outside, a picture: a run's bullets on a line of their own were
  // `list-style-position: inside`, unseen, rebuilt with a zero-width ::before at tuned heights.
  'list-style',
  'width',
  'height',
  'transform',
  'transition',
  // Whether a part plays, is paused or stilled under reduced motion: a run's designer wrote a Playwright script of its
  // own to read it.
  'animation',
  // Where a grid places it, and the width it is held to: a run's designer read them from the served HTML with curl.
  'position',
  'max-width',
  'grid-area',
  // Where its box starts in the viewport: a column measured against another's (every agent and the lead
  // wrote a browser script of its own to read it) — and from the top of the page, an arrow at a column's foot
  // (a run's design-1 judged it from a picture: `--same y` was refused).
  'x',
  'y'
] as const;

/** The sides of a box's spacing `--same` takes alone — `margin-bottom` — each read off its shorthand as measured. */
export const SIDE_LONGHANDS: Record<string, { shorthand: 'margin' | 'padding'; side: number }> = Object.fromEntries(
  (['margin', 'padding'] as const).flatMap(shorthand =>
    ['top', 'right', 'bottom', 'left'].map((side, index) => [`${shorthand}-${side}`, { shorthand, side: index }])
  )
);

/** One side of a computed `margin` or `padding` — `0px 0px 24px` — as CSS reads one to four values. */
export const sideOf = (value: string, side: number): string => {
  const parts = value.trim().split(/\s+/);
  const [top = '0px', right = top, bottom = top, left = right] = parts;

  return [top, right, bottom, left][side];
};

/**
 * What is read of a box's `::before` and `::after`, when it draws one: a run's VS medal paints its fill on `::before`,
 * where a reading of the box alone saw none — and the plan written from it asked the fill away.
 */
export const PSEUDO_MEASURED = [
  'content',
  // Where it sits: a marquee's bulb row under its sign (a run's designer measured it by a picture).
  'position',
  'top',
  'right',
  'bottom',
  'left',
  // Where it is drawn, as an element's x and y: read off the browser's own layout, as the page gives no box of a
  // pseudo-element (a run's hairline, on the baseline or centred beside two lines, was told from a picture).
  'x',
  'y',
  // Why it sits there, when it is not positioned: on its line, or in its row.
  'display',
  'vertical-align',
  'align-self',
  'background-color',
  'background-image',
  'opacity',
  'transform',
  'transition',
  'width',
  'height',
  'border-radius',
  'box-shadow'
] as const;

export const PSEUDOS = ['before', 'after'] as const;

/** What an element takes from its parent unless it says its own: what differs on every element of a page alike. */
export const INHERITED = new Set<string>([
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color'
]);

export interface Measured {
  /** Where it was found: the selector the name resolved to. */
  selector: string;
  tag: string;
  /** Its first words, to tell it is the one meant. */
  text: string;
  /** Each property read — `before:background-image` for a pseudo-element's. */
  styles: Record<string, string>;
  /** The properties it holds as its parent does: inherited, not its own. */
  inherited: string[];
  /**
   * The space's root, when the document's `body` or `html` was measured on a page of a space: the type and colours a
   * space gives are on it — a run's `body` read Times 400 and the noscript's words.
   */
  spaceRoot?: string;
  /**
   * How many elements its selector finds, when more than one: the first shown was measured — a list's first row alone
   * (a run's widest genre name could not be named, and was proven by a picture).
   */
  matches?: number;
  /**
   * Set when no match is shown, so the one measured is hidden: its widths and place are not what a visitor sees (a run's
   * designer proved a profile's own button by the measures of one with no box at all).
   */
  hidden?: true;
}

/** A colour written as CSS Color 4 writes it — `color(srgb 0.78 0.66 0.42 / 0.5)` — as `rgb()`: one colour, one way. */
const SRGB = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/g;

const channel = (value: string): string => String(Math.round(Number(value) * 255));

/** `oklab(L a b / alpha)` — what Tailwind writes a colour as — the same colour in sRGB channels (Björn Ottosson's). */
const OKLAB = /oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)(?: \/ ([\d.]+))?\)/g;

const fromOklab = (lightness: number, a: number, b: number): [number, number, number] => {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (linear: number): number =>
    Math.round(
      Math.min(1, Math.max(0, linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055)) * 255
    );

  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
};

const rgbText = ([r, g, b]: [number, number, number], alpha?: string): string =>
  alpha === undefined || Number(alpha) === 1
    ? `rgb(${String(r)}, ${String(g)}, ${String(b)})`
    : `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(Math.round(Number(alpha) * 100) / 100)})`;

/** The transitions a computed `transition` lists, split at the commas outside their functions' parentheses. */
const transitionsOf = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  return [...parts, current];
};

/**
 * A computed value as it is compared: its colours in one notation, its numbers to two decimals — what a browser writes
 * two ways for one look (a run's gold read `rgb(199, 168, 107)` on one page and `color(srgb 0.78 0.66 0.42)` on the
 * other) is no difference to ask a developer for.
 */
export const comparable = (property: string, value: string): string => {
  // Read held still — reduced motion, as a page is measured — a transition lasts nothing: no difference to ask for.
  // Each transition of the list apart, by the commas between them — not those of its easing, `cubic-bezier(0.4, 0, …)`.
  if (
    property.endsWith('transition') &&
    transitionsOf(value).every(each => /\b(?:0s|1e-0\d+s|0\.0+\d*s)\b/.test(each))
  ) {
    return HELD_STILL;
  }

  const colours = value
    .replace(SRGB, (_match, r: string, g: string, b: string, alpha?: string) =>
      rgbText([Number(channel(r)), Number(channel(g)), Number(channel(b))], alpha)
    )
    .replace(OKLAB, (_match, lightness: string, a: string, b: string, alpha?: string) =>
      rgbText(fromOklab(Number(lightness), Number(a), Number(b)), alpha)
    )
    .replace(/rgba\((\d+), (\d+), (\d+), 1\)/g, 'rgb($1, $2, $3)');
  const numbers = colours.replace(/(\d+\.\d+)/g, number => String(Math.round(Number(number) * 100) / 100));
  // A font is the one it asks for first: the fallbacks after it are what a machine without it shows.
  if (property === 'font-family') {
    return (numbers.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase();
  }

  // A side with no width draws nothing, whatever its style and colour (its colour follows the text's).
  if (property.startsWith('border-') && /^0px\b/.test(numbers)) {
    return 'none';
  }

  return numbers;
};

/** A transition read on a page held still: alike to any, since what it would be is not read here. */
const HELD_STILL = 'held still';

/** The properties read on either side, in the order they are said: the box's, then its pseudo-elements'. */
const propertiesOf = (here: Measured, there: Measured): string[] => [
  ...MEASURED,
  ...[...new Set([...Object.keys(here.styles), ...Object.keys(there.styles)])]
    .filter(property => property.includes(':'))
    .sort()
];

export interface Difference {
  property: string;
  here: string;
  there: string;
  /** Inherited on both sides: what differs on every element under the same parent, said once and apart. */
  inherited?: true;
}

/** The properties that differ — here, there — and those the two share: what is read first, and what is said in a line. */
/**
 * Two values the same but for lengths within half a pixel of each other: a box 404.98px and one 404.86px tall draw
 * alike — held to the sub-pixel, a line failed for what no eye sees and an agent tuned a margin to 63.93px to pass it.
 */
const withinAPixel = (ours: string, theirs: string, share = 0): boolean => {
  const LENGTH = /(-?\d*\.?\d+)px/g;
  const [a, b] = [ours, theirs].map(text => Array.from(text.matchAll(LENGTH), match => Number(match[1])));
  if (a.length === 0 || a.length !== b.length || ours.replace(LENGTH, 'px') !== theirs.replace(LENGTH, 'px')) {
    return false;
  }

  return a.every((length, index) => Math.abs(length - b[index]) < Math.max(0.5, Math.abs(b[index]) * share));
};

/**
 * A box's size within a thousandth of it, half a pixel at the least: a tall one adds each of its lines' rounding — a
 * 1588px section of eighteen list items came 1.06px off the original's, invisible, and failed like a
 * button 1px off. Spacing and type stay within half a pixel: there a pixel is seen.
 */
const SIZE_SHARE: Readonly<Record<string, number>> = { width: 0.001, height: 0.001 };

export const differences = (
  here: Measured,
  there: Measured,
  asked: readonly string[] = []
): { differ: Difference[]; same: string[] } => {
  const value = (side: Measured, property: string): string => {
    const longhand = Object.hasOwn(SIDE_LONGHANDS, property) ? SIDE_LONGHANDS[property] : undefined;

    return longhand
      ? sideOf(side.styles[longhand.shorthand] ?? '0px', longhand.side)
      : (side.styles[property] ?? 'none');
  };
  const alike = (property: string): boolean => {
    const [ours, theirs] = [comparable(property, value(here, property)), comparable(property, value(there, property))];

    return (
      ours === theirs ||
      ours === HELD_STILL ||
      theirs === HELD_STILL ||
      withinAPixel(ours, theirs, SIZE_SHARE[property] ?? 0)
    );
  };
  // A side asked alone (`--same margin-bottom`) is compared too, read off the shorthand measured.
  const properties = [
    ...propertiesOf(here, there),
    ...asked.filter(property => Object.hasOwn(SIDE_LONGHANDS, property))
  ];

  return {
    differ: properties
      .filter(property => !alike(property))
      .map(property => ({
        property,
        here: value(here, property),
        there: value(there, property),
        ...(here.inherited.includes(property) && there.inherited.includes(property) ? { inherited: true as const } : {})
      })),
    same: properties.filter(alike)
  };
};

/** What `--only` asked of a reading: its styles narrowed to those properties, a side of a box read off its shorthand. */
export const onlyOf = (
  read: Measured | { problem: string },
  only: readonly string[] | undefined
): Measured | { problem: string } => {
  if (!only || 'problem' in read) {
    return read;
  }

  const shown = new Set<string>(
    only.map(each => (Object.hasOwn(SIDE_LONGHANDS, each) ? SIDE_LONGHANDS[each].shorthand : each))
  );

  return { ...read, styles: Object.fromEntries(Object.entries(read.styles).filter(([key]) => shown.has(key))) };
};

/**
 * A computed value that is its property's own initial one — what an element says nothing of: `none`, `normal`, a
 * transparent ground, no border. A reading leaves them out unless asked for all (`--all`).
 */
const INITIAL: Readonly<Record<string, RegExp>> = {
  'background-color': /^rgba\(0, 0, 0, 0\)$/,
  'background-image': /^none$/,
  'box-shadow': /^none$/,
  'text-shadow': /^none$/,
  // No line is no decoration, whatever style and colour it is said with (`none solid rgb(…)`).
  'text-decoration': /^none\b/,
  'text-underline-offset': /^auto$/,
  'align-items': /^normal$/,
  'flex-direction': /^row$/,
  'justify-content': /^normal$/,
  'flex-grow': /^0$/,
  'min-width': /^(auto|0px)$/,
  'vertical-align': /^baseline$/,
  'align-self': /^auto$/,
  // No style, or no width, is no outline — whatever colour it is said with (`rgb(…) none 3px`).
  outline: /\bnone\b|^0px\b|\s0px$/,
  'outline-offset': /^0px$/,
  opacity: /^1$/,
  transform: /^none$/,
  // A page measured with its motion stilled (`MOTION_STILL_CSS`) reads its transitions as `1e-05s`: none of its own.
  transition: /^((all|none)( 0s ease 0s)?( normal)?|(all |none )?1e-05s)$/,
  // No name, no animation — whatever its timing says; stilled, only a time is left.
  animation: /^none\b|^1e-05s$/,
  'letter-spacing': /^normal$/,
  'text-transform': /^none$/,
  'border-top': /^0px\b/,
  'border-right': /^0px\b/,
  'border-bottom': /^0px\b/,
  'border-left': /^0px\b/,
  'border-radius': /^0px$/,
  margin: /^0px$/,
  padding: /^0px$/,
  gap: /^normal$/,
  'list-style': /^outside none disc$/,
  position: /^static$/,
  'max-width': /^none$/,
  'grid-area': /^auto( \/ auto){0,3}$/,
  top: /^auto$/,
  right: /^auto$/,
  bottom: /^auto$/,
  left: /^auto$/
};

/** Whether a computed value is its property's initial one — a pseudo-element's (`before:top`) read as its property. */
export const atInitial = (property: string, value: string): boolean => {
  const own = property.includes(':') ? property.slice(property.indexOf(':') + 1) : property;

  return Object.hasOwn(INITIAL, own) && INITIAL[own].test(value.trim());
};
