import styleConstants from '@plitzi/sdk-shared/style/styleConstants';

/** Every kebab-case CSS property Plitzi's style engine understands. Values written to a definition
 *  must use these exact keys — camelCase or unknown keys are rejected by the validator. */
export const cssProperties: string[] = Array.from(new Set(Object.values(styleConstants))).sort();

const cssPropertySet = new Set(cssProperties);

export const isCssProperty = (key: string): boolean => cssPropertySet.has(key);

const toKebab = (key: string): string => key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** If a camelCase key maps to a known kebab-case property, return it — used to teach the agent the correct key. */
export const suggestCssProperty = (key: string): string | undefined => {
  const kebab = toKebab(key);

  return cssPropertySet.has(kebab) ? kebab : undefined;
};
