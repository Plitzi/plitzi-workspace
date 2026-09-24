---
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

## Authoring: nothing renders wrong in silence

- `authorSpace` reads every template with the runtime's own parser and refuses what it would read past: an operator it
  does not implement (`matches`), an unknown filter, function or tag, a stray character, an unclosed bracket.
- Binding templates and attribute tokens are held to what is in scope: a name nothing answers to, a short source name,
  or a source read from outside the element that publishes it is refused with the name it should have been.
- Children on a type that holds none (`heading`, `text`, `paragraph`, `image`, `formControl`…) are refused.
- A text template feeding an attribute that holds a list (a list's `items`) is refused; `returnMode: 'value'` fixes it.
- Warning `default-content-beside-children`: a `button` whose placeholder "Button" would print beside its children.
- New: `bindTemplate(to, source, template, { category, returns })`; `visible: { source, template }`; a `compact`
  breakpoint key (tablet and mobile at once); handles flag `repeated` (inside a list row) and `boxless` (a provider
  with no tag); catalogues `elementLeafTypes` and `elementDefaultAttributes`.
- Defensive by default: every field of a space, page, layout, element, binding and step is checked against what its
  type declares — an unknown key, an enumerated attribute outside its values (`subType: 'h7'`, declared per element with
  `valuesOf`), text where a flag or a list is read, an unknown binding category or transformer, a step or transformer
  param its catalog does not take (or of the wrong type), a flow with no trigger, a link or `navigate` to a page id that
  does not exist, a URL/`mailto:`/`tel:` in page mode, a controlled list with nothing to render, two pages at one
  address, an empty id, and a CSS value that is empty or breaks out of its declaration are all refused. An attribute a
  built-in element never reads is now refused (was a warning). New warnings: `unknown-element-type` (name plugin types
  with `authorSpace(space, { pluginTypes })`), `overlay-starts-open`, `provider-without-source`, `colour-without-dark`.
- `computed` on a space: values declared once and read anywhere as `{{ computed.<name> }}` (published as the global
  source `computed`). `notifications` on a space: the toast colours and radius.
- `didYouMean` also suggests a candidate that contains what was written (`template` → `twigTemplate`).
- The decompiler drops a step param its action does not take, moves `settings.computed` to `computed`, and repairs a
  full URL in a page-mode link to `mode: 'external'`, each reported as a correction.
- The skill gains `lists.md`, `plugins.md`, `authoring-errors.md` and a Recipes section (held by a test), and corrects
  the attribute template scope, the Twig subset, the filter list, trigger payloads, offline data, `isEmpty`,
  `loadStrategy` and `keepState`.

## One linter for every writer

- `lintSpace({ schema, style }, catalogs)` is the document linter everything is held to: `authorSpace` (through
  `validateSpace`), `validateTemplate`, the MCP and the server's publish gate read a space with the same rules and the
  same messages. The per-rule checks that `authorSpace` and the MCP each kept are gone.
- New rule `binding-target-unknown`: a binding onto an attribute its element never reads (`data-*`, a misspelt name)
  is refused — the value arrived and nothing showed it. `className` stays bindable.
- The MCP lints the draft of every batch (`lintDraft`) and holds each element it touches to it; an issue already there
  is labelled pre-existing. A binding onto an element that does not exist is now refused there too (the structural pass
  runs with the source catalogue). Its own attribute and `{{ variable }}` checks for built-in types are gone — the lint
  knows every attribute — so an unknown prop or an unknown variable is an error, not a warning.
- New rule `callback-key-unknown`: an element `setState`/`toggleState` writing a field its target never reads (or a
  state other than `visibility` / `styleSelectors.<selector>`) is refused. The params of the callbacks every element
  answers to are held to their spec (`vocabulary.sharedCallbacks`), and step params are read with their defaults
  filled in, as the runtime reads them — `autoDismissTimeout: 'soon'` is caught though `autoDismiss` was left out.
- `lintSpace` has one test per code, and a test that fails when a rule is added without one.
- `validateTemplate` tells a binding onto a provider left behind once (`TEMPLATE_BINDING_OUT_OF_SCOPE`), no longer also
  as `UNRESOLVED_BINDING_SOURCE`.
- `@plitzi/sdk-schema`: `REFERENCE_ERROR_CODES` and `isIntegrityError` tell a reference left dangling from a broken tree.
- MCP: `plitzi_validate`, `plitzi_apply` and `plitzi_render` share one pipeline (`draftBatch`), so validate answers
  exactly what apply would. A structural error a batch introduces blocks it wherever it lands; one already in an
  untouched element no longer blocks every edit. Its own checks that the lint now makes (first node a trigger, param
  types, a missing step target, a setState key on a built-in type) are gone.
- Builder: a write the server refuses is now put back in the editor (the check never matched, so a refused change
  stayed on screen and the next save built on it); only a write the server never answered is retried. The unused
  `urgent` queue — which nothing ever processed — `count` and `getIsProcessing` are gone.
- Builder: a problems button in the header lists what is wrong with the saved space (re-read whenever the save queue
  drains); each issue selects its element. Snapshot opens that list instead of publishing while there are errors, and
  shows it when the server refuses a publish with `SPACE_INVALID`. New builder query `SpaceIssues` (`TSpaceIssue`,
  `TSpaceIssues`).

- `fixSpace(documents, catalogs?, codes?)` and `FIXABLE_CODES`: the issues with a single reading are fixed on a copy
  — a URL in a page-mode link or `navigate`, an attribute or step param that is a typo (renamed) or is never read
  (dropped), `'true'`/`'false'` where a flag is read, a global callback on the wrong module, a utility on an element,
  a visibility binding in `attributes`, a binding onto an attribute nothing reads, a misspelt transformer, an overlay
  that starts open, a state key with `state.` in it — each reported as a line. Held by a test per code. The builder's
  problems list offers "Fix N automatically" (server mutation `SpaceFixIssues`; each issue says whether it is
  `fixable`).
- The linter's source scope is what the runtime walks: an element sees the providers around it and, past its page,
  the layout around the slot it renders in — no longer any provider anywhere in a layout.
- Builder: a template that cannot be read is said under the field while it is typed, in the binding transformer and
  flow step editors.

## One tree walk, one tree writer

- `@plitzi/sdk-schema/helpers/elementTree`: `parentChain`, `renderContext` and `descendants`, cycle-safe. The runtime's
  data-source visibility, the builder's reveal, `authorSpace` and the linter all walk the tree through it.
- `FlatMap` loses what nobody called: `validate`/`isValid`/`assertValid` (the validation lives in `validateSchema`),
  `getElement`, `elementIdConflict`, `takenIds`, `renameConflict`, `parentTree`, `childTree` and the unused statics.
  `moveElement` refuses a move into the element's own subtree without walking forever on a cyclic document, and a move
  into another page or layout carries the subtree's `rootId`.
- The MCP writes the tree through `FlatMap` (create, move, delete) like every other writer; a move into the element's
  own descendant is refused with the reason.
- `schemaToWire`/`schemaFromWire` (sdk-shared `network/spaceEvents`): a whole schema on the live channel has `flat` as
  a list; the builder reads `SPACE_UPDATED` through `schemaFromWire`.

- `FlatMap` no longer goes through lodash `get`/`set` with string paths: every read and write is typed. `addElement`
  and `moveElement` share one placement step and validate before they write — an insert that is refused leaves no
  element behind, and an anchor its parent does not list is refused rather than landing the element before the last
  sibling. A template's base element has no `parentId` (it was `null`, which the type does not allow).
- Removed what nothing used: the MCP's `isActionOp`/`isConnectorOp`/`pageStylesUri`; in the builder the empty module
  barrels, the pending `Integrations` stub, `PluginSettingsForm` and the code commented out around it,
  `useInfiniteGraphQL`, a second `formatTime`, `ToggleItem`, `ButtonVoice`, and `SpaceContext`/its provider.
- Builder resources: one preview (`ResourceContent`) for a resource on its way up, in the list and in its details — the
  list's own copy of the plugin card is gone — and one card for images and videos (`ResourceMedia`). A video was
  dragged as an image and kept its remove button under the cursor while dragged, and so did any other file; both fixed.
- `elementsByRoot` (and `RootElements`) in `@plitzi/sdk-schema/helpers/elementTree`: the element count grouped by the
  page or layout that holds it. The builder's quota panel and the server's usage API each carried a copy.
- Builder: a plugin removed from the resources leaves the elements panel while it is open, and one installed shows up in
  it (the panel read the component registry once); removing a plugin no longer takes every other plugin's stylesheet
  with it. Asking to remove a plugin that is still placed says on which pages, and how many of its elements will show
  as not found.
- `rootName` in `@plitzi/sdk-schema/helpers/elementTree`, and `elementsByRoot` takes an optional filter: the same
  per-page grouping, narrowed to the elements asked about.
- Builder: the model picker's ↑/↓ and ↵ do what its footer says (they were swallowed). Gone: the space setting `head`,
  which was never wired, a connectivity listener that only logged, and commented-out code across the builder, the SDK
  app and the packages.
- The plugin marketplace is removed. Nothing in the builder opened it any more; a space's plugins are still installed
  from its resources. Gone with it: the builder's `Marketplace` module and the `integrations` placeholder panel,
  `PluginsContextValue.fetch`, and the builder query `Plugins` (`@plitzi/sdk-shared/network/graphql/builder/Queries/PluginsQuery`).
  The server drops the catalog behind it — the `Plugins`/`Plugin` queries, `/api/plugins` and its six tables.
- No debug logging left in shipped code: `stringToArray` logged every call and the transition editor every change;
  `BlockJsx` and plugin loading report their failures as errors.

## Runtime

- Attribute `{{ tokens }}` resolve against every source around the element — a list row, a provider, `state`, `auth`,
  `navigation.currentPageId` — not only variables and route params. Only authored values are interpolated: a value a
  binding wrote is data and is never evaluated.
- The `twigTemplate` binding transformer takes `returnMode: 'value'`, answering a single `{{ expression }}` with its
  value (`processTwigValue`): a filtered array, a number, a boolean.
- `keepState` no longer deletes what it kept on the next load: before the `auth` source is published the owner is
  unknown, not "the browser".
- A `formControl` outside a `form` renders and works on its own (own value, `onChange`, follows `defaultValue`), and
  its hooks no longer run conditionally.
- Modals and dialogs are fixed to the viewport, as tall as their content up to the screen; their close control is a
  button. `openModal` metadata that parses as a non-object (`'42'`) is kept as `content`.
- `button` no longer takes its accessible name from `content`.
- `apiContainer.isEmpty` reads a plain `query` answer by what arrived.
- `container` accepts `h1`–`h6` tags, for a heading made of parts.
- `setState` keeps decimals for `number` and has a `json` type for objects and lists; `runServerAction.input` and
  `webHook.body` are declared as the objects they take (param type `json`).
- `addNotification`'s `appearance` is spelled correctly (was `appeareance`; existing flows need the key renamed).
  Notifications follow the space's theme and font.
- An `image` accepts `loadMode: 'auto'`, which the builder offers.
- `getStateManager()` gains `subscribe`.
- Routes: a slug with more than one `{{param}}` matches (only the first was converted).
- Dev tools: with the panel collapsed, the page scrolls the document as it does in production.

## Twig

- `starts with`, `ends with`, `//`, `**`, `?:`, `a ? b`, subscripts on array and hash literals.
- `format` is sprintf: flags, width, padding and precision (`'%02d'`, `'%.2f'`, `'%-8s'`).
- `date` tokens `D`, `y`, `h`, `g`, `A`, `a`, and `\` to print a character as it is.
- `inspectTemplate(template)` reports what a template would read past and the names it reads.

## CLI

- With nobody at the terminal (an agent, CI), `create` stops and prints each missing choice — package manager, mode,
  source, and the key for a cloud project — as a question the agent must put to the user, and offers no way around
  it: it used to end with "or with --yes to take the defaults", and agents took that exit instead of asking. `--yes`
  now only answers for a person at a terminal; a script passes the flags.
- Every project gets `tsx`, so `npm run author` works on a fresh checkout, and `npm run shot -- /path --width 390
  --scheme dark` takes a full-page screenshot.
- The generated visual test skips list rows and providers with no tag.
- The example plugin takes its props as attributes; in a client project its numbers come from `public/data/stats.json`
  through a provider — the offline-data pattern.

## MCP: what the agent is told

- The guide explains every operation `plitzi_apply` takes — moving and deleting elements, schema variables, design
  tokens and fonts had no word in it — and names every resource the server registers, `plitzi://fonts/{env}` (now
  registered, so it can be discovered), the layouts, the server tasks and the render guide among them. A test fails when
  an operation, a resource or a global source is missing from it.
- The global binding sources, the transformer names and the data-sources scope note are generated from
  `@plitzi/sdk-authoring`, the catalogs the linter checks a save against. They listed `collection` and `space`, which
  no longer exist, and missed `variables`, `host`, `theme` and `computed`.
- The guide says what an `apiContainer` publishes in each mode: through a connector `.records`/`.record`/`.pageInfo`,
  with a browser `query` the body under `.data` and the HTTP `.status`; both `.isLoading`, `.isEmpty`, `.hasError`.
- Server actions have their own section; the tool list names `plitzi_preview`, `plitzi_screenshot` and
  `plitzi_render`; the co-worker prompt lists the layouts, fonts, connectors and actions.
- The guide's connector examples read a record's fields under `values` (`list_posts.item.values.title`,
  `.record.values.<field>`), which is where the engine puts them; they bound to nothing as written.
- The `plitzi-render` skill's first example no longer sets the `min-width: 0` its own rules say is unneeded; the
  authoring skill lists `host` and `computed` among the globals.
- New guides: `docs/en/mcp.md` — connecting an agent, how it works a space, what the server guarantees, what is
  deliberately left open — and `docs/en/connectors.md`, which only existed in Spanish. RFC 0002 is removed now that it
  shipped. The repository READMEs, `claude.md`, onboarding and repository-structure list `apps/mcp`, `apps/cli`,
  `apps/desktop` and `sdk-authoring`, and no longer `sdk-collections`.

## Preview a published revision

- The draft preview takes an optional `revision` (`PreviewRequestBody.revision`, carried by `PreviewClient.render`):
  a published revision of `env` rendered instead of its latest, so a capture can show one exact version — the one a
  reviewer approved rather than whatever was published after. Ignored for `main`; a revision that is not a positive
  integer is a 400.

## Builder: the server's reason, not "network not available"

- A query the server refused shows the server's own message in its toast — "the storage provider refused this CDN's
  credential", "there is no bucket …" — where it used to say "Query … Failed" and, wrongly, "Network Not Available".
  Only a request that got no answer is reported as a network problem.
- A CDN that cannot be listed says so in its panel, with the reason and a way to choose or fix its credential, instead
  of an empty list that read as "nothing uploaded".
- Every builder preview renders again — element templates from a CDN, directory items, transformer and AI previews.
  The preview's render-settings scope inherited nothing (a nexus scope is isolated unless `inherit="live"`), so it held
  `render` alone and each element failed with "Element … not found". `useRenderOverride` now says the scope must be
  live, and a test holds it.

## Interactions: "Propagate Event" does what it says

- A click, hover or focus trigger with **Propagate Event** off — the default — now answers the event for the elements
  around it too: a button inside a clickable card runs the button's flow and not the card's as well. It used to decide
  only `preventDefault`, so every clickable ancestor ran its flow after the inner one.
- The DOM event itself is not stopped: a component's own handler (a dropdown opening from a click inside it), the dev
  tools' element picker and anything listening above the space still receive it. `preventDefault` is unchanged.
- To keep the old behaviour on one element, turn Propagate Event on for the inner trigger.

## Change history

- Every save of a space's schema and style is recorded by the server — who made it (a person, an agent, the co-worker,
  the autofix), from where, and each element, class, token or font it touched, before and after. Read-only; kept per
  plan. See `docs/en/history.md`.
- Builder: a **History** panel — the timeline, newest first, with saves folded into rows, each unfolding into a
  field-by-field diff that links to its element; filters by who made it, the selected element, and since the last
  snapshot; each row numbered (`#50`), and each published revision marked right above the last change it includes
  ("Revision 4 · includes up to #50") — `upToSeq` on the snapshot markers `SpaceChanges` returns.
- `@plitzi/sdk-shared/history`: `diffSchema`, `diffStyle`, `describeChange` (a save as lines: "Added text “hero” to
  page “test”", with the parent's bookkeeping left out), `fieldChanges`, `sameValue`, `jsonCopy` and the
  `SpaceChange` vocabulary; builder query `SpaceChanges` (`TSpaceChanges`, `TSnapshotMarker`).
- `@plitzi/sdk-mcp`: `saveSchema`/`saveStyle` receive an `SSRWriteContext` (the member, one batch per tool call), and an
  optional `getChanges` adapter serves `plitzi://changes/{env}` and `plitzi://changes/{env}/{id}`.


## Kept state: what is never kept, and where keeping is decided

- New space setting **`transientState`**: top-level `runtime.state` keys that are never kept, even with `keepState` on.
  They are not written, not brought back — an entry kept before a key was declared transient does not restore it —
  and a value one of them holds survives the restore, which lands late (after hydration, once auth settles) and used
  to undo anything set before it. Built on `@plitzi/nexus` 1.3.0's `partializePath`/`mergePath`; every `@plitzi/nexus`
  range here is `^1.3.0`. Covered by
  `e2e/tests/sdk/keptState.spec.ts` across a real reload. For demos, open panels, walkthrough steps: state that must start fresh every visit.
  `authorSpace` refuses a list that is not one, an empty key and a dotted one (naming the top-level key to write), and
  warns `transient-state-without-keep-state` when `keepState` is off. The builder's State Settings has the field, and
  the MCP's `patchSettings` takes it.
- **A page no longer takes `keepState` / `stateStorage`.** The runtime only ever read them from the space's settings,
  so on a page they promised something nothing did. `authorSpace` refuses them with where they go; reading an older
  document back drops them and reports it.
- The authoring skill no longer suggests resetting kept state from `onPageLoad` — the restore lands in the middle of
  that flow — and the MCP guide describes `keepState` as what it is: `runtime.state`, not element state.

## Testing an authored space: one call, every problem

- **`inspectPage(page, handles, options?)`** (`@plitzi/sdk-authoring`): the open page, checked whole — every element it
  owes present and visible (its own and those of the layouts around it), images arrived, nothing scrolling sideways, no
  text in the colour painted behind it. Returns every problem at once, each naming the element and why
  (`display:none on "panel"`), and retries like an assertion. Driver-agnostic (anything with `evaluate`), no new
  dependency. `inspectDocument(page)` runs the page half for a page whose space is not in hand.
- `onScreen(handles, page, { elements, ignore })`: what a freshly opened page owes. Page handles carry their `layout`,
  layout handles theirs.
- `singlePageSpace(body, space?)` and `withElement(spec, id, patch)`: a one-page space, and the same space with one
  element changed — on the SPEC, so a variant is validated like any space.
- `authorSpace(spec, { allow: [{ code, element, why }] })`: a fixture that breaks a check on purpose names that break.
  It comes back in `warnings` with the reason; an entry that matches nothing is refused.
- Fixed: `defineAction` with several triggers chained them one after another, so a run through the first executed the
  second as a step. Every way in now heads the same chain.
- Fixed: `provider-without-source` warned on a provider that names a `connector`.
- The image element says when it drew its fallback: `data-plitzi-failed="<src>"`. The fallback loads, so to a browser
  a broken image looked loaded. The fallback is now state, keyed by the source: a new `src` gets its own attempt.
- The CLI's generated visual test uses `inspectPage`.
- The sample space (`examples/shared-space`) no longer sizes itself by the window: embedded beside a host's sidebar
  (`03-react-component`) it overflowed by the sidebar's width. Its RSC section is named `rsc-section`.

## A page server that starts in less memory

- `sdk-shared` imports date-fns one function per subpath, and its locales one by one: `from 'date-fns'` loaded all
  826 of its modules (and `date-fns/locale` every language) wherever the date helpers were imported, which is on every
  page server — the largest single cost of starting at all.
- `isDate(value, format)` moved to `@plitzi/sdk-shared/helpers/isDate` (still exported from `@plitzi/sdk-shared/helpers`):
  it needs date-fns `parse`, which alone costs about 100 MB, and nothing that only formats dates should load it. It is
  no longer exported from `helpers/formatDate`.
- Needs `@plitzi/plitzi-ui` with the same fix in its `formatDate` (the QueryBuilder evaluator a server loads imported
  date-fns whole, and `parse` for one fixed format). Measured on the SSR example: resident memory at rest 308 → 177 MB.
- The SDK builds to one file again: `plitzi-sdk.js`, with no `withElement-<hash>.js` or `rolldown-runtime-<hash>.js`
  beside it. The plugin loader's dynamic imports split a chunk off, which every host serving the SDK by name had to
  know about. `codeSplitting: false` (rolldown's name for the deprecated `inlineDynamicImports`) in both the SDK and
  the vendor builds.

## A page server that fits in half a CPU and 256 MB

- **Fixed: a page server leaked on every request until it ran out of memory.** The auth/deployment middleware chain
  was rebuilt per request, and `basicAuthMiddleware` starts a credential cache with a sweep timer — each request left
  one behind that its timer kept alive for good (about a kilobyte a request; a 256 MB container died after a few
  hundred thousand). The chain is built once per server, and the credential cache finally caches.
- **A cached page is compressed once.** The render cache keeps the Brotli and gzip bodies beside the HTML, so a hit is
  a copy instead of a compression — which was 87% of a hit's CPU. `res.send(body, { compressed })` takes the store to
  fill; `CompressedBodies` and the cache's `CachedPage` are exported.
- **Log levels: `logLevel` (`silent` < `error` < `warn` < `info` < `debug`).** One threshold for everything a server
  says, process-wide. Default `error` — in production only what went wrong is written — and `info` with `devMode`.
  - Requests below the threshold are not turned into events; a 5xx or a request that threw is an `error`, the rest
    `info`. A refused action is a `warn`, a run that did not complete an `error`.
  - The server's own lines (`listening on`, plugin builds, manifest fetches, failures in adapters, RSC, actions, auth
    flows) are `kind: 'message'` events on the same `logger`, where they used to go straight to the console. With
    no `logger` they still go to the console.
  - The dev metrics line is `debug`.
  - `serverLog` (`error`/`warn`/`info`/`debug`/`enabled`/`emit`), `logLevelOf` and `isLogged` are exported.
    `createRunLogger`/`createRejectLogger` are held to the same threshold.
- **`createJsonAdapters` parses a file once per version of it**, not once per request (a tenth of a render's CPU on a
  real space). A file edited by hand is read again by its mtime and size; a save drops the copy it replaced. Every
  request shares the parsed space, as they already did with `createCloudAdapters`.
- A server with `devMode` off that runs without `NODE_ENV=production` says so once, at `error`: React chose its
  development build from `NODE_ENV` when it was imported, and renders about 40% fewer pages a second with it. The
  README no longer claims `devMode` defaults from `NODE_ENV` — it defaults to off.
- `@plitzi/sdk-server` and `@plitzi/sdk-mcp` no longer bake `process.env.NODE_ENV` in at build time. The published
  build always read `"production"`, whatever the process was started with; a server reads it from its process now.

## Static files compressed, and compressed once

- **Fixed: static files went out uncompressed.** Every body sent as a `Buffer` skips compression (the rule that
  keeps fonts and images intact), and static files were read as Buffers — so the SDK bundle, its vendor and its
  stylesheet travelled whole: 2.7 MB, 1 MB and 220 KB on a first visit. Text files (scripts, stylesheets, JSON, SVG,
  plain text) are compressed now; images and fonts still go out as the bytes on disk.
- Each is compressed once per version of the file and kept, within 16 MB, least recently served first out — and read
  from disk only when an encoding it has not been compressed to yet is asked for. `res.send` takes a function for such a
  body: `send(() => read(), { compressed })` reads it only when the stored form is missing.
- **Two Brotli qualities.** `compression.brotliQuality` (default 2, was 4) is for a body compressed on every request;
  `compression.keptBrotliQuality` (default 6) for one compressed once and kept — a cached page, a static file. Measured
  on a quarter core: 4 cost a tenth of the pages a second to save half a kilobyte each; 6 makes the SDK bundle 10%
  smaller than 4 for the same memory, where 9 needs ~40 MB more than a 128 MB server has.
- The space embedded in a rendered page is serialized once per space object instead of on every render — a tenth of a
  render's CPU spent producing the same string.
- `sdk-shared`: the dev-tools console no longer keeps logs on a server, where nobody could ever receive them and they
  held other visitors' state; and stamps a log by hand instead of through date-fns. A page renders ~25% faster on a
  quarter core with both.
- Examples: the servers take `HOST` (still loopback by default) and derive `devMode` from `NODE_ENV` — a copy of an
  example run in production no longer runs in development mode.
- `bench/` (private): load and footprint benchmarks of the self-hosted servers under hardware profiles, with
  baselines — `yarn bench`, see its README.


## Self-hosted servers run compiled, without a transpiler

- **`plitzi create` (server mode) runs on Node alone.** `start` is `node src/main.ts` — Node 22.18+ strips the types
  itself — and `tsx` is gone: its loader thread cost a page server more memory than the server, ~270 MB to start where
  the same server starts in ~90. For production, `build` (`tsc -p tsconfig.build.json`) emits `dist/` and `start:prod`
  runs `node dist/main.js`: stripping types keeps a TypeScript transformer in the process for its whole life (~10 MB),
  compiled JavaScript does not. The project's `tsconfig` holds the code to what stripping needs
  (`allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), `engines` says `>=22.18`, relative
  imports name their `.ts` file, the plugin path resolves from the project root (the same from `src/` and `dist/`),
  and the server listens on `HOST` (loopback by default).
- The examples run the same way: `node src/main.ts`, `node --watch-path=./src` while editing, no `tsx`.
- `@plitzi/nexus` 1.3.1, now required (`^1.3.1`) by every package that uses it: `useStore` runs one set of hooks for a
  single path and a list of paths, instead of both side by side with the idle one disabled (a page allocates about a
  quarter less to render); `useStoreGetter` reads a function entry from the latest render instead of an earlier
  closure with the same source; and the path caches no longer evict every path of a page of a few hundred elements
  just before reading it again.
- `bench/`: `cli-server` measures a project as `plitzi create` writes it, built and run with `start:prod`; portals are
  mounted into the container and recorded in every result; `edge-96` and `edge-64` probe the floor.
- `sdk-elements`: an element that binds nothing no longer resolves bindings on every render, and one whose attributes
  hold no template no longer builds template data and copies its attributes to interpolate none — the work every
  element of a page did on each render, for nothing, however few of them bind or template.
- `bench/`: the memory probe is compiled to JavaScript before a run (loaded as TypeScript, it put Node's type stripper
  into every server measured, ~10 MB counted as the server's); `--repeat N` starts a target cold N times and keeps
  each phase's median run, since on Apple silicon a container runs on a fast or a slow core for its whole life.


## A page server on every core

- **`workers`: one process per core.** Node renders on one thread, so a server used one core however many the
  machine had. `workers: 'auto' | <n> | false` (and `SDK_SERVER_WORKERS`) runs the server in that many processes on
  one port; `'auto'` is the default under `NODE_ENV=production`, one process anywhere else. The count follows the
  cores the process may use — a container's CPU quota included — and a number above them is lowered, with a warning.
  One process (workers off, one asked for, one core) is the server exactly as before: nothing forked, nothing wrapped.
- **The workers are one server.** The in-memory defaults — an action's `kv`, the job queue, draft previews, the
  sign-in rate limit — are kept once, by the process that was started, and every worker reaches the same copy over
  the cluster channel; a store the deployment supplies is used as it is. The scheduler and the job consumers run in
  one worker. `server.cache.invalidate()`, `server.plugins.register()` and `server.plugins.invalidate()` reach every
  worker. Plugins are built once, before the workers start, and their files are written atomically (a temporary file
  renamed over the target), so no process reads a half-written one.
- **A worker that dies is replaced**, and takes its jobs with it to the replacement. Past one death per worker a minute
  the replacements wait longer each time (half a second, doubling, up to thirty), so a crash on every request is not a
  fork loop; a replacement that cannot start is retried while the others keep serving. A worker that dies before any
  has served stops the server with a non-zero exit, and a server killed outright takes its workers with it.
- **Fixed: `server.cache.invalidate({ spaceId | environment | hostname })` matched nothing.** It read the page cache's
  key by positions it no longer had once the key gained the visitor's token, theme and dev-tools choice in front; a
  publish webhook that invalidated a space cleared no page. The key is now read by the same list that writes it.
- `PluginManager.forget(name?, version?)` drops what a process remembers of a plugin and leaves the files: what an
  invalidation in another worker does.

## Fewer silent failures, less friction for an agent

- **New lint warnings**, each with the fix in its message, held by `authorSpace`, the builder's problems list, the
  publish gate and the MCP server alike:
  - `server-data-without-rsc`: a `runtime: 'server'` provider with a `connector` or `action` in a space that does not
    turn server data on — it rendered its mock data and nothing said why. Add `rsc: { enabled: true }`.
  - `route-param-undeclared`: `navigation.routeParams.x` read on a page whose slug has no `:x` — always empty. Prose
    elements that only mention one are not read.
  - `form-control-unnamed` / `form-control-name-taken`: a control in a form with no `name` never reached the form's
    values, and two with one name wrote over each other.
  - `overlay-never-opened`: a modal or dialog that starts hidden and that no step opens.
- **A `webHook` that writes with an empty body sends `{}`**, not the JSON text `""` a JSON endpoint refuses with a 400.
- `fixSpace(space, catalogs, codes, elements)`: `elements` narrows the fixes to some elements. It now clones only the
  elements it changes, and with nothing to fix answers the schema it was handed.
- **MCP `plitzi_apply` / `plitzi_validate`:**
  - What was already wrong with an element a batch changes is fixed on the way, where it has one reading, and every
    fix is said in `warnings`. The fixes run on the space before the batch, so the batch's own mistakes are still
    refused.
  - An old issue is told from a new one by its code on its element, not only by its message, so a page rename or a
    changed suggestion no longer makes an old issue on an untouched element look new and block the batch. One more
    of an issue than before is still the batch's.
  - The space as it was is read only when the result has something to classify: ~15% less time a batch on the
    largest spaces.
