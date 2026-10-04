import styleConstants from '@plitzi/sdk-shared/style/styleConstants';

/** Every kebab-case CSS property Plitzi's style engine understands. Values written to a definition must use these
 *  exact keys — camelCase or unknown keys are rejected. */
export const cssProperties: string[] = Array.from(new Set(Object.values(styleConstants))).sort();

const cssPropertySet = new Set(cssProperties);

export const isCssProperty = (key: string): boolean => cssPropertySet.has(key);

const toKebab = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * A property as an author may write it, in the spelling the document keeps: kebab-case already, or camelCase the way a
 * React style object writes it — `paddingTop` is `padding-top`, `WebkitLineClamp` is `-webkit-line-clamp`. A custom
 * property (`--brand`) is the author's own spelling and is kept.
 */
export const cssPropertyName = (key: string): string => {
  if (isCustomProperty(key) || !/[A-Z]/.test(key)) {
    return key;
  }

  const vendor = /^(Webkit|Moz|Ms|O)(?=[A-Z])/.exec(key);

  return vendor ? `-${toKebab(key)}` : toKebab(key);
};

/**
 * The properties a bare number is a whole value of — a weight, an opacity, a count, a ratio. Anywhere else a number is
 * a length, and a length without a unit is no value at all: `gap: 16` is `16px`.
 */
const UNITLESS = new Set([
  'opacity',
  'z-index',
  'font-weight',
  'line-height',
  'flex',
  'flex-grow',
  'flex-shrink',
  'order',
  'column-count',
  'aspect-ratio',
  'orphans',
  'widows',
  'zoom',
  'scale',
  'tab-size',
  'animation-iteration-count',
  'grid-row-start',
  'grid-row-end',
  'grid-column-start',
  'grid-column-end',
  'fill-opacity',
  'stroke-opacity',
  'stroke-width',
  '-webkit-line-clamp'
]);

/** A number written as a value, as CSS reads it: itself where a bare number is a whole value, pixels otherwise. */
export const cssNumberValue = (property: string, value: number): string | number =>
  UNITLESS.has(property) || isCustomProperty(property) || value === 0 ? value : `${String(value)}px`;

/** If a camelCase key maps to a known kebab-case property, return it — used to name the correct key in an error. */
export const suggestCssProperty = (key: string): string | undefined => {
  const kebab = toKebab(key);

  return cssPropertySet.has(kebab) ? kebab : undefined;
};

/**
 * A CSS custom property — `--brand`, `--space-4`.
 *
 * Not in the vocabulary and deliberately allowed anyway: a custom property is a declaration the browser resolves,
 * not one the style editor has to offer a control for, and a space that defines its palette in one place and reads
 * it back with `var(--brand)` is doing the right thing.
 */
export const isCustomProperty = (key: string): boolean => key.startsWith('--');
