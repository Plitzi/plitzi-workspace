import { AuthoringError } from '../schema/codes';

/** The prefixes of the scopes being built, outermost first. */
const scopes: string[] = [];

export const scoped = (id: string): string => (scopes.length === 0 ? id : `${scopes.join('-')}-${id}`);

/**
 * Builds a part of the space whose ids are its own: every `id` given inside is prefixed — `scope('promos', ref => …)`
 * makes `id: 'panel'` the element `promos-panel` — so a helper that writes the same block twice writes two sets of ids,
 * not one id twice. `ref('slides')` is the full name, for whatever names a scoped element: a binding, a step's target,
 * a template (`` `{{ list_${ref('slides')}.index }}` ``). Scopes nest; a list's `row` already reads its list's full name.
 */
export const scope = <T>(prefix: string, build: (ref: (id: string) => string) => T): T => {
  if (!/^[A-Za-z][\w-]*$/.test(prefix)) {
    throw new AuthoringError(
      'id-invalid',
      `scope(${JSON.stringify(prefix)}) prefixes ids, so it is one: a letter first, then letters, digits, "-" and "_".`
    );
  }

  scopes.push(prefix);
  try {
    return build(scoped);
  } finally {
    scopes.pop();
  }
};
