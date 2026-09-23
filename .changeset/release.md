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
