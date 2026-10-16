import type { CategoryKeys } from './categoryKeys';
import type { StyleCategory } from '@plitzi/sdk-shared';

/**
 * The words people type for a property and the name CSS gives it. Only where the two share no substring — `radius`
 * already finds `border-radius`, `shadow` both shadows.
 */
const ALIASES: Record<string, string> = {
  bg: 'background',
  colour: 'color',
  rounded: 'radius',
  corner: 'radius',
  layer: 'z-index',
  stack: 'z-index'
};

/**
 * A query as the property names are written: lower case, and words joined by hyphens, so `border radius` finds
 * `border-radius`. Empty when there is nothing to search for.
 */
export const normalizeQuery = (raw: string): string => {
  const query = raw.trim().toLowerCase().replace(/\s+/g, '-');

  return ALIASES[query] ?? query;
};

/**
 * Every word typed appears in the name, in any order: `border-radius` finds `border-top-left-radius`, which is how the
 * inspector stores it — longhands — and `z-index` finds only `z-index`, not every name with a z in it.
 */
const nameMatches = (name: string, query: string): boolean =>
  query.split('-').every(word => !word || name.includes(word));

const hasKey = (keys: StyleCategory[], query: string): boolean => keys.some(key => nameMatches(key, query));

/** Whether a category holds what was typed: its title, or any property it edits. Everything matches no query. */
export const categoryMatches = ({ title, dot }: CategoryKeys, query: string): boolean =>
  !query || nameMatches(title.toLowerCase().replace(/\s+/g, '-'), query) || hasKey(dot, query);

/** Whether what was typed lives behind the category's advanced toggle — which a search then opens. */
export const advancedMatches = (advanced: StyleCategory[] | undefined, query: string): boolean =>
  !!query && !!advanced && hasKey(advanced, query);
