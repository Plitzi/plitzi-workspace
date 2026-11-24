// A twig filter: takes the piped value plus its already-evaluated arguments and returns the transformed value.
// Arguments are parsed and evaluated by the Evaluator before the filter runs, so a filter never parses raw
// strings itself. Registered by name in `filters`, so the set is extensible — an unknown filter is simply
// skipped rather than throwing.
export type TwigFilter = (value: unknown, args: readonly unknown[], env: FilterEnv) => unknown;

/**
 * What a filter may read of the render besides its value: the instant it happens at. The page's clock (`time.now`)
 * where the template reads it — minute by minute, so `grain` is a minute and what is within one is "now" — and the
 * moment it runs otherwise.
 */
export type FilterEnv = { now: number; grain: number };

/** The page's clock in a template's scope, `time.now`: what makes a relative time move on while the page is open. */
export const TIME_NOW = 'time.now';

/** What the page's clock steps by: `time.now` is the start of the minute it is. */
export const TIME_GRAIN_MS = 60_000;

/** The instant a render happens at: the page's clock when the template's scope holds it, the moment it runs if not. */
export const filterEnvOf = (variables: Record<string, unknown>): FilterEnv => {
  const time = variables.time;
  const now = typeof time === 'object' && time !== null && 'now' in time ? time.now : undefined;

  return typeof now === 'number' ? { now, grain: TIME_GRAIN_MS } : { now: Date.now(), grain: 1 };
};

// Arrow callbacks created by the Evaluator carry their declared parameter count, so a filter can tell a
// key-extractor (`a => a.x`) from a comparator (`(a, b) => …`) — the created closures are all variadic, so
// their runtime `.length` is 0 and can't be used for this.
export const ARROW_PARAMS = Symbol('twigArrowParams');

export type ArrowCallback = ((...args: unknown[]) => unknown) & { [ARROW_PARAMS]?: number };

/** A piped value that is a list, typed as one whose items are not known yet: `Array.isArray` alone says `any[]`. */
export const isList = (value: unknown): value is unknown[] => Array.isArray(value);

/** An argument that is an arrow the Evaluator made: what a filter calls with the items. */
export const isCallback = (value: unknown): value is ArrowCallback => typeof value === 'function';
