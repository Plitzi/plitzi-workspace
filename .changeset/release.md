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

## Server actions

- **The request budget is never silent.** A task that caught the refused fetch hid `maxRequests`; the step that ran
  into it now logs it, and the server logs it once, naming `createServer({ action: { limits: { maxRequests } } })`.
- **`invalid_input` says what the value was and which type takes it** — `windows (text, got a list; declare the field
  \`json\` to take it)`. The templates reference documents that a param that is only `|json_encode` is the value it
  encodes.

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

## CLI and page checks

- **`check`, `shot` and the generated visual tests settle instead of waiting for `networkidle`**, which never came on a
  page with a realtime channel: `openPage` (`@plitzi/sdk-authoring`) waits for load, then quiet, counting no stream
  that stays open.
- **The server is the project's in `src/serverOptions.ts`; `src/main.ts` stays the CLI's.** `create` writes
  `src/serverOptions.ts` (handed to `createServer`, typed `Partial<ServerConfig>` — now exported by
  `@plitzi/sdk-server`) and, with `--source local`, `src/actions.ts` (the space's server actions), which `main.ts` wires
  for calls, renders and schedules. `upgrade` writes either one into a project that has none, and never replaces it.
- `start:dev` restarts on a change to the server's code — `serverOptions.ts`, `actions.ts`, the plugins and
  `functions/` (whose `README.md` the project now starts with). A function imports its siblings with `.ts`, as `src/`.
- `add plugin`: `--prop rows:list` and `--prop meta:json` for data a binding fills; `--headless` writes
  `drawsNothing: true`; the generated events hook never fires on the builder's canvas.
- A `channel` with no tag is boxless to a page check, like a provider; an empty list is said to have no rows, with what
  to do, instead of "no size (0×0)".
