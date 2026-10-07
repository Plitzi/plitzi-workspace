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

/**
 * The fields of the globals whose shape the platform decides, as `GlobalSources` publishes them: a read of any other
 * — `auth.authenticated` for `auth.isAuthenticated` — resolves to nothing, and the authoring linter says so. An `open`
 * field holds whatever the page puts in it (the route's params, the signed-in account's details), so nothing below it
 * is a mistake. The rest of the globals are the space's own (`variables`, `flags`, `computed`, held to what it
 * declares) or anybody's (`state`, `host`).
 */
export const GLOBAL_SOURCE_FIELDS = {
  navigation: {
    routeParams: 'open',
    queryParams: 'open',
    origin: 'value',
    href: 'value',
    currentPageId: 'value',
    pending: 'value',
    pendingLocation: 'value'
  },
  auth: { isAuthenticated: 'value', status: 'value', accessToken: 'value', details: 'open' },
  theme: { mode: 'value', resolved: 'value' }
} as const satisfies Partial<Record<GlobalSource, Record<string, 'value' | 'open'>>>;

export type ShapedGlobalSource = keyof typeof GLOBAL_SOURCE_FIELDS;

/** What one of those globals publishes: its declared fields and no others, each one a page may leave out. */
export type ShapedGlobalValue<Source extends ShapedGlobalSource> = {
  [Field in keyof (typeof GLOBAL_SOURCE_FIELDS)[Source]]?: unknown;
};
