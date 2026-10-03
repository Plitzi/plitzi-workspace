import type { StyleVariables } from '@plitzi/sdk-shared';

type VariableName<Variables> = {
  [Category in keyof Variables]: keyof Variables[Category] & string;
}[keyof Variables];

export type Tokens<Variables> = { readonly [Name in VariableName<Variables>]: `var(--${Name})` };

/**
 * The space's variables as the values a rule writes: `tokens(variables).surface` is `'var(--surface)'`. A name the
 * space does not declare is a type error where it is written, not a property the browser drops — so declare the
 * variables `as const` or `satisfies SpaceSpec['variables']`, and hand the same object to the space.
 */
export const tokens = <const Variables extends Partial<StyleVariables>>(variables: Variables): Tokens<Variables> => {
  const names = Object.values(variables).flatMap(group => Object.keys(group));
  const entries = names.map(name => [name, `var(--${name})`]);

  // `Object.fromEntries` types its result as a string record; the keys are exactly the variables' names, read above.
  return Object.freeze(Object.fromEntries(entries)) as Tokens<Variables>;
};
