/**
 * The data sources that belong to nobody: published once for the whole space by `GlobalSources`, and named as
 * themselves rather than as `<type>_<id>` — which is what tells them apart from a source an element publishes.
 *
 * One list for everything that has to know them — the runtime evaluating computed values, the authoring validator
 * refusing a binding to a name nothing answers to, an element that may not take one of these names as its id — so a
 * new global is a global everywhere at once.
 */
export const GLOBAL_SOURCES = [
  'variables',
  'navigation',
  'auth',
  'state',
  'host',
  'theme',
  'flags',
  'computed'
] as const;

export type GlobalSource = (typeof GLOBAL_SOURCES)[number];

/**
 * What a computed value is evaluated over: every global but `state`, which a flow hands it live, and `computed`, which
 * is what is being evaluated.
 */
export const COMPUTED_GLOBALS = GLOBAL_SOURCES.filter(
  (name): name is Exclude<GlobalSource, 'state' | 'computed'> => name !== 'state' && name !== 'computed'
);
