---
'@plitzi/sdk-server': patch
'@plitzi/sdk-style': patch
'@plitzi/plitzi-builder': patch
'@plitzi/sdk-variables': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-authoring': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
---

- **`server.cache.invalidate` drops what a page is rendered from** (`@plitzi/sdk-server`): the pages, the RSC answers
  and the schema data they are rendered from go together. It dropped the pages alone, and the next request rendered
  the same page again from the schema still cached under the same key — a publish that invalidated the space changed
  nothing until the schema's TTL ran out. `clear()` and `size` cover the three. A filter on `hostname` drops the schema
  data too, which belongs to no one host. `server.cache` is `null` only when nothing is cached (`cacheTtlMs: 0` and
  `rsc.cacheTtlMs: 0`).

## Style inspector

- **Finds a property** (`@plitzi/sdk-style`): a search above the categories narrows them to the ones that edit what was
  typed — a CSS name in any order of its words (`border radius` finds the four corners), a category's title, or a
  common word for it (`bg`, `rounded`) — opens them, and shows the advanced rows when the match lives there. Escape
  clears it. The categories' properties live in one list (`categoryKeys.ts`) that the dots, the advanced hint and the
  search all read.
- **Rows that fit**: a section with more than two controls puts its label above them and lays them out in as many
  columns as the panel is wide, instead of one row where every label was cut (`Appearan…`, `Cell Spaci…`, the five
  scroll-snap controls). A row's label column is 80px.
- **Where a value comes from, said quietly**: the label's tint keeps its four meanings — set here, from a token, bound
  to data, inherited — without the solid blocks of colour; hovering says which (an inherited one names its selector and
  breakpoint) and that a click resets it, the click shows it by striking the label through. The footer's info icon
  holds the legend, and its arrow folds every category.
- **What is being edited**: an "Editing … › Hover" line under the pickers whenever the rules being written are not the
  selector's plain ones, with a button back to them. Ancestor, pseudo-element and condition fold behind a toggle —
  never while one is in use.
- The class being edited is the panel's one strong mark (violet), the element's type defaults a softer one; the tools'
  tabs fit the panel and are reachable from the keyboard.

- **Lists edited in a popover, all alike**: box and text shadows, transforms, transitions and filters share one row
  (the CSS it writes, a swatch, a remove button) and one popover (a title, a close button, Escape, the focus moved
  into it). What none of them could read is now kept and edited as text instead of being replaced with a default — a
  token for the whole value, `drop-shadow(…)`, `url(#…)`.
- **Values read the way CSS writes them**: a shadow with two, three or four lengths and its color on either end;
  `rgba(…)` inside text shadows and filters no longer split; negative shadow offsets accepted; a transition with any
  of its parts left out; brightness, contrast and saturation past 1. Transition presets are written as CSS — the
  preset names (`easeInQuad`) made the browser drop the whole declaration — the curve can be dragged into one of your
  own, and the preview stops with the editor. `font-color` (not CSS) became `color`.
- **Background layers keep what they hold**: a repeating gradient (now a switch), a radial gradient's explicit size, a
  token or `image-set()` as a layer (a "Custom (CSS)" layer), a one-value position read as CSS reads it (`20%` is
  `20% center`), lists shorter than the layers repeated as CSS repeats them, an unset repeat read as tiling, two-position
  stops, negative angles — every one of them was rewritten on the next edit of any layer. Defaults are no longer
  written back, and "Token values" no longer bakes resolved tokens into the layers.
- **A layer's editor in two halves** — what it draws, then where it goes (size, position, tile, attachment, clip,
  which now offers `text`). The gradient's stops sit on one bar, each a handle that drags or moves with the arrow keys;
  the stop's color and position below it. Previews and swatches resolve the space's tokens.
- Spacing tells margin (dashed, outside) from padding; Border's sides are labelled and readable in the dark theme; a
  class's menu says what each action does to whom; the Style Manager opens at a size that holds both columns.

## Builder

- **Shortcuts**: `?` shows every shortcut the builder answers to — the same list the "Nothing selected" card teaches
  from — and ⌘\ / Ctrl+\ hides both side panels for the canvas alone and brings back the ones that were open. Both
  work with the canvas focused.
- **Panels keep their width**: each side panel opens at the width it was left at; the right one starts at 380px.
- **Text no smaller than 11px** across the builder's panels (it went down to 10px in fifty places).

## Realtime

- **A page hears what it sent when it asks to** (`@plitzi/sdk-shared`, `@plitzi/sdk-server`, `@plitzi/sdk-elements`):
  `publishOn('room', 'react', data, { echo: true })`, `useChannel().publish(type, data, { echo: true })` and the
  channel's `publish` callback (`echo`) hand the message back to the page that sent it too, once the server took it —
  stamped like everyone's, with `echo: true`, its `from` the channel's `me`. Without it a page still never hears its
  own messages, and the docs said "every page on its topic hears it": they now say every OTHER page. Presence never
  echoes.
- **A topic is opened only once it names one** (`@plitzi/sdk-elements`): `useChannel` — and so the `channel` element —
  opens a topic only when a channel of the space covers it, by the same `matchChannel` the server decides by. A topic
  written from data that has not arrived (`room:` while its provider loads, or its template still as text) asked the
  server for both, was refused with a 403 and a console error on every load, and is now waited for.
- **Pages that watch** (`@plitzi/sdk-server`, `@plitzi/cli`): a connection whose page carries the `plitzi-observer`
  cookie hears its topics and says nothing on them — no `$join`, no presence, its publishes taken and dropped.
  `page check`, `page shot` and `verify` load pages that way, so checking a live site is no longer a visitor walking
  into a room (`X walked in`, a member more in every picture). `--presence` takes part as a visitor does.

## Authoring

- **`template-in-value`** (refused): a `{{ }}` inside an attribute that is an object or a list — a provider's
  `input`, a list's `items`, a plugin's settings — is never evaluated: only an attribute that is text is interpolated,
  and the page server reads attributes as saved. A provider's `input` also replaced the route param of the same name
  the action was already given, so `input: { room: '{{ navigation.routeParams.room }}' }` reached the task as `""` and
  the page answered 404; its refusal says the action is handed the page's route and query params already. Anything
  else is a binding on the attribute. `mockData`, a sample, is not held to it.
- **Rules on top of a class need no `id`** (`class: [card, { gap: '6px' }]`): they are named after the id the element
  is given, written or not. `modifier-without-id` is gone; a one-off tweak no longer needs a name nothing reads.
- **Typed list rows have `inTemplate`**, as untyped ones do, and `bindTemplate`, `visibleWhen`, `hiddenWhen` and
  `variantFrom` take a typed source's path as well as a name: turning a list typed broke every template of its rows.
- **`when({ field, operator: 'empty' })`** takes no `value` (nor `notEmpty`), as flows.md recommends; it did not
  type-check.
- **Data-driven colours**: a style binding on a custom property (`{ to: '--who', category: 'style' }`) is written as
  named — it was camel-cased into `who` — so a class reads `var(--who, var(--muted))`. A style binding's value carrying
  `;` or braces is not written: the page server writes inline styles as text, and such a value added declarations of
  its own. `binding-target-unknown` on `style` or a CSS property says to bind it in the `style` category.
- `unknown-attribute` for `decorative` on an `svg` or a `fontAwesome` says what it means: without a `label` it is
  already hidden from screen readers.

- **A folder nobody declared says where to declare it**: `folder-undeclared` (a page, a layout, a folder's parent)
  ends with `pageFolders: [{ id, name }]` on the space, and with the line of the `pageFamily` that wrote the page. A
  folder starts its pages' addresses (`/docs/quickstart`), so a misspelt one is never declared on the author's behalf.
  The skill's `pageFamily` example declares its folder.
- **A tag is an element**: a `subType` this element has not but another has — `container({ subType: 'ol' })` — names
  that element (`list({ subType: 'ol' })`) instead of the value two letters away (`dl`). Read off the elements'
  declarations, for every element and tag.
- **A `pageFamily`'s body is written once**: `repeated-shape` and `repeated-on-pages` no longer count the same part of
  each page of one family as copies — they were offering a component for exactly what the docs recommend. Copies within
  one page, or across pages written one by one, are still offered.
- **Colour emoji are not text to `page check`**: a character painted in its own colours (🎲, `❤️`, a keycap, a ZWJ
  sequence) is left out of the contrast measure, which compared `color` with the tile behind it and failed `verify`
  in the theme whose text colour was close to the tile. A symbol drawn as text (✓, ★) is still measured.

## CLI

- **`page shot --click` (and `--clip`, `--wait-for`, `--scroll-to`, `--steps`) takes any selector**: a value that is
  not an element's name (letters, digits, `-`, `_`) is a selector, CSS or Playwright's own (`button:has-text("Orbit")`).
  It was wrapped as a name, and an invalid selector ended the command with Playwright's stack trace; it is now refused
  with the reason.

## Server

- **`server.listen()` resolves once the port answers** (`@plitzi/sdk-server`) — in a fleet, once the first worker
  does. `serveProject` writes `tmp/dev-server.json` and says `pages on …` after it, not on the line after `listen`:
  for about 0.4 s a tool trusting the line (CI, Playwright's `webServer`, `page check`) was refused. A port it cannot
  take still ends the process, or goes to `onListenError`, and the promise is then never resolved.
- **Runs set for later** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`, `@plitzi/sdk-authoring`, `@plitzi/plitzi-builder`):
  a turn that runs out, a bot's move, a hold that lapses — one run starting one of the space's actions in N seconds,
  whether or not a page is still open. The action says it may be with a **`later` trigger** (no access rule: the run
  that set it was let in); a flow sets it with `flow.later { action, in, input, key }`, a function with
  `ctx.later({ … })`, and `flow.cancelLater` / `ctx.cancelLater(key)` drops it. A `key` names it: set again under the
  same key, the one still waiting is replaced — the newer of two set at once, on every replica — and a running one is
  left. It is a job of the queue schedules use: due by the store's clock (0 s to 30 days, about a second late at most),
  once across replicas, retried, shown in Automations → Queue. Refused before anything is queued, with why: no `later`
  trigger, one switched off, a time out of range, a key that is not one, a server with no jobs. A plugin's functions
  set none. `ActionJobQueue` gains `cancelPending({ spaceId, key, olderThan? })` and jobs a `key`: the memory, Mongo
  and MySQL queues implement it, and the shared contract tests it. **MySQL**: `action_jobs` gains `job_key` (and the
  `action_jobs_key` index), added on first use; with `createTables: false`, run that statement of
  `mysqlJobSchemaUpgrades()`. A queue of a deployment's own implements `cancelPending` (`09-schedules` shows one).

