import { familiesInCss, SYSTEM_FONTS } from './fonts';

import type { FontStyle, SpaceFont } from '../types/StyleTypes';

/**
 * What a deployment knows about a family it did not declare — the Google catalog, usually.
 *
 * Optional everywhere it is taken: without it every unknown family is declared as a system stack, which renders
 * exactly as it would have anyway and shows up in the Fonts panel for somebody to convert on purpose.
 */
export type FontCatalogLookup = (
  family: string
) => { weights: number[]; styles: FontStyle[]; category?: string } | undefined;

const FALLBACK_BY_CATEGORY: Record<string, string> = {
  serif: 'Georgia, serif',
  'sans-serif': 'system-ui, sans-serif',
  display: 'system-ui, sans-serif',
  handwriting: 'cursive',
  monospace: 'ui-monospace, monospace'
};

/** The weights a page turns out to ask for, which is a better guess than "all of them" and cheaper than it too. */
const weightsInCss = (css: string): number[] => {
  const weights = new Set<number>();
  for (const match of css.matchAll(/font-weight\s*:\s*(\d{3})/g)) {
    weights.add(Number(match[1]));
  }

  return [...weights].sort((a, b) => a - b);
};

/** A guess from the name, for a family nothing can identify: a licensed face, a foundry kit, a typo. */
export const fallbackForFamily = (family: string, category?: string): string => {
  if (category && FALLBACK_BY_CATEGORY[category]) {
    return FALLBACK_BY_CATEGORY[category];
  }

  const name = family.toLowerCase();
  if (name.includes('mono') || name.includes('code') || name.includes('courier')) {
    return 'ui-monospace, monospace';
  }

  if (name.includes('serif') && !name.includes('sans')) {
    return 'Georgia, serif';
  }

  return 'system-ui, sans-serif';
};

/**
 * The manifest a stylesheet implies.
 *
 * Used wherever CSS arrives from outside and has to become a space: an import from HTML, Tailwind or Webflow, and
 * the one-shot migration that gave the first manifests to spaces written before there were any. Both face the same
 * problem — a `font-family` names a family and says nothing about where it comes from — and the answer is the same
 * guess, so it lives once.
 *
 * A family the catalog knows is declared as a Google font at the weights the CSS actually uses. Anything else is
 * declared as a system stack: it renders exactly as it does now, and it is visible in the panel rather than being
 * a name in a stylesheet that nobody can see is unloadable.
 */
export const fontsFromCss = (css: string, lookup?: FontCatalogLookup): SpaceFont[] => {
  const system = new Set(SYSTEM_FONTS.map(font => font.family.toLowerCase()));
  const used = weightsInCss(css);

  return familiesInCss(css)
    .filter(family => !system.has(family.toLowerCase()))
    .map<SpaceFont>(family => {
      const known = lookup?.(family);
      if (!known) {
        return {
          source: 'system',
          family,
          fallback: fallbackForFamily(family),
          weights: [400, 700],
          styles: ['normal', 'italic']
        };
      }

      const wanted = known.weights.filter(weight => used.includes(weight));

      return {
        source: 'google',
        family,
        fallback: fallbackForFamily(family, known.category),
        weights: wanted.length > 0 ? wanted : known.weights.filter(weight => weight === 400 || weight === 700),
        styles: known.styles,
        display: 'swap'
      };
    })
    .map(font => (font.weights.length > 0 ? font : { ...font, weights: [400] }));
};
