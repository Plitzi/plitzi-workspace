import type { StyleRules } from './types';

/**
 * Which shorthand wrote each longhand of a rule set `css()` returned, kept beside it rather than in it: the document
 * holds longhands only, and a class whose `padding` erases another class's `padding-top` on one element is told apart
 * from one that wrote `padding-top` on purpose only while the space is authored (`class-overrides-class`).
 */
const SHORTHAND_OF = new WeakMap<StyleRules, ReadonlyMap<string, string>>();

export const recordShorthands = (rules: StyleRules, from: ReadonlyMap<string, string>): void => {
  SHORTHAND_OF.set(rules, from);
};

/** The shorthand that wrote a longhand of a rule set `css()` returned, when one did. */
export const shorthandOf = (rules: StyleRules, longhand: string): string | undefined =>
  SHORTHAND_OF.get(rules)?.get(longhand);

/** `over` laid on `under`, as a spread does, with what wrote each longhand carried along. */
export const overlaid = (under: StyleRules, over: StyleRules | undefined): StyleRules => {
  const rules = { ...under, ...over };
  const from = new Map(SHORTHAND_OF.get(under));
  for (const longhand of Object.keys(over ?? {})) {
    const shorthand = over ? shorthandOf(over, longhand) : undefined;
    if (shorthand === undefined) {
      from.delete(longhand);
    } else {
      from.set(longhand, shorthand);
    }
  }

  SHORTHAND_OF.set(rules, from);

  return rules;
};
