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

- **A deployment's own `getUser`** (`SSRAdapters`, `RequestIdentity`) is handed the response as a second argument: one
  that finds the request's session cookie over for good clears it there (`createSessionCookies(...).clear`), its hint
  with it, as `createAuth`'s does now.

- **`SSRActionJobsConfig` is `ActionJobsConfig`**, one type for both entries (`@plitzi/sdk-actions/types` and the root):
  rename the import.
- **A MySQL job queue** made before this release needs two columns:
  `ALTER TABLE action_jobs ADD holder_memory_mb INT NULL, ADD needs_memory_mb INT NULL, ADD near_memory_limit
  TINYINT(1) NOT NULL DEFAULT 0` (with its `tablePrefix`); the tables made from now on have them. A store of its own
  implementing `JobQueue` keeps the new `claim` and `heartbeat` rules (`memory`, `nearMemoryLimit`, below), answers
  `needingMemory` from `summarize`, and answers `countDue`.

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

- **A session that ended on the server no longer sends the browser round the sign-in for ever.** Signed out everywhere,
  revoked, or the database restored, the browser kept its cookie, the readable hint and the token it stored: it took
  itself for signed in, a sign-in for signed-out visitors sent it on, and the page server sent it straight back — 271
  page loads in ten seconds, until the tab was closed. The page server now clears a session cookie it finds over for
  good (revoked, outdated, an account that may not sign in, never a token at all), the hint with it — never one the
  refresh may still renew. And the browser (`@plitzi/sdk-auth`), on a page whose server found nobody while a hint says
  otherwise, asks before restoring the token it kept, and ends it on a refusal; a space with no hint restores as before.

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

## The functions runners (`@plitzi/sdk-runtime`, `@plitzi/sdk-actions`)

- **A job set aside is not waiting for the queue** (`summarize`): counted with what waits, 32 jobs set aside at their
  limits read as a queue falling behind for minutes, the oldest of them its wait, with nothing left to run. They are said
  apart (`byStatus.paused`); a job a worker died running still counts while it needs a larger one, set aside or not.

- **A job says whether it runs the space's code** (`target.code`, set as it is queued from its action's document), and a
  worker shares its room between kinds of work (`claim({ takes })`: `light`, `codeActions`, `functionJobs`, in every
  store's queue): every job that needs no runner as its slots allow, and the room its runs waiting for a runner leave
  shared by turns between actions that run code and the functions' jobs — half each, what one leaves the other takes.
  Held back from every claim, a burst's 20 ms actions waited 105 s behind the jobs that needed a runner; taken in the
  queue's order, its actions held 100 minute-long jobs back for two and a half minutes. **To redo:** a `JobQueue` of
  one's own honours `takes` in `claim`.

- **A worker claims no more while its runs wait for a functions runner with room** (`FunctionRunner.waitingForRoom`,
  ten at most). Two workers held 430 runs as running while their two runners ran 26 — each claimed only to wait beside
  the others, past the queue's order, and the whole took twice its estimate. What waits now waits in the queue, where
  every worker sees it and a screen shows it as waiting; a worker takes more as soon as a runner takes one of its own.

- **A space's share of a worker is a share, not a cap** (`concurrency.perSpace`). A worker ran at most that many of one
  space's runs however idle it was: under load a space's 20 ms actions waited 37 s behind its own runs that waited for a
  runner, while slots stood empty. A worker now claims every space's work up to its share first, then — in the slots no
  other space's work waits for — more of the spaces at their share, keeping a share's worth free for the next space that
  comes (`room().spare`, `begin({ spare })`); the process's ceiling (`perProcess`) still holds.

- **A job due now is taken as it is enqueued** (`jobs.wake`, `JobWake`): a worker found new jobs only by looking every
  `pollMs`, so an idle server started a scheduled or later run half a second late on average. Given a pub/sub — `notify`
  as a job due now is enqueued or handed back, `listen` on every worker — it looks at once. Absent, as before.

- **A light invocation is never stopped for CPU the runner's main thread took.** Under a thousand calls at once, the
  main thread took the core from the isolate whose turn it was, V8 measured that isolate as if it ran, and the meter's
  bound — the machine's cores — let it through: a 5 ms route was stopped after "100 ms of CPU". The meter is now bound by
  the container's quota (`cpuLimitCores`) less what the main thread took of it.

- **A task no runner could ever hold fails at once, naming what it needs** (protocol 1.4, `too_large`). A runner whose
  share of its memory could not hold an invocation's size even with nothing else running said `busy`, like a full one,
  and the platform kept the invocation in its queue for room that would never come — at the head of the queue, holding
  up every one behind it. It now says so at once; the platform gives it to another runner (a larger class) and, when
  none could hold it, fails it with the size it needs. **To redo:** deploy the runners first — a 1.4 runner says `busy`
  to an older platform.

- **What an invocation spent says the memory it ran with and the build it ran** (`FunctionUsageRecord.memoryMb` and
  `environment`, beside `usage`): a deployment bills compute as memory over the time it was held, as Lambda does, and
  files it under that build. **To redo:** a `functions.onUsage` that builds records by hand adds both.

- **A visitor's request never waits behind work nobody waits on.** Under load, minute-long job slices and scheduled
  actions filled every runner, and visitors' calls waited behind them in the same queue past their own timeout (129 of
  1000). A runner now takes work nobody waits on — a `schedule` or `later` run, a job's slice — up to three quarters of
  its room, keeping the rest for requests someone waits on (a route, a call, a render, a webhook), and lets those in
  first from its queue (`invocationUrgency`, `@plitzi/sdk-shared/functions`). An empty runner still takes background
  work against its whole room.

- **A function runs at the size it asks for — small, medium or large — and the plan says which it may.** Every
  invocation was given its plan's memory, asked for or not, and the runner keeps an invocation's memory whole while it
  runs: under load a 1 GB runner held two invocations at once and the rest waited (calls past a minute, actions over
  three). An invocation now runs small (32 MB) unless its task asks for `medium` (128 MB) or `large` (256 MB) —
  `limits: { cpuMs, wallMs, size }`, on a task or on `defineFunctions({ limits })` (`FUNCTION_SIZES`,
  `@plitzi/sdk-shared/functions`). A size past the server's ceiling is a problem when the functions are saved; one the
  space's plan leaves out is refused when the task runs, naming the size that fits, and the builder shows it locked
  (`FunctionsDraft.sizes`). Past its memory, a run says the size to ask for. **To redo:** a function that holds more
  than 32 MB asks for a size; a deployment's `functions.limits.memoryMb` is now the largest size it allows (256 by
  default, was 32); `FunctionTimeLimits` is `FunctionAskedLimits` and `DEFAULT_FUNCTION_TIME_LIMITS` is
  `DEFAULT_FUNCTION_ASKED_LIMITS` (with `size: 'small'`); a server answering `SpaceFunctions` adds `sizes`.

- **A run's time is its execution alone.** Its wait for a runner with room — every attempt at placing it, the pauses
  between, a runner's queue — was told to its time limit only once a runner took it: a wait longer than what the run had
  left ended it as over its budget before it had run at all (`Action exceeded its 10000ms budget`). It is told as it
  lasts, every 250 ms, and the run's limit moves with it.

- **A runner reserves each invocation what it may hold, whole, and is never killed with all of them for it.** It took
  an invocation while a quarter of what it may grow to fitted, since most hold a few MB; those it took grew together
  past its container's limit, and the kernel killed it — every invocation in it with it (`closed with 1006`, 150 calls
  of one load round). Each is now reserved its footprint whole (`invocationFootprintMb`: its limit, what isolated-vm
  lets an isolate grow past it, and the isolate's own — 256 MB holds ~262) from the moment it is taken until it ends,
  as a Lambda's memory is its own; one with no room waits for it. Past 92% of its memory anyway it gives back the one
  holding the most (`IsolateRunner.shed`, `createMemoryGuard`): stopped at its own limit when past it, else `busy`.
  The platform's sizing reckons a runner's tasks by the same footprint (`tasksAtWorst`).
- **A runner that goes away mid-invocation says so: `lost`** (`FunctionFailureReason`), the platform's and never the
  code's — it may have run in part, so it is not sent again for it — and a route answers 502 saying it. It was an
  `error`, a 500 that read as the route's own failure. A runner that turns the platform away (its secret) says that.
- **A limit holds under load too, and never stops code for the runner's load.** V8 measures an isolate's CPU as the
  time it spent running JavaScript, on a core or waiting for one, so beside more threads than cores each was measured
  as if it had a core of its own: a 5 ms route was stopped at its 100 ms limit, and growing the limit for it let code
  spin for five seconds. The runner now charges each isolate its share of the process's own CPU, as the system counts
  it (`createCpuMeter`, its threads' CPU less the main thread's, and never more than the machine's cores held for the
  time — V8's collector takes CPU nobody is measured at — shared in proportion to what each ran, over a quarter second
  so the system's lumpy count of a thread's CPU is charged whole): code that spins pays
  what it took, code beside it never the cores it waited for. An invocation's time is what it waited on that it asked
  for — calls, and a sleep for the time it asked, however late the runner woke it — and the CPU it took, never the
  clock: a turn, a place behind spinners in isolated-vm's threads, a
  core it did not get are the runner's, told the platform so its wait for the answer grows by them, and isolated-vm's
  own timeouts, which counted the clock, are gone. And a sleep (`setTimeout`) past the time it has left ends it there, by its time limit: it was cut short to fit, the code
  woke at the limit and finished as if it had slept.
- **A function route stopped at a limit says which, and is not a 503.** It answered `503 This route ran out of what
  it may spend` — a status that tells a caller to ask again, and a sentence that named nothing. A limit of its own is
  the code's to fix: `500 This route stopped at a limit its plan sets: Stopped after 100 ms of CPU`. A runner without
  room or out of reach is the platform's, and alone answers 503, with `Retry-After`. `isFunctionLimit`
  (`@plitzi/sdk-shared/functions`) is the one list of the stops that are limits.
- **A plan's allowance for the period is a paywall a run is refused at** (`quota`: `ActionErrorReason`,
  `ActionRunLimit`). `admitRun(spaceId)` (actions config) answers why a space may start no more runs — refused before
  any step, **402** at `/_action`, a render never asked — and a function's `admit` refuses with `limit: 'quota'`: 402 at
  its route (429 stays a busy minute), a job so refused is set aside, not retried. **To redo:** `functions.admit`
  answers `FunctionRefusal` (`{ limit: 'cpuBudget' | 'quota', message }`), not a string.
- **`flow.delay` says when it is capped.** It waits at most `FLOW_DELAY_MAX_MS` (5 s; `@plitzi/sdk-shared/actions`): a
  longer one written in the document is warned of (`validateActionDocument`) — a longer wait is a schedule — and any one
  past it waits the cap and says so on the step's log. A flow written to wait 15 s ran on after 5, without a word.

- **A runner takes an invocation only with room for it, and turns the rest away (`busy`) at once** — an isolate free
  (`concurrency` is now the most at once, not a queue) and memory for it: what it holds and a quarter of what the
  invocation may grow to, under `memoryShare`. Memory decides how many run: one waiting on the network holds a few MB.
- **The platform places each invocation on a runner with room.** `createRemoteRunner` resolves the runner's name to every
  runner behind it — a headless Service, a network alias — tries one at random and takes a busy one's to the next at
  once; it waits only while every runner is full (`waitForRunnerMs`, 10 s). An invocation's time starts once a runner
  takes it: protocol **1.2** adds `accepted`, which a runner sends a 1.2 platform alone. Deploy the runners first. A
  burst no longer spends invocations' wall time queued on one runner while others are idle (`503 … ran out of what it
  may spend`).
- **An invocation's CPU is its code's.** It is counted from the moment its isolate is ready — the guest and the bundle
  compiled — so the first invocation on a runner that never ran the bundle (a runner just started, mid-burst) no longer
  pays its compile from its own CPU limit (`Stopped after 100 ms of CPU`), and what it is billed is its code alone.
- **A worker runs as many jobs as its memory and CPU hold, and takes a slot again as soon as a job ends.** `jobs.workers`
  is a ceiling: with `claimMemory` it claims no more at once than its memory has room for — what one more is reckoned to
  hold read off the ones it runs — and none near its memory (85%); near all of its CPU (90%, or its event loop 250 ms
  behind) it claims none either, saying so once a reason. A job waiting a minute on an API no longer holds the others
  up. It runs one job a worker died running (`needsMemoryMb`) at a time (`JobClaimMemory.takesNeeding`), and helps
  others (`jobs.helps`) with half its memory. A job that ends hands its slot to the next at once.
- **A runner reserves each invocation it took in the last 250 ms its share** beside what it holds: a burst taken within
  one memory reading (every 100 ms) no longer all lands on the room one had — so `concurrency` can be a high ceiling.
- **A runner manages the CPU it is given, and an invocation never fails for the runner's contention — it waits.**
  isolated-vm runs isolates on as many threads as the machine has cores, whatever the container's quota: on 1 vCPU of a
  12-core node, a route that spent 5 ms of its own was measured at 100–300 ms under a burst and stopped for CPU it
  never used. Isolates now take turns at running JavaScript — as many as the runner's cores (`turns`, its quota by
  default), given up while they wait on the platform and shared past a 20 ms slice so a long run holds nobody up. The
  CPU limit grows by how shared the CPU was while it ran, its time limit leaves out what it waited for a turn, and
  protocol **1.3** adds `waited`, by which the platform's wait for the answer grows too. **Nothing is refused for the
  runners' capacity**: a runner short of memory or isolates turns an invocation away for the platform to place on one
  with room, and with every one full the platform asks one to keep it (`queue`) — it says `queued`, and `accepted` once
  it starts, its time counted from then; it waits as long as its caller does. `readLoad` is gone from
  `startFunctionsRunnerService` and `waitForRunnerMs` from `createRemoteRunner`. Deploy the runners first.
- **An action's time limit leaves out what its steps waited for the runners' capacity** — a runner's queue, its
  placement, a turn at its CPU: `ActionTaskContext.waited` moves the run's deadline, fed by the runner
  (`FunctionInvokeRequest.onWaited`). A burst queued on full runners no longer ends its actions "exceeded its budget".
- **An invocation is stopped for CPU by its CPU alone.** isolated-vm's `timeout` is wall time while the isolate runs:
  given the CPU limit, a runner whose isolates shared its CPU stopped a 5 ms route as `Stopped after 100 ms of CPU`
  under load — blaming the space's code. It is given the time limit now; the CPU is the watchdog's (`cpuTime`).
- **A runner past its CPU takes no invocation** (90% of its quota, or its event loop 250 ms behind): the platform places
  it on another, as for memory. `startFunctionsRunnerService({ readLoad })` for tests.
- **`processLoad()`, `overloaded()`, `LOAD_LIMITS`, `cpuLimitCores()`** (`@plitzi/sdk-kernel/stats`): a process's CPU over
  the last two seconds against its container's quota (cgroup v1 or v2, else the machine's cores) and its event loop's
  delay — what a worker and a runner admit work by.
- **A worker claims no job its guards would refuse, and one refused "not now" comes round in a second or two.** It skips
  the spaces at their `concurrency.perSpace` ceiling and claims no more than `perProcess` leaves room for
  (`RunGuards.room()`); a job refused `over_capacity` or `duplicate` was released with a failure's backoff — a burst's
  jobs each waited 30–60 s for a slot that freed in a second. `perProcess` defaults to 100 plus `jobs.workers`: a
  process's jobs are calls too, and a worker of 256 jobs at once stopped at 100.
- **A job stopped at a limit its plan sets — CPU, memory, calls, output, steps, requests — is set aside at once**, saying
  so, for its owner to fix or its plan to allow more: the same code meets it on every attempt. One stopped at its time
  is still retried — a slow API answers the next attempt.
- **A job whose account spent its functions' CPU for the minute goes back for the next one**, its attempt refunded — a
  budget over the minute is "not now", and a busy minute set healthy jobs aside after three. `ActionRunResult` says the
  limit that stopped a run (`limit`).
- **`jobs.helps`**: whose jobs a worker takes besides its own while it has more than one slot free — a larger worker kept
  for the heavy jobs helps the others while idle, keeping a slot for its own.

## The job queue (`@plitzi/sdk-actions`)

- **A job waiting says why in a few words**: `Waiting for a free slot`, `Waiting for the same run to finish`,
  `Waiting for a functions runner to answer` — not `not started yet: its space runs as many at once as this worker takes
  of it (\`concurrency.perSpace\`)…`, read beside every waiting job of a burst. Which ceiling it is, is the docs' to say.

- **A claim no longer writes to reap when nothing lapsed** (the Mongo queue). Every claim reaped lapsed leases, and set
  aside jobs too large for any worker, with a multi-document write — and a worker claims as each job ends, thirty
  times a second a replica under load. Those writes fought the heartbeats for the same documents (a load probe
  measured 333 ms each, 18 s of Mongo's time in 3 s) until leases lapsed, and live workers' jobs were reaped as lost
  and run again — 216 in one round. Each is now asked first by a read of one id, and written only when there is one.

- **`JobQueue.listAcross({ statuses, limit, order })`**: the jobs of every space in some statuses, the longest due or
  the latest written first — an operator's view (a monitoring screen's lists of what waits, runs and just ended), never
  a space's own. A store of your own implements it.

- **`JobQueue.flow({ from, to })`**: the queue minute by minute — what fell due, was started and ended, and the p95 of
  how long jobs waited for their first attempt — in every store (`JobFlowMinute`). A store of your own implements it;
  the Mongo and MySQL ones add an index on `dueAt` and `updatedAt` (MySQL's on a new table: add `action_jobs_due` and
  `action_jobs_updated` to one you created).

- **A schedule's next fire starts where the last one had to go.** A fire whose job needed a larger worker
  (`needsMemoryMb`) hands that to the next fire of the same schedule, which starts on a worker that may hold it rather
  than taking a smaller one down first; `needsMemoryMb` may be given on enqueue.

- **A job that fails every attempt is set aside, not dead.** Out of its attempts (3 by default) it is `paused`, its
  error saying how many failed and what the last said, and the worker says so in its log: somebody reads its runs, then
  resumes it once fixed — `resume` gives it every attempt again — or cancels it. `dead` is left for a job that can never
  run (its action gone or switched off, a kept call past a day). A watcher of a function job still reads only that it
  failed. The builder labels one **Needs a look**; `dead` reads **Gave up**.

- **A slot that queues is full at work, not degraded.** `stats.slot(name, of, used, { queues: true })`: what comes past
  its size waits its turn — a worker's jobs (`jobs`, new), a runner's invocations (`isolates`) — so it degrades only
  while something waits past it, said as `isolates: 2 waiting past its 4`. A slot whose overflow is refused (a worker's
  `calls`, a page server's `renders`) still degrades past 90%. A micro runner running its one invocation, or a worker
  its one job, read as degraded.

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
- **`countDue({ spaces, memoryMb })`** answers how many jobs a claim with those would take now: what an autoscaler adds to
  the work its workers hold, so a pool grows with a queue that grows behind a slow job, and comes down once it drains.

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
