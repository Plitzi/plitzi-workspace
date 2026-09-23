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
