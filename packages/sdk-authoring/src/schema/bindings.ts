import { didYouMean } from './suggest';

import type { BindingSpec, BindingsSpec } from './types';
import type { BindingCategory, ElementBinding } from '@plitzi/sdk-shared';

/**
 * The sources that belong to nobody, registered once for the whole space.
 *
 * They are named as themselves rather than as `<type>_<id>`, which is what tells them apart from a source an
 * element publishes — and is why an element may not answer to one of these names.
 */
export const GLOBAL_SOURCES = ['variables', 'navigation', 'auth', 'state'];

/** What an element publishes: the source prefix its type registers under, by the id it was given. */
export type SourceIndex = Map<string, string>;

/**
 * Turns what an author wrote into the name the runtime resolves.
 *
 * A source is `<sourceType>_<id>.<field>` and only the id half is a decision — the other half belongs to
 * the element, and it is not always the word the author can see: a `form` publishes under `apiContainer`. So the
 * short form names the element and the prefix is looked up, and a full one is checked against the same table.
 *
 * Both halves being wrong is the same failure and it is the quietest one this surface has: the binding resolves
 * to nothing, the element renders its placeholder, and every layer below considers the document perfectly valid.
 */
export const resolveSource = (source: string, index: SourceIndex, where: string): string => {
  const [head, ...rest] = source.split('.');
  const field = rest.join('.');
  const separator = head.indexOf('_');

  if (separator === -1) {
    if (GLOBAL_SOURCES.includes(head)) {
      return source;
    }

    const prefix = index.get(head);
    if (!prefix) {
      throw new Error(
        `${where} binds to "${source}", but nothing in this space answers to "${head}"${didYouMean(head, [...index.keys(), ...GLOBAL_SOURCES])}. A source names an element by its id, or one of the globals: ${GLOBAL_SOURCES.join(', ')}.`
      );
    }

    return field ? `${prefix}_${head}.${field}` : `${prefix}_${head}`;
  }

  const ref = head.slice(separator + 1);
  const expected = index.get(ref);
  if (!expected) {
    throw new Error(
      `${where} binds to "${source}", but no element answers to the name "${ref}"${didYouMean(ref, [...index.keys()])}.`
    );
  }

  // The half an author cannot see. Written out from the element TYPE — which is the obvious guess and wrong for a
  // form — it names a source nothing ever registers.
  if (head.slice(0, separator) !== expected) {
    throw new Error(
      `${where} binds to "${source}", but "${ref}" publishes its source as "${expected}_${ref}". Name the element alone and the prefix is filled in.`
    );
  }

  return source;
};

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

/**
 * The bindings an element declared, with its visibility condition among them.
 *
 * Appended rather than prepended so a `visible` written as a field lands where the same condition written into the
 * list would have: a binding's id carries its position, and a space that moves to the field should not move its
 * ids.
 */
export const withVisibility = (spec: { bind?: BindingsSpec; visible?: string }): BindingSpec[] | undefined => {
  const bound = spec.bind === undefined ? undefined : toBindingSpecs(spec.bind);
  if (spec.visible === undefined) {
    return bound;
  }

  // `!source` is the inverse, and it is one field rather than a `hidden` beside it because `hidden` is a real HTML
  // attribute — in this surface the attribute keeps a name it shares with anything else.
  const negated = spec.visible.startsWith('!');
  const source = negated ? spec.visible.slice(1).trim() : spec.visible;

  return [...(bound ?? []), negated ? hiddenWhen(source) : visibleWhen(source)];
};

/** One binding, with the fields the runtime requires but nobody chooses filled in. A binding id is element-local —
 *  nothing outside the element ever names one — so it says what it targets and where in the list it sits. */
export const authorBinding = (index: number, spec: BindingSpec): ElementBinding => ({
  id: `${spec.category ?? 'attributes'}-${index + 1}`,
  source: spec.source,
  to: spec.to,
  transformers: spec.transformers ?? [],
  ...(spec.when ? { when: spec.when } : {}),
  ...(spec.enabled === undefined ? {} : { enabled: spec.enabled })
});

export const groupBindings = (
  path: string,
  bind: BindingsSpec,
  sources?: SourceIndex,
  where = path
): Partial<Record<BindingCategory, ElementBinding[]>> =>
  toBindingSpecs(bind).reduce<Partial<Record<BindingCategory, ElementBinding[]>>>((groups, spec, index) => {
    const category = spec.category ?? 'attributes';
    const resolved = sources ? { ...spec, source: resolveSource(spec.source, sources, where) } : spec;
    groups[category] = [...(groups[category] ?? []), authorBinding(index, resolved)];

    return groups;
  }, {});
