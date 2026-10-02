# Feature flags

A space's feature flags switch parts of it on or off without editing it: a feature still being built, a version for
beta users, the old checkout kept until the new one ships. This page is how they work across the stack — where they are
stored, who decides each one, how a page, a server and a flow read them, and how they are published.

## The model

Flags live in the space's schema, keyed by the name they are read by (`packages/sdk-shared/src/types/SchemaTypes.ts`):

```ts
schema.flags = {
  newCheckout: {
    description: 'The one-step checkout',
    value: false, // the answer when no rule matches
    rules: [{ when: RuleGroup, value: true }] // read top to bottom; the first match decides
  }
};
```

A rule's `when` is the `RuleGroup` variables and flows already use, evaluated with `evaluateRuleGroup`. It sees
`environment`, `hostname`, `routeParams.*`, `queryParams.*` and the visitor — `user.authenticated`, `user.email`,
`user.username`, `user.roles`. A group with no conditions is **skipped**, not read as "always": the evaluator reads an
empty `and` as true, and an unfinished rule would otherwise turn the flag the moment it was added.

`schema.flags` is the shape every reader sees — GraphQL, the `offlineData` a page server embeds, authoring, the linter,
an agent — but they are **stored apart from the space's documents**: one document per environment in Mongo's
`space_flags` (`plitzi-sdk-server/src/services/flags/store.ts`), shared by every revision that environment serves. The
`Space` model joins it to every space it reads (`afterLoad`) and writes it back only when a save changed it, so no
reader has to know. Each document carries the hash of its content, which changes exactly when the flags do.

Flags are therefore **not served from a snapshot**. Turning a flag in production rewrites a few bytes instead of copying
the space; rolling a snapshot back keeps the environment's flags; and a space taken out as a project
(`plitzi create --from`) brings the flags it has now — from then on the developer's own.

A snapshot still **keeps a copy**: the flags its environment had when it was published, stored in the revision's own
document. It is never what a page is served with while the flags can be read — only the last fallback. Where an
environment's flags come from, the first that answers deciding:

1. `space_flags` in Mongo;
2. the Redis copy (`space:flags:<spaceId>:<environment>`), written with every change, for when Mongo cannot be read;
3. the flags the revision was published with (`snapshotFlagsOf` for a reader with no document in hand).

The draft has no third step: its flags live in `space_flags` alone. A self-hosted server reading from Plitzi adds its
own cache on top — the last flags it fetched — so it serves them with Plitzi unreachable.

## Who decides

`resolveFlags(declared, scope, overrides)` (`packages/sdk-shared/src/flags`) answers every declared flag with its value
and the layer that decided it:

| Layer | Set by | Where it comes from |
|-------|--------|---------------------|
| `space` | the space | its default, or the first rule that matched (`rule` says which) |
| `server` | the deployment rendering it | `createServer({ flags })` — a map, or a function of `{ spaceId, environment }` |
| `sdk` | whoever embeds the SDK | the `flags` prop |
| `qa` | a tester | the dev tools' **Flags** tab, kept in the `plitzi_flags[_port]` cookie |

Each layer replaces the one below, and **only for flags the space declares**: an override naming anything else is
dropped, and the page's console says so (`undeclaredFlagOverrides`). The `qa` layer is honoured only where debugging is
authorized — the same rule the dev tools panel follows — or any visitor could switch on a feature still behind a flag.

## In a page

- `GlobalSources` (`sdk-elements`) resolves the flags with `useFlagResolution` and publishes the values as the `flags`
  source (`{{ flags.newCheckout }}` in bindings, `when` rules, computed values) and the full resolution under
  `flags.resolved`, which the dev tools read. The overrides live under `flags.overrides.{server,sdk,qa}` — top-level,
  like `rsc`, so a write from the dev tools is never captured by an element scope.
- **Gating** is `definition.flag: { name, is }`. `useInternalItems` drops a gated item whose flag disagrees before it is
  instantiated, so none of it renders — not on the server, not in the browser, not its subtree. A gated page is
  decided in `NavigationProvider`, which answers 404 (resolving the flags itself, since the source is published by a
  child of it). A gate is not a visibility: a hidden element is still rendered and in the HTML.
- **A flag is not a secret.** The space's document — every element, gated or not — travels to the browser as it always
  does: navigation never goes back to the server for the next page, and a flag can change in the browser (a sign-in,
  a tester forcing it) without a reload, so the gated version has to be there to appear. Content that must not reach a
  visitor belongs behind a server action or a connector, not behind a flag.
- `useFlag(name)` (exported by `@plitzi/plitzi-sdk`) reads one from a plugin.

## On the server

`prepareRender` (`apps/server`) resolves the `server` and `qa` layers for the request and hands both to the render and
the hydration payload (`serverFlags`, `forcedFlags`), so the browser hydrates with what the server drew. A page drawn
with forced flags is never cached, and the HTML and RSC caches never serve a tester a page drawn without them.

- **RSC**: `resolveRscData` resolves the flags for the matched page and `collectServerElements` skips a gated-off
  subtree — a feature that is off puts nothing in the payload. Custom `getRscData` adapters receive `flagOverrides`.
- **Server actions** see `flags` in their scope, resolved by the runner with the run's environment and visitor through
  the `getFlags` action lookup — only for a flow that names `flags`, so the rest pay nothing. They see the `server` and
  (for a page allowed to debug) `qa` layers, never the SDK's `flags` prop: that is the browser's claim.

## Publishing

The draft (`main`) applies its flags at once. A published environment keeps its own until they are published again:

- `SpacePublish` (a snapshot) copies the draft's flags to the environment along with everything else.
- `SpacePublishFlags(environment, description)` copies only them, and makes no revision. It checks the revision being
  served against them first — a gate naming a flag the draft no longer declares is refused — and records the change in
  the space's history, which is where "who switched what, when" lives now that each environment has one document.

**How a change reaches the pages.** The revision does not move, so every cache a render is kept under is keyed by the
flags' hash too: `SSRSpaceDeployment.flagsVersion` (set per request by the deployment's `decorate`, never cached with
the resolution), the HTML, RSC and `offlineData` cache keys in `apps/server`, and the stamp `getOfflineData` compares.
A self-hosted server on `createCloudAdapters` asks `SpaceLatestRevision` on its window — which now also answers
`flagsHash` — and fetches `SpaceFlags(environment)` only when that hash moved, for a pinned revision as well.

## In the builder and the dev tools

- The **Feature Flags** panel declares flags and their rules (`SpaceSetFlag`, `SpaceRemoveFlag`), forces any of them in
  the canvas (the builder store's `qa` layer, never saved) and publishes them.
- An element's tools set its gate; the tree marks gated elements.
- The builder's own flags (`assistanceAI`, …) are Plitzi's: declared in `plitzi-sdk-server/src/config/platformFlags.ts`,
  overridden by `PLATFORM_FLAGS`, resolved per person and delivered in the builder's first query (`PlatformFlags`).
- The SDK dev tools' **Flags** tab shows each flag's value and the layer (and rule) that decided it, and forces it.

## Authoring, linting and agents

`SpaceSpec.flags` declares them; `flag: 'name'` / `flag: '!name'` gates an element or a page. `lintSpace` reports
`flag-undeclared` (a gate on an undeclared flag), `flag-unknown` (a template reading one), `flag-unused`,
`flag-rule-empty` and malformed declarations, and the export round-trip keeps them. Over MCP, agents use `upsertFlag`,
`deleteFlag`, `flag` on `upsertElement`/`patchElement`/`upsertPage`, and read `plitzi://flags/{env}`.
