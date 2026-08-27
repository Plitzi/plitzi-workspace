import { toResponsive } from './css';

import type { CssSpec, StyleDeclaration } from './types';

/**
 * A named class, declared where it is used.
 *
 * The alternative this exists to replace is not a stylesheet gathered at the top of a space — it is the TypeScript
 * helper. Sharing a rule set by writing it once in a `const` and spreading it into every element that wants it
 * reads as DRY and produces a document that is not: each element still gets a selector of its own, so five cards
 * are five identical rules and re-theming the card in the builder re-themes one of them. Across this SDK's five
 * demo spaces that idiom accounted for 165 of 320 selectors.
 *
 * ```ts
 * const card = styles('card', { padding: '24px', 'border-radius': '12px', 'background-color': 'var(--surface)' });
 *
 * container({ class: card, children: [ … ] });
 * ```
 *
 * The rules are normalised here rather than where the class is used, so a shorthand expands and an unwritable
 * property is refused on this line. What a declaration MEANS — where it is collected from, what happens when one
 * name is declared twice — belongs to whoever assembles the document; this fragment only names rules.
 */
export const styles = (name: string, rules: CssSpec): StyleDeclaration => ({
  name,
  rules: toResponsive(rules),
  // A declaration IS a class name everywhere but the type system, and the places that want the string — a
  // hand-written selector, an error message — reach it through interpolation.
  toString: () => name
});

/** The class name a value names, however it was written. */
export const className = (value: string | StyleDeclaration): string => (typeof value === 'string' ? value : value.name);
