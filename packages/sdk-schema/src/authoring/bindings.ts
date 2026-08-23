import { authoringId } from './ids';

import type { BindingSpec, BindingsSpec } from './types';
import type { BindingCategory, ElementBinding } from '@plitzi/sdk-shared';

/** Both binding forms as one list. The map form targets attributes, which is what nearly every binding does. */
export const toBindingSpecs = (bind: BindingsSpec): BindingSpec[] =>
  Array.isArray(bind) ? bind : Object.entries(bind).map(([to, source]) => ({ to, source }));

/**
 * Shows or hides an element from a value the data answered.
 *
 * Visibility is element state rather than an attribute, which is the one binding nobody guesses the category of —
 * and getting it wrong writes a `visibility` attribute no element reads, so the element stays visible and nothing
 * reports anything.
 */
export const visibleWhen = (source: string): BindingSpec => ({
  to: 'visibility',
  source,
  category: 'initialState'
});

/**
 * The other half of {@link visibleWhen}, without asking the data for it.
 *
 * A binding shows an element when its field is true and there is no "unless", so a page that needs both sides of a
 * question used to need both sides ANSWERED — `found` and a `missing` beside it, `signedIn` and a `signedOut`. That
 * is a field per question whose only reason to exist is the missing word, and it puts "when is this hidden?" in
 * whatever service produced the data rather than in the page that hides it. This inverts the value on the way in.
 */
export const hiddenWhen = (source: string): BindingSpec => ({
  ...visibleWhen(source),
  transformers: [{ action: 'not', params: {} }]
});

/** One binding, with the fields the runtime requires but nobody chooses filled in. */
export const authorBinding = (path: string, index: number, spec: BindingSpec): ElementBinding => ({
  id: authoringId(`${path}/binding/${index}`),
  source: spec.source,
  to: spec.to,
  transformers: spec.transformers ?? [],
  ...(spec.when ? { when: spec.when } : {}),
  ...(spec.enabled === undefined ? {} : { enabled: spec.enabled })
});

export const groupBindings = (path: string, bind: BindingsSpec): Partial<Record<BindingCategory, ElementBinding[]>> =>
  toBindingSpecs(bind).reduce<Partial<Record<BindingCategory, ElementBinding[]>>>((groups, spec, index) => {
    const category = spec.category ?? 'attributes';
    groups[category] = [...(groups[category] ?? []), authorBinding(path, index, spec)];

    return groups;
  }, {});
