import { sameValue } from '../history/diff';

import type { DisplayMode, SnippetStyle, Style, StyleItem, StyleVariableCategory, StyleVariables } from '../types';

const modesOf = (...platforms: Partial<Style['platform']>[]): DisplayMode[] => [
  ...new Set(platforms.flatMap(platform => Object.keys(platform) as DisplayMode[]))
];

/** A rule as it reads, without the CSS compiled from it — two rules that read the same compile the same. */
const ruleOf = (item: StyleItem | undefined) => {
  if (!item) {
    return undefined;
  }

  const { cache: _cache, ...rule } = item;

  return rule;
};

/** Every selector a style answers to, in any display mode. */
export const selectorsOf = (platform: Partial<Style['platform']>): Set<string> =>
  new Set(Object.values(platform).flatMap(items => Object.keys(items)));

/**
 * Whether a selector says the same in two styles: the same rules in every display mode, and in the same modes. A
 * selector one of them does not hold at all is not the same.
 */
export const sameSelector = (
  name: string,
  left: Partial<Style['platform']>,
  right: Partial<Style['platform']>
): boolean => modesOf(left, right).every(mode => sameValue(ruleOf(left[mode]?.[name]), ruleOf(right[mode]?.[name])));

/**
 * A snippet's style, added to the style of the space it lands in — and nothing of the space's changed by it.
 *
 * A rule is added where the space has none under that name, in that display mode; a token where the space has none
 * of that name. What the space already holds stays as it is: a class every element of the space wears, or a colour
 * the whole space reads, is not the snippet's to restyle. A snippet whose class says something else under a name the
 * space uses has been renamed before it gets here (`fitSnippet`, `@plitzi/sdk-schema`), so the only names left in
 * common are the ones that say the same.
 *
 * The one rule both the editor and the server merge by, so the style a drop leaves is the same on both.
 */
export const mergeSnippetStyle = (
  space: SnippetStyle,
  snippet: SnippetStyle
): { platform: Style['platform']; variables: Partial<StyleVariables> } => {
  const platform = { ...space.platform };
  modesOf(snippet.platform).forEach(mode => {
    const added = Object.entries(snippet.platform[mode]).filter(([name]) => !Object.hasOwn(space.platform[mode], name));
    platform[mode] = { ...space.platform[mode], ...Object.fromEntries(added) };
  });

  const variables: Partial<StyleVariables> = { ...space.variables };
  (Object.entries(snippet.variables ?? {}) as [StyleVariableCategory, StyleVariables[StyleVariableCategory]][]).forEach(
    ([category, tokens]) => {
      const held = variables[category] ?? {};
      const added = Object.entries(tokens).filter(([name]) => !Object.hasOwn(held, name));
      if (added.length > 0) {
        variables[category] = { ...held, ...Object.fromEntries(added) };
      }
    }
  );

  return { platform, variables };
};
