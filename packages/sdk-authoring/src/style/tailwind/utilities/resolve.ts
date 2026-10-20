import { TAILWIND_PALETTE } from '../palette';
import { FAMILIES } from './families';
import { ELSEWHERE, STATIC } from './static';
import { NoEquivalent } from './values';

import type { Declarations, Resolved, TailwindColors } from './values';

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
