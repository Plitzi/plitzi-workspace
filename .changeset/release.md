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
- **`projectAuthoring(root)` in `@plitzi/sdk-authoring/node`**: what a project's space is checked against — its
  plugins' declarations, its built plugins, its data files — once, for the server and `npm run author` alike.
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
- **Server projects load `.env` from a CLI-owned `src/env.ts`** that `src/main.ts` imports first, so settings read at
  the top level of `src/config/serverOptions.ts` or the actions are set. `plitzi upgrade --write` adds it.
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
- **New authoring suggestion `class-overrides-class`**: one class's shorthand (`padding`) silently erases a longhand
  (`padding-top`) another class on the same element writes out.
