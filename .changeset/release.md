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
  on a change to the server's code reached the open page only when somebody reloaded it.
- **A saved plugin is swapped into the open page** (`devReload`, server mode): the page server rebuilds the plugin
  whose source changed and the page renders the new component in place, keeping its state — no restart, no reload. A
  change to its declaration (what the builder and the linter know of it) still reloads the page. `render()` takes
  `{ hotPlugins: true }` and answers `{ unmount, replacePlugin }`; `PluginManager.rebuild(name)` and `onSources`. A new
  folder in `src/plugins` is registered without a restart (`server.plugins.register`), from `create` and `create --from` alike.
- **A plugin brings its own server half.** `functions/index.ts` beside the component — the `defineFunctions` a
  space's functions use — answers routes under `/fn/plugins/<type>/` and runs steps named `<type>.<action>` (origin
  `'plugin'`, the builder's **Plugins** group). It runs with a narrower `ctx`: its own `kv` (prefixed
  `plugin:<type>:`, its `rateLimit` and `sign` too), none of the space's credentials, no realtime publishing or grants;
  its routes and tasks outside its namespace are refused, as are a space's routes under `/fn/plugins/`. The component
  reaches its routes with `usePluginRoute(type)` (`@plitzi/plitzi-sdk`; `undefined` where no server runs code).
  A page server takes them as `functions.plugins` (`{ [type]: FunctionsDefinition }`), swaps one with
  `server.functions.setPlugin`, and asks a cloud adapter with `actionLookups.getPluginFunctions(spaceId, version)`.
  `plitzi pack plugin` carries the source in the zip as `functions.source.json` (`PLUGIN_FUNCTIONS_SOURCE`, named by
  the manifest's `functions`; `loadFunctionsSource` builds it) — kept privately by the platform, never published.
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
  `src/data/`, `src/functions/`, the actions' lookups) is left out of `serverOptions`' type and comes after it, so no option unwires it.
  `upgrade` writes either file into a project that has none — only when the `main.ts` reading it is the CLI's — and
  never replaces it; `create --from` projects read `serverOptions.ts` too.
- **`upgrade packages` brings up the scripts the CLI wrote and nobody changed** (`.plitzi/scaffold.json` now records
  them); a script the project changed is left and said, as before.
- `start:dev` restarts on a change to the server's code — `serverOptions.ts`, `actions.ts` and `src/functions/` (whose
  `README.md` the project now starts with); a plugin is swapped in the open page instead, and its `functions/` set
  again, without a restart. A function imports its siblings with `.ts`, as `src/`.
- `add plugin --server` writes the plugin's server half (`functions/index.ts`, a `GET`/`POST /state` example on its
  `kv`); a package gets `@plitzi/sdk-server` as a devDependency for its types. Refused in a client-mode project.
- `add plugin`: `--prop rows:list` and `--prop meta:json` for data a binding fills; `--headless` writes
  `drawsNothing: true`; the generated events hook never fires on the builder's canvas.
- A `channel` with no tag is boxless to a page check, like a provider; an empty list is said to have no rows, with what
  to do, instead of "no size (0×0)".
- **A server-mode project keeps its `kv` in `state/kv.json`** (`createFileKv`; ignored by git): what the space's actions
  save outlives a restart, `start:dev`'s included. `action.kv` in `src/serverOptions.ts` names another store.
- A server-mode project types what its plugins import besides code (`src/plugins/assets.d.ts`): a stylesheet, an image,
  `?raw`, `?inline` — a client-mode one has them from `vite/client`.
- **A project made from a space runs the server `create` writes.** `create --from` and `pull` write the same
  `src/main.ts` as `create` (one template), with what the space brought besides — its runtime, its built-only plugins, a
  note on its visitors: it now takes a free port and writes `tmp/dev-server.json` (which `check`, `shot` and the visual
  tests read), answers `/health`, and re-authors its pages on save instead of waiting for a restart. Its actions are
  `src/actions/` and its connectors `src/connectors/`, both there from the start, and `start:dev` restarts on them;
  `src/actions.ts` exports `actions` and `connectors`, as a `create` project's exports `actions` (`push` reads that).
  `upgrade` leaves `src/main.ts` and `.prettierignore` of such a project to `pull` and says so — before, it showed them
  as the project's own, and `--take all` would have put `create`'s server in place of the space's.
- **A `--source cloud` server project starts.** Its key is in `.env`, which nothing read: `npm start` stopped on "Set
  PLITZI_HOST_KEY". Every server project's `src/main.ts` now reads `.env` itself (`process.loadEnvFile`), and every
  one is given a signing key there (`PLITZI_SIGNING_SECRET`, made for it by `create`) — `ctx.sign` refused in a project
  `create` wrote, a plugin's server half included. `PORT` is no longer written into `.env`, where it pinned 8080. A
  cloud project keeps its `kv` in `state/kv.json` too.
- **`upgrade` keeps the package manager a project was written for** (`.plitzi/scaffold.json`) when it has no lockfile
  of its own yet: a yarn or pnpm project not installed (`--no-install`), or sitting in a monorepo folder, was taken for
  npm and its `AGENTS.md`, Playwright config and `.gitignore` replaced with npm's commands.
- `author`, `check`, `fix` and `push` know the element types of a project's built-only plugins
  (`vendor/plugins/*/plugin-manifest.json`, every element each provides), as its server does.
- **`import` reaches Plitzi only when told to.** A site not served from this machine needs `--account` — ask the
  person's Plitzi account whether one of their spaces verified its domain, signing in — and without it is refused,
  saying so, before any request: an agent running `import` in a local project opened a sign-in nobody asked for. The
  CLI skill and the generated `AGENTS.md` say to run `import` only when the user asks, and to ask before `--account`.
- **A server project's data is no longer on the internet.** It was `public/data/*.json`, served to anyone as a file;
  it is `src/data/*.json`, which the server reads and never serves (`dataDir`, new in `createServer`): a provider with
  `runtime: 'server'` and `query: '/data/<file>'` reads it, and the page arrives with it. `projectData`
  (`@plitzi/sdk-authoring/node`) and `authorSpace`'s `serverData` hold bindings to those files, and a provider asking
  for `/data/…` from the browser is refused (`server-data-in-browser`): nothing would answer it. What a provider reads
  is still in the page it renders — data a page must not carry is a server action's to read. A client-mode project
  keeps `public/data/`, which the browser has to fetch. The catalog template follows the mode
  (`catalogTemplateFiles({ mode })`). `public/` holds only what is meant for everyone.
- **The project's own server code is `src/functions/`**, with the rest of its source — typechecked with it, left out of
  `tsconfig.build.json` (the server builds it at boot). `functions pull`/`push`/`dev`, `push`, `pull` and `create
  --from` follow. The `kv` folder is `state/` (it was `data/`, beside a data folder that was something else).
- **`--dry-run`** on every command that writes or sends — `create`, `add plugin`, `pull`, `push`, `pack plugin`,
  `source`, `import`, `upload plugin`, `functions pull`/`push`, `runtime push`/`start`/`stop`/`size`/`vars`, `skills
  update`: each file it would write (`+` new, `~` replaced, `-` removed), what it would install or run, what it would
  send and where, and none of it done. It still reads what it needs to say so.
- **A new project is formatted from the start**, every template and mode: its first `format` changes nothing. The CLI's
  own files are in its `.prettierignore`, so formatting never turns one into a file `upgrade` believes was changed.

## Packages

- **Every package declares what it imports, and nothing more.** `react` is a peer of `sdk-auth`, `sdk-event-bridge`,
  `sdk-interactions`, `sdk-style` and `sdk-variables`; `sdk-schema` depends on `immer`, `sdk-elements` on
  `@dr.pogodin/react-helmet`, `sdk-plugins` on `@plitzi/plitzi-ui`, `sdk-style` on `@plitzi/sdk-event-bridge` and
  `sdk-dev-tools` on `@plitzi/sdk-plugins` — each worked only because `@plitzi/plitzi-sdk` brought them, and failed
  installed alone or under a strict linker. `prop-types` and the `@plitzi/*` dependencies nothing imported are gone, so
  `sdk-mcp` no longer installs the element library its code says it does not depend on.
