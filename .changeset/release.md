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

## A server project's `src/main.ts` is a few lines

- **`serveProject` from `@plitzi/sdk-server/project`**: the generated `src/main.ts` hands the space, its actions and
  its options to the server, and the rest comes with the package — the port, the plugins of `src/plugins` and
  `vendor/plugins`, the functions and runtime, `public/`, `src/data/`, the `kv` in `state/kv.json`, `/health`,
  `tmp/dev-server.json` and the reloads while developing. A fix there arrives with `npm update`, not `plitzi upgrade`.
- **No more `tmp/space.json` while developing**: a saved space is authored again in its own process and handed to the
  server over IPC (`plitzi/author.ts --ipc`, in place of `--out`); the server swaps it in memory and the open pages
  reload, and a refused space keeps the last one that authored. `plitzi doctor` reports a leftover `tmp/space.json`.
- **`projectAuthoring()` in `@plitzi/sdk-authoring/node`**: what a project's space is checked against — its plugins'
  declarations, its built plugins, its data files — once, for the server and `npm run author` alike. Neither it nor
  `serveProject` takes a root: it is the working directory, where every script runs (`projectAuthoringAt(root)` for a
  tool working on another folder).
- **`.env` lives at the root and Node reads it** as each script starts (`--env-file-if-exists=.env`; `start:dev`
  preloads `@plitzi/sdk-server/env`, since a watched process would restart on every change beside the file). Settings
  read at the top level of `src/config/serverOptions.ts` or the actions are set. Every project gets `.env` and
  `.env.example`; `plitzi upgrade` removes the old `src/env.ts`.
- **One check of a project's layout** (`@plitzi/sdk-shared/project/layout`): a plugin folder with no entry, a
  JavaScript entry, `src/plugin/` for `src/plugins/`, a `.env` inside `src/`, a space exported by default, a broken
  `vendor/` plugin… The server refuses to boot listing every error with its fix, `npm run author` and the CLI's checks
  refuse with the same words, `plitzi doctor` lists them under `layout` and `--fix` makes the ones with a single fix,
  and `plitzi lint` points at doctor. A plugin folder added broken while developing is reported in the terminal
  instead of failing in esbuild. Plugins may start at `index.tsx`.
- **`createJsonAdapters` serves documents held in memory**: `offlineData` may be a function returning them, not only a
  path.
- **One source for a project's layout**, `@plitzi/sdk-shared/project/paths`; `src/config/serverOptions.ts` is typed
  `ProjectServerOptions`. `plitzi upgrade files --write` brings an existing project's `main.ts` and `author.ts` up.
- **`npm run build` no longer fails on a plugin's stylesheet**: `tsconfig.build.json` includes `plitzi/assets.d.ts`,
  which a space importing a plugin's declaration reaches through its component.

## A write refreshes what shows it

- **Writes now refresh server-driven providers.** `runServerAction`, `webHook`, `writeRecord` and the
  `invalidateQueries` step reach `runtime: 'server'` api containers by id, by `query` URL, or all of them, just as
  they reach cached browser requests. Before, they reached only the browser's query cache, so a saved write left the
  page showing the old value until a reload. Hidden providers refresh when they are shown.
- **A refresh because something changed asks around every cache.** `performQuery`, writes and invalidations send
  `Cache-Control: no-cache`; `/_rsc` resolves such a request again instead of serving its cached slice, and keeps the
  new answer. A `refreshSeconds` timer and a "load more" page still go through the caches.
- **`refreshRsc`'s fourth argument is an options object**, `{ location?, fresh? }`.

## A space's functions read its data

- **`ctx.data('products.json')`** reads one file of the space's data (a project's `src/data/`), parsed and read-only,
  as of the run's version. Plugins' functions are refused it.
- **Self-hosted servers read `dataDir` through the same lookup as the platform**, so `/data/<file>` providers and
  `ctx.data` read the same files; `plitzi functions dev` reads `src/data`. `/data/../x.json` is now the provider's
  error state instead of falling through to `publicDir`.
- **Importing a file outside `functions/` names the boundary and the fix**: read the space's data with
  `ctx.data('<file>')`.

## Signing in on a self-hosted server

- **`createServer({ auth })` tells the pages it renders where to sign in** (`server.auth`: provider, endpoints and
  the session hint cookie), so a space signs in with no auth settings declared. Settings a space does declare still
  win, and a space that names another provider ignores the server's description. New `pageAuth` server option, for a
  deployment whose `/auth` flows are served by another host.
- **A page with no auth provider no longer offers `auth.login` / `auth.logout`**, and a sign-in that cannot work says
  why in the console (`[plitzi] auth.login: …`) instead of failing silently.
- **Renewal verifies the refresh token itself.** `findByRefreshToken` no longer has to report `refreshExpiresAt`; when
  it does, it overrides the token's own expiry.
- **New authoring reference `auth.md`**: providers, `authLogin` and its result, `authLogout`, `{{ auth.* }}`,
  `accessLevel`, visitor roles, action `access` and `ctx.user`.

## Flows

- **Authoring refuses a `when` that asks a step for a key it never publishes** (`condition-field-unpublished`).
  `whenSucceeded` / `whenFailed` after `authLogin` always ran the failure branch: they read a server action's
  `status`. The message names what the step publishes and suggests testing `signedIn.ok` with `when`.
- **`explain` lists what a step publishes** (`Reads:`) and finds the auth steps by their builders (`authLogin`,
  `authLogout`, `authRefreshDetails`). `authLogin({ username, password })` no longer needs `mode`.

## Elements

- **Images no longer default to a 140×140 square**: they are 140px wide and as tall as their ratio, so `width` or
  `aspect-ratio` on a class just works. `object-fit` shows in the builder too.
- **`formControl` with `subType: 'switch'` renders an on/off switch** (`role="switch"`) — it rendered only its label.
  Checkboxes and switches show a `true` default or binding as ticked.
- **The theme toggle drops the native button look**, and the **`current` style state covers the chosen item of any
  set**: the link to the page shown, a pressed toggle, a selected tab. The exported `CURRENT_PAGE_SELECTOR` is now
  `CURRENT_SELECTOR`.
- **Element defaults in the style inspector and the MCP catalogue match what the SDK renders**, held by a test. The
  dialog's `bodyContainer` and `headerCloseButton` slots now reach the page; pagination lays out as declared.
- **Markdown takes a class for each part of the document** through its own slot (`heading`, `paragraph`, `link`,
  `list`, `listItem`, `quote`, `code`, `codeBlock`, `image`, `table`, `anchor`), and `headingLinks: false` drops the
  link each heading offers to itself while keeping its id, so `/page#anchor` links still work. Its description spells
  out the HTML it outputs. Needs `@plitzi/plitzi-ui` 1.6.32.
- **Tabs show every trigger.** The SDK hid every inactive tab item, the header's included, so a set of tabs showed
  one tab and no way to the others; only the body's panels take turns now.
- **A link that names a query is current only on that query**: of `/?window=6h` and `/?window=24h`, the one shown
  carries `aria-current` — with the path alone, every one of them did. A link with no query is still current on its
  page whatever the query.

## The style language says what `customCss` used to

- **Pseudo-elements on a class**: `pseudos: { after: { css: { content: '"→"' }, states: { hover: { … } } } }` —
  `before`, `after`, `marker`, `placeholder`, `first-letter`, `first-line`, `selection`, each in the class's states and
  variants. Authoring refuses what draws nothing: a `before`/`after` with no `content`, a `content` without its quotes,
  a property the browser drops on that pseudo-element.
- **Conditions on a class**: `conditions: { 'motion-reduce': { … }, 'container card (max-width: 30rem)': { … } }` —
  reduced or allowed motion, and container widths, each with its states and pseudo-elements.
- **The space's `keyframes`**, validated and written at the top of `customCss`; an `animation-name` no keyframes declare
  is warned (`animation-name-unknown`).
- **New states**: `expanded` (`aria-expanded`), `first`, `last`, `odd`, `even`; the tab panel on show is `current`, and
  the theme toggle's icon of the scheme in use is `current` on its `icon` slot.
- **`ancestors['>']`** is the parent, whatever it wears — a closed component's part reacting to the element around it.
- The builder's style inspector, the MCP's definition ops (`pseudos`, `conditions`, and variants with their states) and
  the export to code read and write all of it; an MCP `patchDefinition` no longer drops what it did not name. Rules in
  `customCss` a class can hold now — `.link::after`, one under `@media (prefers-reduced-motion: reduce)`, `.row:first-child`,
  `.row:nth-child(even)`, `.toggle[aria-expanded='true']` — are folded into the class on export and suggested by
  `custom-css-class`.

## Elements take a class for each part

- **`formControl`**: `field` (the `<input>` itself), `icon` (the show-password button) and `requiredMark` slots; a switch's
  knob reads in dark mode and takes `--plitzi-switch-thumb`, `--plitzi-switch-thumb-checked`, `--plitzi-switch-thumb-shadow`.
- **`pagination`**: `previous`, `page` (the one shown is its `current` state), `next`, `loadMore`.
- **`richText`** and **`markdown`**: a slot per part — `heading` and `heading1`…`heading6`, `strong`, `emphasis`,
  `divider`, `tableHead`, `tableRow`, `tableHeaderCell`, `tableCell`, and the code block's frame, header, language and
  copy button. The GitHub stylesheet plitzi-ui shipped for markdown is gone: the builder renders a document as the page
  does. Needs `@plitzi/plitzi-ui` after 1.6.32.
- `custom-css-slot` suggests the slot for a `customCss` rule on a part's SDK class — only where a class on the slot can
  say the rest of the selector (a state, a pseudo-element); `element-slot-unknown` warns of a slot an element does not
  have.

## Links, refreshes and toasts

- **`current: 'section'` on a link** keeps it current on its page and every page under its path (`aria-current="true"`
  there), styled by the `current` state — no `activeOn` binding for a section.
- **A refresh asks only about elements the page shown holds**: a provider on the page being left no longer sends a
  `/_rsc` about the new address.
- **The toasts' parts are `notifications` fields**: `minHeight`, `fontWeight`, `lineHeight`, `iconSize`, `iconGap`,
  `closeColor`, `closeOpacity`, `progressHeight`.

## check and lint

- **`plitzi check`, `push`, `lint` and `fix` hold the space to what `npm run author` and the server do**: its data
  files too, so `push` no longer sends a space whose browser provider reads `src/data/` (`server-data-in-browser`).
- **`plitzi check` lists each list's rows as drawn and as held in its source** (`feed 4 of 8 rows`,
  `hits not rendered (16 in its source)`). In `--json`, `lists` is now `{ id: { rendered, source } }`.
- **`plitzi check` no longer reports bindings inside a container the page isn't showing**, nor text "in the colour
  behind it" because of a bar painted over it or a pane that clips it.
- **`window.__plitzi.sources()` no longer turns a shared array into `'[…]'`**, and a list row no longer replaces its
  list's `items`.
- **`plitzi lint` says authoring suggestions are quieted with `quiet` on the element**, and reports a
  `plitzi-lint-disable` comment that names one (`disable-names-suggestion`).
- **`plitzi check` says when a page sent the browser elsewhere** (a page for signed-in visitors, to the sign-in) instead
  of reporting every element missing, and `--as <username>` signs in first through the server's `/auth` routes, the
  password from `PLITZI_CHECK_PASSWORD`.
- **`plitzi upgrade` never replaces @plitzi packages installed locally** — a tarball, a link, a portal, an override: it
  leaves them and the install, and says which and the command that would install the registry's.
- **`plitzi explain` covers every code**: authoring's, `plitzi lint`'s and the project layout's.
- **Authoring reads the global sources' fields**: `auth.authenticated` in a condition is refused with "did you mean
  `isAuthenticated`?" (`global-field-unknown`), and `invalidateElements` must name providers that exist
  (`element-ids-target`). A template's reads of `computed`, `flags` and the global sources come off the parsed
  template: a string inside it (`'https://auth.acme.com'`) is no longer read as `auth.acme`.
- **`custom-css-notifications` no longer reads the rules `notifications` itself writes** as toasts dressed by hand.
- **A refused space or layout is a report, not a stack**: the server's entry point imports the space once the layout is
  checked, and `npm start` and `npm run author` print every problem and exit with 1.
- **New authoring suggestion `class-overrides-class`**: one class's shorthand (`padding`) silently erases a longhand
  (`padding-top`) another class on the same element writes out.
