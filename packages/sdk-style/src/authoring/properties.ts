import styleConstants from '@plitzi/sdk-shared/style/styleConstants';

/** Every kebab-case CSS property Plitzi's style engine understands. Values written to a definition must use these
 *  exact keys — camelCase or unknown keys are rejected. */
export const cssProperties: string[] = Array.from(new Set(Object.values(styleConstants))).sort();

const cssPropertySet = new Set(cssProperties);

export const isCssProperty = (key: string): boolean => cssPropertySet.has(key);

const toKebab = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

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
