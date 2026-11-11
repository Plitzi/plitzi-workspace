// A twig filter: takes the piped value plus its already-evaluated arguments and returns the transformed value.
// Arguments are parsed and evaluated by the Evaluator before the filter runs, so a filter never parses raw
// strings itself. Registered by name in `filters`, so the set is extensible — an unknown filter is simply
// skipped rather than throwing.
export type TwigFilter = (value: unknown, args: readonly unknown[]) => unknown;

// Arrow callbacks created by the Evaluator carry their declared parameter count, so a filter can tell a
// key-extractor (`a => a.x`) from a comparator (`(a, b) => …`) — the created closures are all variadic, so
// their runtime `.length` is 0 and can't be used for this.
export const ARROW_PARAMS = Symbol('twigArrowParams');

export type ArrowCallback = ((...args: unknown[]) => unknown) & { [ARROW_PARAMS]?: number };

/** A piped value that is a list, typed as one whose items are not known yet: `Array.isArray` alone says `any[]`. */
export const isList = (value: unknown): value is unknown[] => Array.isArray(value);

/** An argument that is an arrow the Evaluator made: what a filter calls with the items. */
export const isCallback = (value: unknown): value is ArrowCallback => typeof value === 'function';
