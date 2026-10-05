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

## Server data: one request per question, the newest winning, and a way to stop

- **A link asks for its page's server data once.** The navigation's prefetch already brought it; the route change that
  followed asked again — two renders per click. `useRscSync` now asks only for a location the store does not hold.
- **Answers land in the order they were asked.** `refreshRsc` joins a refresh already in flight for the same URL and
  aborts one a newer refresh would overwrite (a whole payload asked again, an element asked again); a whole payload
  keeps what an element asked for after it. A slow answer no longer paints a page the visitor has left.
- **Stopping.** `cancelRsc(store, ids)`, an `apiContainer`'s `cancelQuery` callback (`cancelApi(id)` in authoring) and
  `queryCache.cancel(key)` for a browser provider: the request is dropped and what is shown stays. The server hears it:
  `SSRRscContext.signal` aborts when the browser hangs up, and the default `getRscData` stops every element still
  resolving — a shared render run only once nobody is waiting on it.
- **Pending.** A server provider's `isLoading` is true while it is asked again (`rsc.refreshing`). The `navigation`
  source says `pending` and `pendingLocation` while a link waits for its destination's data; a second link clicked
  before the first went supersedes it, and the first never goes.
- **A bound `input` asks again.** An `apiContainer`'s `input` is a prop now: bound to state, every change refetches a
  server provider. What a refresh asks for (`req.ctx.rscParams`) wins over the `input` the element was saved with.
- **A section cut by its budget says how to give it more** (`rsc.elementTimeoutMs`).

## Flows

- **`whileRunning('latest')`**: a new firing stops the run in progress — no further step; its `runServerAction` is
  cancelled (request and server run) and its `webHook` aborted — and runs. A search as you type. The step's context
  carries the `signal`. Offered in the builder and the MCP.
- `onApiSuccess` / `onApiError` fire once per answer: a cancelled request or a loading flag that came and went no
  longer runs the flow again.
- **A debounce is `whileRunning('latest')` and a `delay` first**: `delayTime` ends its wait the moment its run is
  superseded, so only the last firing gets past it. Its `time` is a number.

## Server actions

- **The request budget is never silent.** A task that caught the refused fetch hid `maxRequests`; the step that ran
  into it now logs it, and the server logs it once, naming `createServer({ action: { limits: { maxRequests } } })`.
- **`invalid_input` says what the value was and which type takes it** — `windows (text, got a list; declare the field
  \`json\` to take it)`. The templates reference documents that a param that is only `|json_encode` is the value it
  encodes.
- **`kv` survives a restart with no database.** `createFileKv({ file })` (`@plitzi/sdk-server/actions`) keeps the
  in-process store in one JSON file, written whole as soon as anything changes — for one process.
  `createSqliteKv({ file } | { db })` (`@plitzi/sdk-server/sqlite`, new entry) is a table in a SQLite file over
  `node:sqlite`, every operation one statement, shared safely by every process on the file. Both pass the adapter
  contract every store is held to. The `09-schedules` example uses it rather than its own copy, whose counters read
  `22.0`.

## Authoring

- **`action-output-path`** (warned): `.data` read on a provider fed by a server action, which publishes its output at
  the root. **`actionSource(id, sample)`** types such a provider by a sample of its output.
- A value template (`returns: 'value'`, a computed, a step param) may name its parts with `{% set %}` before its one
  expression, and is still that expression's value.
- `abs()`, `floor()`, `ceil()`, `clamp()` are refused with how they are written here (`x|abs`,
  `x|round(0, 'floor')`, `min(max(x, low), high)`).
- An unknown attribute is reported against the element's props, not as "'id' does not exist in type ElementSpec[]".
- `explain` answers a builder's name (`reloadApi`, `cancelApi`) with its step, and knows `whileRunning`.
- `container` and `text` take a `title`. A trigger's `preview` may hold numbers, flags, lists and `null`.
- `answerAction(page, actionId, output)` (testing): a test that would save something answers that server action in
  the browser — the server's `kv`, and what the developer kept, are never written. A stream step gets its `done` frame.

## Plugins

- **A plugin's stylesheet sits below the space's.** The cascade order is now `… utilities, plitzi-sdk-plugin,
  plitzi-sdk-runtime`, and whatever builds a plugin writes its CSS into `plitzi-sdk-plugin` (`inPluginLayer` from
  `@plitzi/sdk-shared/style`): `plitzi pack plugin`, a server compiling one (`action: 'compile'`), and the stylesheet a
  server copies or downloads for one. A space's classes and `customCss` now win over what the plugin's author shipped,
  whatever the specificity — as they do over a built-in element. A plugin packed before this ships unlayered and still
  wins until it is packed again.
- **Declared param types reach the callback.** A param declared `number` (new, a text box in the builder) or `boolean`
  is handed over as one — written `5000`, or bound to text that says it; an empty number as nothing, so the component's
  default applies.
- **`useElementVisible(id)`** (`@plitzi/plitzi-sdk`): whether another element is on the page — its own `visible`, every
  container around it, the breakpoint — kept current while the plugin is mounted, at that plugin's cost alone.
- **A page open on a development server loads again when the server restarts** (`devReload`): `start:dev` restarting
  on a change to the server's code or a plugin reached the open page only when somebody reloaded it.
- **A plugin lays out the space's elements it holds.** `elementChildren(children)` (`@plitzi/plitzi-sdk`) hands
  over each child element with the id it was authored under, for a dock, tabs or a masonry to place in boxes of its
  own — instead of writing styles onto elements it does not render.
- **`useDisplayMode()`** (`@plitzi/plitzi-sdk`): `desktop`, `tablet` or `mobile`, at the widths the space's styles are
  compiled at — not a breakpoint of the plugin's own.
- **A file a library needs whole travels inside the bundle**, imported as Vite imports it: `worker.js?raw` (its text — a
  worker from a Blob), `engine.wasm?inline` (a base64 data URI). `plitzi pack` and a server compiling a plugin share
  one build (`@plitzi/sdk-shared/plugins/bundle`), so a server now inlines `.avif`, `.ttf` and `.otf` as `pack` did.

## CLI and page checks

- **`check`, `shot` and the generated visual tests settle instead of waiting for `networkidle`**, which never came on a
  page with a realtime channel: `openPage` (`@plitzi/sdk-authoring`) waits for load, then quiet, counting no stream
  that stays open.
- **The server is the project's in `src/serverOptions.ts`; `src/main.ts` stays the CLI's.** `create` writes
  `src/serverOptions.ts` (handed to `createServer`, typed from `ServerConfig`, now exported by
  `@plitzi/sdk-server`) and, with `--source local`, `src/actions.ts` (the space's server actions), which `main.ts` wires
  for calls, renders and schedules. What `main.ts` wires itself (the space's adapters, the plugins, `public/`,
  `functions/`, the actions' lookups) is left out of `serverOptions`' type and comes after it, so no option unwires it.
  `upgrade` writes either file into a project that has none — only when the `main.ts` reading it is the CLI's — and
  never replaces it; `create --from` projects read `serverOptions.ts` too.
- **`upgrade packages` brings up the scripts the CLI wrote and nobody changed** (`.plitzi/scaffold.json` now records
  them); a script the project changed is left and said, as before.
- `start:dev` restarts on a change to the server's code — `serverOptions.ts`, `actions.ts`, the plugins and
  `functions/` (whose `README.md` the project now starts with). A function imports its siblings with `.ts`, as `src/`.
- `add plugin`: `--prop rows:list` and `--prop meta:json` for data a binding fills; `--headless` writes
  `drawsNothing: true`; the generated events hook never fires on the builder's canvas.
- A `channel` with no tag is boxless to a page check, like a provider; an empty list is said to have no rows, with what
  to do, instead of "no size (0×0)".
- **A server-mode project keeps its `kv` in `data/kv.json`** (`createFileKv`; ignored by git): what the space's actions
  save outlives a restart, `start:dev`'s included. `action.kv` in `src/serverOptions.ts` names another store.
- A server-mode project types what its plugins import besides code (`src/plugins/assets.d.ts`): a stylesheet, an image,
  `?raw`, `?inline` — a client-mode one has them from `vite/client`.
- **A new project is formatted from the start**, every template and mode: its first `format` changes nothing. The CLI's
  own files are in its `.prettierignore`, so formatting never turns one into a file `upgrade` believes was changed.

## Packages

- **Every package declares what it imports, and nothing more.** `react` is a peer of `sdk-auth`, `sdk-event-bridge`,
  `sdk-interactions`, `sdk-style` and `sdk-variables`; `sdk-schema` depends on `immer`, `sdk-elements` on
  `@dr.pogodin/react-helmet`, `sdk-plugins` on `@plitzi/plitzi-ui`, `sdk-style` on `@plitzi/sdk-event-bridge` and
  `sdk-dev-tools` on `@plitzi/sdk-plugins` — each worked only because `@plitzi/plitzi-sdk` brought them, and failed
  installed alone or under a strict linker. `prop-types` and the `@plitzi/*` dependencies nothing imported are gone, so
  `sdk-mcp` no longer installs the element library its code says it does not depend on.
