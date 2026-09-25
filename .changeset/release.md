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
- The base stylesheet has no invalid declarations: `markdown` fills its box (`height`/`width: 100%` were quoted
  strings the browser dropped), and `text` no longer declares a size it never applied — it still inherits its own.

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
- **New lint error `list-items-ignored`** (fixable): a `list` with items (bound or written) and a `source` other than
  `'controlled'` rendered its children once and never read them — one empty row where the rows should be. `fixSpace`
  sets `source: 'controlled'`. It found the Feature Lab seed's catalogue rendering one blank card.
- **The page server logs a plugin it has nothing for**: a `custom` element whose `renderType` has neither a component
  in the render nor a bundle for the browser is reported at `error`, once per space and type, naming the element and
  `plugins` + the deployment's `pluginNames`. It used to render "Custom Component … Not Found" and say nothing.
- **A `webHook` that writes with an empty body sends `{}`**, not the JSON text `""` a JSON endpoint refuses with a 400.
- **`webHook` takes `headers`** (by name; a template per value): an API key, an `Accept`, an idempotency key.
  `Authorization` stays `authorizationToken`'s and the content type follows the body, so neither can be named twice.
  Headers are part of what a cached read is keyed by.
- **Fixed: a `webHook` sending a file could not be read by any server.** It set `multipart/form-data` by hand, without
  the boundary the parts are split by; `fetch` writes the type itself now.
- `sdk-authoring`: **`setFieldValue(target, name, value)`**, the step that fills one field of a form — clearing a code
  field after a failed attempt, prefilling one from a binding.
- **Fixed: a step parameter like `"012345"` reached the step as the number `12345`.** A value is read as a number only
  when it reads back as the same text; a code, a postcode or an id with leading zeros stays text.
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

## A server-rendered page carries its stylesheet once, and its data as JSON

- **The compiled stylesheet no longer travels twice.** The runtime `<style>` a page renders already holds
  `style.cache`, verbatim, and the hydration payload carried it again. The server now leaves it out
  (`styleCacheInDocument: true` in the payload) whenever the page gives it back byte for byte — no `{{ token }}`, no
  `<`, no `\r` or `\0` — and `render()` reads it back from that `<style>` before hydrating, so the browser draws the
  same stylesheet and the store holds the same cache. The cache sits between two CSS comments in the stylesheet it was
  always in: the element, its place in the tree and the cascade are unchanged. `plitzi.com`'s home: 2.82 → 2.53 MB,
  350 → 313 KB with per-request Brotli.
- **The payload is a `<script type="application/json">` block**, parsed with `JSON.parse` and removed once read,
  instead of a JavaScript literal inside the bootstrap module. On a first load of that page Chromium parses it in
  6.7 ms instead of 15.4 ms; the page no longer holds the space twice.
- `sdk-shared/style`: `markStyleCache`, `styleCacheTravelsInDocument`, `styleCacheFromDocument`, `RUNTIME_STYLE_ID`.

## The account console, and telling devices apart

- **`auth.plitzi.*/account` is an account console**, no longer a column beside the sign-in's brand pane: identity along
  the top, sections down the side (tabs on a phone) — **Profile** (username, and email changed through a link to the
  new address), **Security** (password, and closing the account), **Devices**, **Connections**.
- **Devices are listed by device, not by session.** `GET /devices/sessions` groups sessions by what they were created
  from and answers this device apart; a browser that signed in forty times is one row saying "40 sessions". The list
  had shipped and drawn every session — 1,218 for one account a test suite signs in as — inside a box that scrolled.
- **Every device is named for what it is**: the application as it registered over OAuth (`Plitzi CLI on carlos-mbp`,
  `Plitzi Desktop on studio`), a browser and its system, an automated client (Playwright, headless Chrome) — never a
  raw user agent. Sessions record their address and **when they were last used** (at most every five minutes, on the
  lookup a request already makes). A sign-in deletes the account's dead sessions.
- **AI connectors are one per application**: Claude and ChatGPT granted the same space are two connectors, each named
  and disconnected on its own (`GET /devices/connectors`).
- `sdk-server`: **`issueToken(user, target, context)`** — the OAuth layer tells a deployment which application a
  credential is for (`client_name`, `software_id` kept from registration), the request it is issued on, and on a
  renewal the credential it **replaces**, so a native client renewing daily stays one session. **`revokeToken`**, new
  and optional: `/revoke` now ends what the grant issued, not only its renewal — signing the CLI or the desktop app out
  removes it from the device list at once. Sessions carry `app` and `lastActiveAt` (`SessionApp`,
  `SESSION_ACTIVITY_RESOLUTION_SECONDS`, `activityDue`); the MySQL store migrates to schema step 4. The session's
  address is recorded (Express `req.ip`, or the proxies' headers); `SSRRequest.ip`.
- `sdk-server`: **`deletionBlockers(userId)`** — an account is refused deletion (409, with the list) while it owns
  something that would be lost with it. `plitzi-sdk-server` refuses while it is the only owner of a workspace holding
  spaces, other members or a live plan; an empty personal workspace is deleted with the account.
- **Fixed: a flow's `navigate` to a page in a folder went to the wrong address** — `/security` for `/account/security`,
  and the home page for a folder's index page. It resolves the page's full path now, as a link does
  (`navigationTarget` in `sdk-shared/navigation`).
- **Fixed: changing your email sent a mail with no body** (the `email-change` template did not exist) and a link to no
  page. It has both now (`/confirm-email` in the auth space).
- **Fixed: account emails interpolated values unescaped** — a username with markup in it arrived as markup in a mail
  sent from Plitzi.
- The visual suite signs every test's session out when it ends; it had left over a thousand on one account a day.

## Two-step sign-in

- **An account can turn on a second step** (an authenticator app, TOTP) from Security in the account console: a QR
  code drawn by the server, the key to type by hand, one code to confirm it works, and ten recovery codes shown once.
  Turning it off asks for the password. `GET /account/mfa/setup` answers the QR of an enrolment in progress, never of
  one already confirmed, and is never cached. The secret is encrypted at rest (`user_mfa`) and recovery codes are kept
  as digests, each good once.
- **Signing in then asks for the code** on its own page (`/two-factor` in the auth space), which takes a recovery code
  as well. `sdk-auth`: a login answered with `mfaRequired` is a **`MfaChallenge`** (`{ ok: false, reason: 'mfa',
  mfaToken }`), not a session — the provider read it as one and ended signed out. The space names where the code is
  sent with **`mfaUrl`**; the `auth.login` step's mode **`'mfa'`** sends `{ mfaToken, code }` there.
- **Fixed: an AI connector ended from the account console came back.** Ending it — one connector, "sign out everywhere
  else", or the space's own credentials — deleted its row, and the host's next renewal put the row back. A renewal of
  a connector that has been ended now ends too (`invalid_grant`).
- **Fixed: a new account made by signing in with GitHub or Google could not use its session.** It was created active
  but not verified — the column's default — and an unverified account holds no session, so every request after the
  sign-up answered 401. The provider verified the address, so the account is created verified; a migration verifies
  the accounts already created that way. The credential exchange made accounts the same way and is fixed with it.
- **Fixed: a code could sign in twice.** A TOTP code is valid for its whole window, and nothing remembered that one had
  been used: seen over a shoulder or lifted by a phishing page, it opened a second session within that window. The
  step of the last code accepted is kept (`MfaRecord.lastUsedStep`; `totpStep(secret, code)` in `sdk-server/auth`
  says which step a code matched) and nothing up to it is taken again — the code that confirms the enrolment
  included (RFC 6238 §5.2). The MySQL store migrates to schema step 5 (`account_mfa.last_used_step`).
- **Fixed: an account with a second factor was locked out by signing in often.** A right password answered with a
  challenge was not reported as a success, so the sign-in limit counted it as a failure (ten in five minutes).
- `sdk-server`: a numeric field in an `/auth` body is read as its text (a code typed into a number field was dropped
  as missing).
- **Fixed: signing out of the auth space could loop between two pages** (over a thousand navigations in six seconds):
  for a moment the session published to the page was still the one the provider had just ended. Once the provider says
  nobody is signed in, the page is told nobody is (`publishedSession`).
- Builder: the space's provider settings take **`mfaUrl`** and **`sessionExchangeUrl`**; both could only be set from
  code.

## Requests from other sites

- **Fixed: any website could act as a signed-in person against the api and server roles.** CORS answered every origin
  with `Access-Control-Allow-Credentials`, and the session cookie is `SameSite=None`: a page the person visited could
  read their account and write to it. Credentialed CORS is now for `PLATFORM_ORIGINS` only; every other origin is
  still answered, without the person's cookies. A published site calling its own space is unaffected — it presents
  its space credential, and a customer domain's sign-in exchange is served by its own page server, same-origin.
- **A write carried by a session cookie from another site is refused** (403, `reason: 'foreign'`), judged by Fetch
  Metadata and the exact `Origin`: CORS keeps another site from reading, but a plain form POST needs no preflight.
  Platform origins pass, and so do the origins the request's space credential declares. Bearer requests carry no
  victim's cookie and are never asked. `sdk-server`: **`createOriginGuardMiddleware(csrf, { allowedFor, exempt,
  errorKey })`** and `csrf.crossSite(carrier, alsoAllowed?)`; `plitzi-sdk-server` runs it on both roles and refuses
  to start with CSRF switched off.
- **Analytics beacons are sent as text** (`text/plain`), which the collector reads as JSON. A beacon always goes with
  credentials, and a JSON one is preflighted: from a customer's domain it would have been refused with the rule above.
  As text it needs no preflight. **Fixed:** the `fetch` fallback (a batch over the beacon's size) arrived empty — in
  `no-cors` the browser sends text whatever the header says, and the collector did not read it.
- **Fixed: the CSRF middleware answered 500 on Node 24.** It built its carrier by spreading the request, and `headers`
  there is a getter on the prototype that a spread does not copy. The carrier is built field by field (`carrierOf`).

## Plugins from the CLI

- **`plitzi add plugin [names...]`** adds elements of your own to the project you are in — one, several at once, or one
  at a time as the need comes. It asks what to call each, what the builder shows and what it is for, checks every folder
  is free before writing any, and writes a folder per element the way `@plitzi/sdk-elements` writes its own:
  the component, `declaration.ts` (its `type`, the `triggers` it fires, the `callbacks` it answers to and the element
  the builder adds — data only), `Settings.tsx` (its builder panel) and `index.ts`
  (`Object.assign(Component, declaration, { pluginSettings: Settings })`). Each kind of project is answered as itself:
  - a project `plitzi create` wrote gets it in `src/plugins`, registered by itself (`start:dev` restarts onto it); when
    its space lives in Plitzi, it is told to place it in the builder;
  - a project from before plugins were found by folder is told the exact line its `src/main.ts` list needs;
  - a plugin package gets it in `src/` and in `src/elements.ts` / `src/declarations.ts` — rewritten only while they are
    still the lists the CLI wrote;
  - any other project is asked for the folder (`--dir`) and told how to register it for `render()`,
    `<PlitziSdk.Plugin>` and a page server.
  A name that would make a built-in element's type (`button`, `form`) is refused.
- **`plitzi create [directory] --plugin`** writes a plugin package: its elements, a Vite preview that renders them
  inside a space, and a visual test of each. A package holds as many elements as it needs (`--elements
  legend,price-tag`, or asked): the first is published as the plugin, the rest as its `plugins`. It builds nothing
  itself — no bundler config, no build dependency — since `plitzi pack plugin` is the one place a plugin is built.
  It ships its source (a page server compiles an element from it) and exports `elements` for a project registering
  them itself. `--name`, `--title`, `--description` and `--owner` answer what it otherwise asks; inside a repository it
  offers the folders that repository keeps its packages in, installs with its package manager and leaves its install
  settings alone. It replaces the `plitzi-plugin-template` repository, which is deprecated.
- **`plitzi pack plugin [folders...]`** builds a plugin — a package's elements, or element folders of any project, a
  self-hosted one included: one ES module (esbuild; React and the SDK kept out for the page to provide, images and
  fonts kept in, since a page imports it from a blob URL), `plugin-manifest.json` written from the elements'
  declarations with each file's integrity hash, and the zip the builder takes under Resources — checked against how
  the upload and the builder read it. A package also gets its type declarations, written with its own TypeScript. A
  declaration missing what the manifest needs is refused by name.
- **`plitzi login`, `logout`, `whoami`, `space` and `upload plugin`.** The CLI signs in the way the desktop app does:
  in the browser, through the platform's native OAuth (loopback redirect, PKCE), keeping the session and a refresh
  token in `~/.config/plitzi/connection.json` (0600), renewed on its own and revoked on `logout`. It is connected to
  **one space at a time**, chosen on the grant screen (`plitzi space`, the `space` scope) — choosing again replaces the
  connection and revokes the one before, and no command takes a space of its own. `upload plugin` puts the zip
  `pack plugin` left on one of that space's CDNs and installs it, signing in or choosing the space in the browser
  first when either is missing. Every builder open on the space loads the new version on the spot.
- `sdk-server`: `grantTargets(user, { scope })` — the grant screen offers what the scope a client asked with chooses
  among — and the token response carries the chosen `target` (RFC 6749 §5.1), on renewal too, so a native client knows
  what it was granted.
- `plitzi-sdk-server`: the native sign-in offers the person's spaces to a client asking with the `space` scope, and
  re-checks access to the chosen one whenever it issues a session — a refresh after losing access ends the grant.
  `GET /spaces/:id/cdns` lists a space's CDNs (never their credentials) and `POST /spaces/:id/cdns/:identifier/plugins`
  takes a plugin's zip, uploads it the way the builder does (one `uploadResource` now serves both) and installs it on
  `main`, keeping the settings of a plugin already there; the change is recorded in the space's history as the person's.
- **Plugins change live in every builder open on the space.** Adding, updating or removing one — from a builder, or
  from `plitzi upload plugin` with none open — is announced on the space's one channel (Redis pub/sub and the GraphQL
  subscription every other edit travels on), as `SPACE_ADD_PLUGIN`, `SPACE_UPDATE_PLUGIN` and `SPACE_REMOVE_PLUGIN`.
  The other builders load, swap or drop it, its sub-plugins and its stylesheet included; the builder that made the
  change does not apply it twice.
- **Fixed: a plugin's settings could not be saved.** `SpaceUpdatePlugin` required the plugin's address and wrote the
  settings empty every time. Both are optional now and what is not sent is kept; settings that are not an object, or
  a plugin the space does not have, are refused.
- **Fixed: a plugin uploaded from Windows was refused** ("Type file not supported"). Chrome and Edge on Windows send a
  zip as `application/x-zip-compressed`, and both the builder and the upload accepted only `application/zip`.
- **A project `plitzi create` writes registers every folder of `src/plugins` by itself**, under its name in camelCase
  — `readdirSync` in server mode, `import.meta.glob` in client mode — so a new element needs no line of `src/main.ts`.
- **A new project is formatted by its own Prettier** once installed, so the first commit is already in its style. Only
  into a folder that was empty: `--force` never reformats work that was there.
- `sdk-shared` / `plitzi-sdk`: **`PluginDeclaration`**, the declaration type of an element of somebody's own — what
  `ElementDeclarationData` says of any element, plus the `content` a manifest publishes. Exported as a type from
  `@plitzi/plitzi-sdk`.
- **Fixed: a plugin on its own host rendered "Not Found".** `fetchManifest` sent `Content-Type` on a GET, which made the
  browser ask the host's permission first; a host that allows plain cross-origin reads — the usual CORS setting of a
  bucket — refused, and the element never loaded. It asks with `Accept` now, and answers nothing for a 404 rather than
  for a body that failed to parse.
- `sdk-authoring`: `blankSpaceSource({ plugin: { as: 'element' } })` hosts a plugin as an element of its own type — how
  the builder adds one and how a space loading it from its manifest renders it, and takes a list to host several.
  Strings in the copy are quoted the way
  Prettier quotes them (`"Today's"`, not `'Today\'s'`), and a name with a backslash no longer breaks the file.
- e2e: `plugin-server` generates a package with the CLI, builds it, publishes it on a host of its own and checks a page
  loads it from its manifest.

## Export as code: spaces from an older builder

- `sdk-authoring`: **`specFromSpace` reads a document an older builder keyed by ObjectId.** Before an element's id was
  its name, `flat` was keyed by a Mongo ObjectId and the name lived in `idRef`; reading one kept the ObjectId, and
  `authorSpace` refused it ("not one a binding, a template or a test can name"), so the builder's Export failed on
  every such space. Each element takes its `idRef` back as its id — a positional `<type>-<n>` where it has none and
  its key is not a valid id — with every reference repointed, and the rename is reported as `legacy-element-id`.
  `withNamedIds` is exported so a caller comparing what it read compares it under the same names.
- `sdk-authoring`: a space with no pages is refused up front with a reason a person can act on, instead of the
  authoring error about writing one.
- Builder: Export sends the space's plugin types, so an element a plugin provides is no longer reported as unknown.

## Outbound requests stay outside the cluster

- `sdk-server`: the `http.request` task and the connector engine refuse private destinations however they are written.
  An address is judged by range, so private IPv4 written as IPv6 (`[::ffff:127.0.0.1]`, `[::]`) is refused, and so
  are the multicast, CGNAT and reserved ranges. NAT64 and 6to4 addresses are judged by the IPv4 address they carry,
  so an IPv6-only cluster still reaches public IPv4 APIs. A DNS name is no longer refused just because it starts like
  an IPv6 prefix (`fcbarcelona.com`).
- Redirects are followed one hop at a time, and each destination is checked before anything is sent to it. A public
  URL that redirects into the cluster is refused. A redirect that leaves the origin drops `Authorization` and `Cookie`.

## The grant screen says who is asking

- `sdk-server`: the OAuth grant screen names the client and the host the grant is sent back to ("an app on this
  computer" for a loopback client). Anybody can register a client under any name, so the host is the part a person
  can check. `OAuthConsentView` carries it as `client: { name, redirectHost, loopback }`.
- New `OAuthConfig.loopbackRedirectsOnly`: only `http://127.0.0.1` / `localhost` redirects are accepted, when a client
  registers and again at `/authorize`. Turn it on when every client is a native app, above all with `directTokens`,
  where the grant is the person's session.

## Draft previews: a secret, and one space

- `sdk-mcp`: the `/__preview` endpoint refuses every request when preview is enabled without a `secret`, and compares
  the secret in constant time. It lives on the page server the public reaches, so "no secret" used to mean "no check".
  **A deployment with preview on must set `preview.secret`**, and every caller must send it as `x-preview-secret`.
- `sdk-server`: a draft is only rendered for the space it was made from. `DraftPutOptions` and `DraftEntry` carry
  `spaceId`, and a token presented under another space's host is ignored. A custom `DraftStore` has to keep it.

## One outbound rule, everywhere

- `sdk-server`: `@plitzi/sdk-server/kernel` exports `isBlockedHost` and `assertOutboundAllowed`, the rule the
  `http.request` task and the connector engine follow.
- `sdk-mcp`: the widget proxy judges addresses with that rule instead of its own copy, which let IPv4 written as IPv6
  (`[::ffff:127.0.0.1]`) through.
- `sdk-server`: a space's external plugin manifest is fetched through the same rule, redirects included.

## A signed-in visitor is rendered signed in, the day after too

- `sdk-server`: a page asked for once the access cookie has expired but renewal is still possible (the session hint
  says so) is sent to renew first and comes back signed in, so the server renders the visitor the browser will end up
  with. The HTML used to be the guest page, swapped for the signed-in one after boot, and a guest-only page was shown
  and then redirected away from instead of answered with a 302.
- New `createServer({ sessionRenewal: { url } | false })`. On by default with `auth` (its own `/refresh`); without it,
  name the endpoint — an absolute URL when another host serves `/auth`.
- The endpoint is `GET <basePath>/refresh?redirect=<page>`, served by `createServer({ auth })` and now also by
  `mountAuthRoutes` (34 routes). It renews with the refresh cookie, writes the new session or ends a dead one, and
  always sends the browser back — to a path, or to a host sharing the session's cookie domain (`/` otherwise).
- Only whole-tab navigations (`Sec-Fetch-Dest: document`) take part, on both halves: a renewal rotates the session,
  and an `<img>` or a frame on another site must not be able to. Anything else on `GET /refresh` is a 405. A short
  `<cookie>_renewing` cookie keeps a renewal that failed without ending the session from sending the visitor round
  again.
- New in `@plitzi/sdk-server/auth`: `parseSessionHint`, `readSessionHint`, `sessionReturnTarget`,
  `isDocumentNavigation`, `renewForNavigation`.

## Scheduled jobs: a store hiccup is not an incident

- `sdk-server`: a schedule sweep, reconcile, job claim or heartbeat that fails is reported by how long it has been
  failing. The first failure is a one-line warning with its reason (it runs again by itself, and every pass is safe
  to repeat); a pass still failing a minute later is the error, with the cause; the pass that ends such a streak says
  so. A Mongo driver resetting its pool while the host was busy used to print an error with a stack on every pass it
  caught. A deployment's own `onError` still receives every failure.
- Tests that ran slow under a busy machine: the CLI's type-declarations test (a real compile) has a timeout of its own,
  and the workers test waits for every worker to listen rather than a fixed number of requests.
