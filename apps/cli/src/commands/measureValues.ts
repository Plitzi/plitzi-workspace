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
  // A focus ring: encore-2's design-2 reviewed one (t-stats-focus) and could only picture it.
  'outline',
  'outline-offset',
  'text-shadow',
  'opacity',
  'padding',
  'margin',
  'gap',
  'display',
  // A list's marker — its type, inside or outside, a picture: lx-product's bullets on a line of their own were
  // `list-style-position: inside`, unseen, rebuilt with a zero-width ::before at tuned heights.
  'list-style',
  'width',
  'height',
  'transform',
  'transition',
  // Where its box starts in the viewport: a column measured against another's (lx-fidelity: every agent and the lead
  // wrote a browser script of its own to read it) — and from the top of the page, an arrow at a column's foot
  // (lx-product's design-1 judged it from a picture: `--same y` was refused).
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
 * What is read of a box's `::before` and `::after`, when it draws one: velada's VS medal paints its fill on `::before`,
 * where a reading of the box alone saw none — and the plan written from it asked the fill away.
 */
export const PSEUDO_MEASURED = [
  'content',
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
   * space gives are on it — velada-backlog's `body` read Times 400 and the noscript's words.
   */
  spaceRoot?: string;
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
 * two ways for one look (velada's gold read `rgb(199, 168, 107)` on one page and `color(srgb 0.78 0.66 0.42)` on the
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
 * 1588px section of eighteen list items came 1.06px off the original's (lx-product), invisible, and failed like a
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
