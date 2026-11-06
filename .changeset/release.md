---
'@plitzi/cli': patch
---

Pages served faster and kept in step across replicas: the render cache keeps pages compressed and bounded by bytes,
renders a page once however many ask for it, serves it while it is rendered again, and — given a bus and a store —
shares pages and invalidations between every replica of a deployment. A component instance no longer copies the whole
space while it hydrates.

## To do when you upgrade

- **Several replicas of a page server** give it `cache: { bus, store }` — `createRedisPubSub` for the bus,
  `createRedisPageStore` for the store — or each serves what a write made untrue until its copy expires; the server
  says at boot which it has. A process that writes spaces without serving them says the invalidation with
  `createCacheInvalidator({ bus, store })`.
- **A custom template** (`templateFn`) or code reading the page's runtime `<style>` for the space's rules: they are in
  the linked `/_plitzi/style/<hash>.css` now (`style.cacheHref`).
- **`templatePaths`** answers a `readonly string[]` and **`pageElementTypes`** a `ReadonlySet`: they are shared now;
  copy one before changing it.
- **`X-Cache`** answers `STALE` too: a page served past its TTL while it is rendered again.
- **A `runtime: 'server'` provider with `credentials: 'include'`** is no longer refused by authoring: it is asked with
  the visitor's cookies where the server names that API (`rsc.visitorCredentials`), and is the provider's error, naming
  the setting, anywhere else. `ServerQuery`'s `url` kind carries `asVisitor`.
- **`ServerTemplateData`** carries `paintedKeys` and `state`, and `serverQueryProblem` takes the painted keys: a resolver
  that builds one passes both (`requestPaintedState`).
- **`usePlitzi().settings`** no longer carries `isHydrating` nor `theme`: read `useRenderSettings().isHydrating` and
  `useTheme().resolvedTheme`. Every element reads that context, so a value that changed there drew every element again.
- **The plugins' stylesheets** are in a context of their own: `use(PluginAssetsContext).assets`, not
  `use(PluginsContext).assets`.
- **A page's Google families** are asked of the page server's own origin (`/_plitzi/fonts/google/…`): a proxy or CDN in
  front of it passes that path through as it does `/_plitzi/style/`. `fonts: { google: false }` links Google itself.
  `fontsToHead` takes the mirror's address as a third argument, and `googleCss2Url` a base.
- **A link's analytics parameters** (`utm_*`, `fbclid`, `gclid`…) are no longer seen by a published page's server
  render, and a page is kept without them; the browser still reads them. `cache.ignoredQueryParams: []` keeps the old
  behaviour.

- **A MySQL job queue** made before this release needs two columns:
  `ALTER TABLE action_jobs ADD holder_memory_mb INT NULL, ADD needs_memory_mb INT NULL, ADD near_memory_limit
  TINYINT(1) NOT NULL DEFAULT 0` (with its `tablePrefix`); the tables made from now on have them. A store of its own
  implementing `JobQueue` keeps the new `claim` and `heartbeat` rules (`memory`, `nearMemoryLimit`, below) and answers
  `needingMemory` from `summarize`.

- **`@plitzi/sdk-kernel`** is new: what every server process is built on. `@plitzi/sdk-server/kernel` is gone, and
  the page server no longer re-exports it — import from the kernel's entries: `closeOnSignals`, `unusedPort`,
  `parseRequest`, `createHttpServer`, `makeHandler`, the stages' types and health from `@plitzi/sdk-kernel/http`;
  `serverLog` and `consoleLogger` from `./log`; `createTokens` and `generateTokenKeys` from `./tokens`; the session
  cookies, CSRF, `createIdentity`, the RBAC checks and the scopes from `./identity`; `esbuildBuild` from `./build`;
  `assertOutboundAllowed` from `./outbound`. `@plitzi/sdk-server/auth` keeps signing in (`createAuth`, the flows).
- **`@plitzi/sdk-runtime`** is new: the contract a space's own code is written against, and what runs it. A space's
  functions import `defineFunctions`, `ActionRefusal` and the `ctx` types from `@plitzi/sdk-runtime`, and a runtime
  `defineRuntime` — the build refuses `@plitzi/sdk-server/functions`, naming the new one, and `plitzi upgrade` rewrites
  a project's imports and adds the package. The runner and its isolates are `@plitzi/sdk-runtime/runner`'s
  (`startFunctionsRunnerService`, `createIsolateRunner`), the runtime's host `./host`'s; `createLocalFunctions` is
  handed its runner (`{ runner: createIsolateRunner({ concurrency: 1 }) }`). A runner installs `isolated-vm` alone: the
  web APIs' prelude ships built, so core-js is no longer needed. `reachOwnServer` and `reachSpaceInside` are
  `@plitzi/sdk-kernel/outbound`'s; `endpointFor`, `endpointProblem` and `RUNTIME_DESCRIBE_PATH`
  `@plitzi/sdk-shared/functions`'.
- **`@plitzi/sdk-actions`** is new: the actions engine and its worker. `createServer` serves pages and refuses
  `action`, `functions`, `connectors` and `realtime`: one process serving both is `createPlatform`
  (`@plitzi/sdk-server/platform`), and a worker of its own `createWorker` (`@plitzi/sdk-actions/worker`), with
  `identity: auth.ssrIdentityAdapters`. `@plitzi/sdk-server`'s `./actions`, `./functions`, `./functions-runner`,
  `./runtime`, `./mysql`, `./mongo` and `./sqlite` are gone: the engine's are `@plitzi/sdk-actions` and its entries, the
  account store is `@plitzi/sdk-kernel/mysql`, and the pub/sub adapters `@plitzi/sdk-kernel/pubsub`. `plitzi upgrade`
  rewrites a project's imports and its server file (`movedExports`, `platformServer`).
- **A worker may serve the actions on an origin of its own.** `action.origin` (`https://actions.example.com`) tells the
  pages where to call, and `action.pageOrigins` tells the worker which pages do: it answers them with CORS and
  credentials, takes them as its own in the cross-site check, and refuses to start with the first and not the second.
  The page's action calls and a provider's writes now send the visitor's cookies (`credentials: 'include'`), which on
  the page's own origin is what they did; a provider's writes go where the server says (`actions.endpoint`) instead of
  a fixed `/_action`, so a custom `action.path` reaches them too. Example: `examples/self-hosting/11-actions-on-a-worker`.
- **A page server may run no action at all.** `engineOnWorker({ render: { url, secret } })` asks the worker for each
  server element that names an action or a connector (`POST /_render`, behind the worker's `render.secret`, versioned
  `RENDER_PROTOCOL` `1.0`): its data, or its error state, and the runs that fed it.
- **Every process says how it is doing.** `stats: { secret, pool }` on a page server, a worker or an MCP server answers
  `GET /_stats` behind that secret: its load against its slots, CPU, memory, event-loop lag, its runs' failures and
  refusals by reason over 1, 15 and 60 minutes, its last hour minute by minute (`series`: runs, failures, refusals,
  p95, and its load sampled every ten seconds), and `healthy` or `degraded` with why; a functions runner answers the
  same behind its protocol secret, and a space's runtime under the pool `runtime`. `readPools` (`@plitzi/sdk-kernel/stats`)
  reads every instance at once, a missing one `down` — or one its orchestrator says is (`unreachable`), without asking
  it. An instance has its whole life as a status: `starting`, `healthy`, `degraded`, `restarting`, `stopping`,
  `stopped`, `failed` and `down` — its orchestrator says the phase (`orchestrator.phase`: one stopping is never `down`
  while it drains), and a scaler may stop or restart one (`PoolScaler.stopInstance`, `restartInstance`). Each minute
  of `series` names its slowest runs and failures (`runsOf`) and the actions and functions that took the most of it
  (`names`): a run is recorded with what it was (`RunLabel`: space, kind, name). A scaler may hold what a pool's
  instances run with for a while (`PoolScaler.resources`: knobs, each instance restarting with them in turn), and the
  remote functions runner asks where to run with the space an invocation is for (`url(spaceId)`), so a deployment can
  give a space its own runners; a worker hands a space's requests to the worker that serves it (`createWorker`'s
  `forward`, once, streamed, a 502 when it does not answer), and takes only the jobs of the spaces it is given
  (`jobs.claims`, every queue's `claim({ spaces })`) — from a pool source (`createLocalPoolSource`, or a deployment's own). A run record carries `reason` when a
  ceiling ended it.
- **A deployment decides which spaces may have scheduled runs**: `jobs.admitSchedules(spaceId)` answers why not, or
  nothing. A refused space's schedules are taken out of the queue — none is swept, the reason said once — and come back
  when it answers nothing again. Absent, every space may, as before.
- **The badge leads where the deployment says.** `SSRMeterDecision.badge` (and `render.badge`) is `BadgeLinks` —
  `{ madeWith, report }` — instead of `true`: a site served by a test tier reports to that tier, not to plitzi.com. A
  metering adapter that answered `badge: true` answers the two addresses.
- **`@plitzi/sdk-server/spaces` and `@plitzi/sdk-server/cache`**: which space a request is for (`createSpaceAdapters`,
  the resolvers, `createMemoryCache`) and the pages replicas share (`createRedisPageStore`, `createCacheInvalidator`),
  apart from the renderer. A process that serves no pages — a worker — imports them rather than the package's root,
  and loads nothing of React or the SDK (measured: 36 MB less at rest). The helpers and adapters are a chunk of their
  own, never the renderer's.
- **Every job queue sums itself up** (`JobQueue.summarize({ spaces })` → `JobQueueSummary`): its jobs by status, what
  waits by what it is (kept calls, schedules, later, function jobs), the oldest wait and the spaces waiting most with
  what their last job said — in the in-process, file, SQLite, Mongo and MySQL queues alike. A queue of a deployment's
  own adds it. `KEPT_CALLS_PER_SPACE` and `KEPT_CALL_MS` are exported.
- **The functions runner and a space runtime report a version** (`startFunctionsRunnerService({ version })`,
  `startSpaceRuntime({ version })`), as page servers and workers do: a rolling deploy reads the same on every pool.
- **A call nothing can run is kept, not lost.** A runner that cannot be reached is tried again (0.5, 1, 2 s) and then
  said away for 15 s (`FunctionRunner.reachable`, reason `unreachable`); a call whose action runs the space's code is
  then kept in the job queue as its caller's (`ActionJobTarget.user`, `callerId`, `idempotencyKey`, `at`, `origin`,
  `ticket`) and answered `202 queued` — and a page that reaches no worker (network error, 502, 503) hands it to the page
  server, `POST /_plitzi/queued` (`createQueuedCallsStage`, mounted wherever the engine has a queue). The page waits,
  says so (`QueuedNotice`, the run `queued`) and reads it at `GET /_plitzi/queued/<job>` with its ticket. Jobs of the
  space's code wait the same way rather than start (`ActionsModule.codeAway`). `ActionRunRequest.user` and the
  precheck take a `RunUser`.
- **A runtime size says how many the space bought and its price.** `SpaceRuntimeSizeOption` gives `bought` (each runs
  one environment; `null` where it is not bounded) and `displayAmount` (euro cents a month) in place of `included`, and
  the builder's size picker says a size bought none of with its price.
- **CPU and memory are said as the clouds say them.** `@plitzi/sdk-shared/helpers` holds one scale of each —
  `VCPU_STEPS` (0.125 to 4 vCPU, in millicores) and `MEMORY_STEPS` (128 MiB to 8 GiB) — and their words: `vcpuWords`,
  `memoryWords`, `sizeWords` (`0.25 vCPU · 512 MiB`), and `millicoresOf`, `mibOf`, `quantityWords` to read Kubernetes'
  quantities (`250m`, `1Gi`). A pool's knob may be a size from a scale (`PoolKnob.options`) and says its value in words
  (`valueLabel`). The builder's runtime sizes read `Small — 0.25 vCPU · 256 MiB`.
- **Only what broke is a failure.** A run ends one of three ways when it does not simply answer (`RunEnd`, sdk-kernel):
  it failed, it was stopped at a limit — its deadline, its steps or requests, its code's CPU, time, memory, answer or
  platform calls, its account's CPU budget — or its code refused. `StatsRecorder.run(durationMs, end?, label?)` takes
  that end in place of a failure's name; `StatsWindow.limits`, `StatsMinute.limited`, `NamedWork.limited` and
  `SlowRun.limit`/`refused` count the two that are not faults apart, and an instance's error rate — what turns it
  `degraded` — counts failures alone: a space asking for more than its plan gives, or refusing its visitors, no longer
  degrades the runner or the worker that ran it. The engine names the limit where it is thrown
  (`ActionRunRecord.limit`, `ActionRunLimit`; `ActionRunError`'s third argument, `RunLimitReached`, `limitOf`).
- **A run's record says when its code refused** (`ActionRunRecord.refused`): the error it carries is then the answer
  the space wrote for whoever asked (`refuse(…)`), not a fault — what lets a history or a back-office tell a space
  answering on purpose from one that broke.
- **Every process keeps its last thousand log lines**, every level, whatever its console says, and answers them at
  `GET /_stats/logs?since&level&limit&q` behind the same secret (`readLogTail`; a deployment's own logger adds its
  lines with `keepLogLine`). So one instance's whole log is read from a back-office without a log shipper.
- **A deploy cuts nothing.** `shutdown: { announceMs, graceMs }` on a server, a worker and the functions runner: told
  to stop, it serves for `announceMs` with `/health` at 503 and `/_stats` saying `stopping`, then gives what it runs
  `graceMs` (10 s by default, which was fixed) to finish. A stopping runner answers new invocations `busy`, which the
  platform takes to another runner, and waits for those it runs — it used to cut them at once.
- **A console says what is worth reading.** A probe answered (`/_stats`, `/health`) and a run that worked are `debug`;
  a run of a second or more is a `warn`, marked `SLOW` with its steps (`slowRunMs` on the server's config raises it); a
  refused or failing probe is still said. A worker now holds what it says to its own `logLevel`, as a page server does.
- **`@plitzi/sdk-shared` no longer depends on plitzi-ui**, and React, React DOM and nexus are optional peers: a server,
  a worker or a runner installs neither, and a page server loads neither nexus, plitzi-ui nor zod at start. A package
  that draws or holds a store declares them itself. What moved, all rewritten by `plitzi upgrade` (`movedExports`):
  `sharedContext`, `EnclosingSpaceContext` and `generateFacade` (named now) to `@plitzi/sdk-shared/react`; a condition's
  types and `evaluateRuleGroup`, `ruleValuesOf` to `@plitzi/sdk-shared/conditions`, the rule evaluator the builder's
  preview, the SDK and the server all read (plitzi-ui keeps its own copy; the workspace's ESLint refuses it); the theme's provider, hooks and store to `./theme/react` and
  the network contexts to `./network/react`; `runtimeStatePersist` to `./store`; `TRUSTED_TYPES_POLICIES` to
  `./helpers`. `evaluateRuleGroup` takes `{ whenMissing }`, what a rule whose field is missing answers.
- **The server's types left `@plitzi/sdk-shared`**, each to the package that owns it: the request pipeline, the
  adapters, `ServerBaseConfig`, the log's events and OAuth's are `@plitzi/sdk-kernel/types`; the job queue and the
  engine's configuration (`EngineOptions`, `EngineConfig`, `SSRActionConfig`) `@plitzi/sdk-actions/types`; the page
  server's (`SSRServerConfig`, `SSRServer`, `SSRTemplateFn`, `CacheManager`) `@plitzi/sdk-server`. `sdk-shared` keeps
  what the browser reads too (`SSRUser`, `PluginSource`, `SSRRscData`, a job's record) and `ServerFlags`. `plitzi
  upgrade` rewrites the imports (`movedExports`).
- **Credentials are signed with ES256.** `createAuth({ tokens })` and `createTokens` take `keys` — a key pair
  `generateTokenKeys()` makes once, kept as a secret — instead of `secret`, and `createAuth` takes `secret` (32
  characters or more) for its CSRF tokens. A process that only checks credentials is given the public key alone.
  Every session and token signed before is refused: its holders sign in again.
- **The functions runner and the platform speak protocol `1.1`**, and refuse each other across a major version: deploy
  them together, the runner first. `FUNCTIONS_PROTOCOL` and the `ctx` vocabulary are in `@plitzi/sdk-shared/functions`.
  1.1 adds `busy`: a runner past `memoryShare` (85% of its memory limit) starts no invocation, and the run is
  `over_capacity`, with a retry. `protocolRefusal` takes the names of its sides.
- **An invocation has 32 MB of memory by default**, from 64: a plan that parses large answers raises it (`limitsFor`).
  A runner keeps 32 MB of compiled bundles (`cacheBytes`), from 64.
- **A run is held to `maxRunBytes`** (10 MB) across every answer its steps read, beside `maxResponseBytes`, and a server
  short of memory (`concurrency.memoryShare`, 85% of its limit) refuses a new run as `over_capacity`.
- **`createHttpServer`** answers `{ listen, close, channel }`; its parts no longer take `cache` or `plugins`.

## The server (`@plitzi/sdk-server`)

- The render cache keeps a page in the encoding the server prefers — a 1 MB page as the ~90 KB a browser is sent — and
  is bounded by bytes. It dropped the page stored first, the site's home page among them, and held up to 500 pages of
  any size.
- The caches are a segmented LRU: a page starts on probation and is protected once it is served again, and probation
  gives way first. A page of a space barely visited, or every URL a crawler makes up, no longer pushes out the pages
  asked for all the time — on a server of many spaces, one that just got busy takes the room of the ones gone quiet.
- `cache.maxBytes` defaults to `SDK_SERVER_CACHE_MAX_BYTES`, else 128 MB a process; the Redis store to
  `SDK_SERVER_CACHE_STORE_MAX_BYTES`, else 128 MB, under its own budget — never Redis's eviction, which would reach the
  job queues beside it.
- A published space is kept as the object it was read as: kept as text, every render parsed it again, and serialised and
  hashed it again for the page's payload.
- The requests for a page that arrive while it renders wait for that render: a page a publish invalidated was rendered
  once per visitor who asked for it in the meantime.
- A page past its TTL is served for `cache.staleMs` (60 s) while one request renders it again behind it.
- `cache.bus` carries an invalidation to every replica; `cache.store` keeps the pages rendered for nobody in particular
  where every replica reads them, so a replica that never rendered a page — a new one, after a scale-up — serves it
  warm. A store that cannot answer is a miss, said in the log.
- The query string is keyed in one order, without the parameters `cache.ignoredQueryParams` names.
- The RSC answers and the schema data are bounded by bytes too.
- **A space's plan bounds its actions**: `action.limitsFor(spaceId)` answers what one run of that space may spend —
  each limit at most the deployment's `action.limits`, and a document's `limits` tighter still. A deployment selling
  more to some spaces than to others sets `action.limits` to its largest plan's. `ActionsModule.limitsFor` takes the
  space and answers a promise: `await limitsFor(spaceId, document)`.

## The job queue (`@plitzi/sdk-actions`)

- **A job that takes its worker down runs next on a larger one.** `jobs.claimMemory: () => ({ mb, ceilingMb })` says
  what a worker may hold and the most any of the deployment's may. A worker that has it reads its memory every second
  while it holds jobs, and near it (85% of its container, or of V8's heap limit) marks them (`heartbeat`'s
  `nearMemoryLimit`) and says so in its log. Should it die, a job it marked — or one a second worker in a row died
  running — needs more than that worker could hold (`needsMemoryMb`; the `lost` attempt keeps `memoryMb` and
  `nearMemoryLimit`), is taken only by a worker that may hold it, whatever spaces that one is kept for, and is set aside
  (`paused`) when none may, its error saying what it needs and how to resume it. A worker that died for anything else —
  a node lost, a deploy past its grace — leaves its jobs to the next, as before. `summarize` counts what waits and what
  is set aside (`needingMemory`). Every store keeps the rule: memory, file, SQLite, Mongo and MySQL. Without
  `claimMemory` the queue is as it was.

## The space's stylesheet

- A server-rendered page links the space's compiled stylesheet as `/_plitzi/style/<hash>.css` instead of carrying it:
  the Plitzi dashboard's HTML went from 496 KB to 111 KB, and its render served ~60% more requests a second. The space
  document names it (`style.cacheHref`, an empty `cache`) and the template links it in the head (`styleSheetPath`); any
  replica answers it, kept for good under its name. A draft preview, a space named by `?access-token`, a deployment's
  own `templateFn` and a stylesheet with `{{ tokens }}` still carry it in the page; a client-side render receives it as
  before.
- `styleCacheInDocument`, `markStyleCache`, `styleCacheFromDocument` and `styleCacheTravelsInDocument` are gone: the
  page no longer carries the stylesheet for the bootstrap to read back.

## Rendering, per request

- A development server's `Server-Timing` names what a page spent before it was rendered — each middleware
  (`deployment`, `auth`, the deployment's own by name) and the metering (`meter`) — beside the render's own phases.
- The route a page is matched by is compiled once (`matchPath`), the paths a template reads are read once per template
  (`templatePaths`, now `readonly string[]`), and a page's element types once per schema and page
  (`pageElementTypes`, now a `ReadonlySet`); every render — the server's and the browser's — did all three again.
- The plugins a space's elements render are found once per version of the space, not on every render.

## What a page loads, sooner

- The SDK's module is preloaded from the head (`modulepreload`), and with the SDK's stylesheets is said in a
  `103 Early Hints` before the page is rendered and again as its `Link` header (`earlyHints: false` turns both off): the
  browser had to parse the whole HTML to find the script.
- **Server providers asked as the visitor** (`rsc.visitorCredentials`: the deployment's own API origins, where it
  reaches them, the cookies carried, the spaces trusted to ask). A signed-in page — an account's dashboard — arrives
  drawn with its visitor's data instead of empty until the browser has run and asked: the Plitzi dashboard's space page
  went from a dozen requests after hydration to two, and its largest paint on a 4G phone from 3.9 s to 1.3 s with the
  thumbnail below. A page or a `/_rsc` refresh read so is kept by no cache.
- **Google Fonts from the page's own server**: the stylesheet and its files ride the page's connection — no lookup,
  handshake and connection to two more origins before the text is drawn — kept in the process (32 MB,
  `fonts.google.maxBytes`), and the visitor's address is not handed to Google. A server that cannot reach Google sends
  the browser there, and says so.
- A page's uploaded fonts are addressed in the browser as the server addressed them (`Server.fontsBaseUrl` is set
  now): a deployment with `fonts.baseUrl` on a CDN had the SDK write them again under `/fonts`.
- `@plitzi/sdk-mcp`'s screenshots take `format: 'webp'` and `quality`: a thumbnail is an eighth of its PNG.
- **A `system` theme drawn as the machine asks** on the server: the page asks Chromium for `Sec-CH-Prefers-Color-Scheme`
  (`Accept-CH`), the SDK keeps the scheme in a `<theme cookie>-scheme` cookie, and `{{ theme.resolved }}` — a picture's
  address — is the same before and after hydration instead of the light one swapped for the dark. `ThemeProvider` and
  the SDK take `scheme`; the page cache is keyed by it where the theme defers to the machine.
- **A server provider reads the state the space paints**: `{{ state.workspace.id }}` in a `runtime: 'server'` provider's
  `query`, for a key of `settings.paintedState`, is the value the page starts from — and the provider asks `/_rsc` again
  when the browser comes to write its address differently. A signed-in dashboard's workspace parts arrive drawn.
- A painted key another account kept is dropped only while it still holds that account's value: what this account wrote
  before the check — a server provider's first answer — is its own.

## A page that answers sooner on a phone

- A server-rendered page is drawn once as it hydrates, not three times: the component registry and the plugin registry
  were new objects right after hydration — the host's `<PlitziSdk.Plugin>` children read again, an empty plugin list
  replacing an empty one — and every container redraws from them. On a published page a container now follows only
  whether its own items' types are registered, so a plugin that arrives later redraws the container that draws it. The
  website's landing page on a slow phone (CPU 4×, mobile): 1838 element renders once instead of three times.
- Hydration no longer draws every container again when it ends: only an element with a `runtime: 'client'` or
  `'server'` item follows the switch from the server's markup to the browser's.
- **A server-rendered page hydrates as a transition**: React gives the main thread back between slices instead of one
  task as long as the page. The landing page's Total Blocking Time on a slow phone went to ~0.2 s, the dashboard's to
  ~0.2–0.27 s.
- **A tap between a page's hydration and its effects is no longer lost**: the interactions manager keeps a trigger fired
  at an element whose flows are not wired yet, and runs it once they are (a few seconds, a few per element; said in the
  dev tools when nothing takes it up). With hydration as a transition that window was long enough for the cookie bar
  to ignore a click.
- **A published page's containers follow the registries through `ElementRegistryContext`** (`@plitzi/sdk-shared/
plugins/react`), whose value never changes: a plugin arriving, the host's components handed over, redraw the
  containers whose items they concern instead of every container of the page.
- The page's context carries only what holds for the life of the page (see above), and the plugins' stylesheets their
  own context: an element registering its styles as it mounts drew every container again.

## Elements (`@plitzi/sdk-elements`)

- **`chart` draws several series, and reads them back as a monitoring screen does.** `series: [{ field, label }]` (or
  `field:label, …` from the builder) draws a line, an area or a bar a series, each in a colour of its own — eight
  hues in a fixed order, a step for light and one for dark, `--plitzi-chart-series-1`…`-8` to change them — with a
  legend of each one's last and highest value. A row without a series's value is a gap, not a point moved along; a
  record without its `valueField` is now a gap in one series too, where it was left out. Pointed at, or moved
  through with the arrow keys, a chart reads every series at that row (the `tooltip` part); `titleField` names each
  row there when the axis writes less (an empty label is not written, and the labels that are keep their room), and
  charts given the same `sync` point together. The axis draws a hairline at each time it names, and an area of
  several series fades towards it. A legend's click hides or shows that series — several, one after another — and ⌘ or
  Ctrl + click shows it alone (again, every one); what is hidden leaves the drawing, the scale and the readout.
  Both are kept by each series's `field`, not its place: data that comes again in another order, or with a series
  added or gone, leaves every series its colour and whether it is hidden — a screen refreshed every few seconds kept
  repainting and unhiding its lines.

- **A field shows a number bound to it.** A `formControl`'s `defaultValue` bound to a number — a count or a price from
  a provider — drew an empty field: the control read its value as text alone. It shows the number's digits now, and a
  `0` goes into the form as any other default does (only an empty one is left out); the form sends the number as it
  is. `defaultValue` is declared `string | number`.

- **`chart` draws.** It was declared and authored, and missing from the elements the runtime draws by type: every page
  that had one drew nothing in its place, without a word. A test now holds every declared type to a component.

- An element reads its items by their own paths. Inside a component instance, a read of the whole `schema.flat` merged
  the component's elements over every element of the space, once per instance: the home page of a two-thousand-element
  site hydrated in 16% less main-thread blocking time on a slow phone without it.
