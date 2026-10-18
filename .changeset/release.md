---
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
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
---

## Server

- **Jobs: work longer than a request** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`, `@plitzi/sdk-elements`,
  `@plitzi/plitzi-sdk`, `@plitzi/sdk-authoring`) — PZ-136. A space's code declares them in
  `defineFunctions({ jobs: { train: { watch, maxSeconds, run(input, job, ctx) } } })` and starts them with
  `ctx.jobs.start(name, input, { key })` (`get`, `pause`, `resume`, `cancel` beside it). They run in the actions' durable
  queue — leased, taken over when a server dies, retried with backoff — slice by slice, in the sandbox, in a space's
  runtime and natively alike: `job.save(state)` is the one checkpoint and the next slice starts with `job.state`;
  `job.report(fraction, step)` says how far it is; on `job.signal` (`job.stopping`: `pause`, `cancel`, `limit`,
  `shutdown`) the code has 5 s to save and return. A sandbox slice runs at most `sliceMs` and goes on in the next if it
  saved since it began — one that saved nothing fails, so a job cannot loop forever; a runtime's runs until the job's
  time is up. A real pause: `paused` keeps what it saved until resumed. Who may watch it is RBAC: whoever started it, and
  whoever its `watch` (a channel's access) lets in, on `$job:<id>` — the platform's topic, retained — read with
  `useJob(id)` or a `channel` element on `$job:{{ id }}`; the view never carries its input, its state, or an error other
  than the code's own refusal. Limits per space (its plan) through `functions.jobs.limitsFor` —
  `DEFAULT_FUNCTION_JOB_LIMITS` otherwise: 10 running across the account's spaces (`pool`, the oldest first), 1,000
  waiting, 6 h, slices of 5 min / 30 s CPU / 10,000 calls, 1 MB of state.
- **The queue's types are the queue's** (`@plitzi/sdk-shared`, `@plitzi/sdk-server`): `ActionJobQueue`, `ActionJob`,
  `ActionJobInput`, `ActionJobStatus`, `ActionJobAttempt`, `ActionJobSettlement`, `ActionJobQuery` are `JobQueue`, `Job`,
  `JobInput`, `JobStatus`, `JobAttempt`, `JobSettlement`, `JobQuery` (`ACTION_JOB_STATUSES` → `JOB_STATUSES`,
  `isJobStatus`, `TERMINAL_JOB_STATUSES`) — the queue holds a schedule's fires, the runs set for later and the jobs of
  the spaces' functions. **What a job runs is its `target`**: `{ kind: 'action', name, trigger }` or
  `{ kind: 'function', name, user, watch, at }`, in place of `actionId`, `trigger` and `function`; `listJobs` filters
  by `kind` and `name`. Also on the queue: `paused` with `pause`/`resume`, `write` for what a running job saves and
  reports, `state`/`progress`/`result`/`activeMs`, `heartbeat` answering `{ jobId, stop: 'cancel' | 'pause' }[]`, a
  settlement's explicit `refund`, `requeue(…, { input, fresh })`. The helpers bring a store a release before left up
  to it by themselves: MySQL's `ensureJobTables` gives each job its target from `action_id`/`trigger_type` and drops
  them (`mysqlJobSchemaUpgrades` lists the statements for a deployment's own migrations); Mongo's queue does the same
  to the documents on first use and drops the `spaceId_1_actionId_1_updatedAt_-1` index. A deployment with a queue of
  its own: the contract tests (`describeJobQueue`) say what it must now do.
- **A runtime's routes stream** (`@plitzi/sdk-server`): a route under `/fn/` answered by a space's runtime is passed on
  as it is written — its head at once, its body as the code writes it, with the platform's `ctx` — over the functions
  protocol's new `head`/`chunk` messages, with no time limit once it answered; the deployment's own routes stream too.
  A runtime's `endpoints` are for addresses outside `/fn/` (an MCP server at `/mcp`); anything that can live under
  `/fn/` is a route. A sandbox's routes are answered whole, as before.
- **`createJobControl({ queue, realtime: { pubsub, kv } })`** (`@plitzi/sdk-server/actions`): an operator's
  `pause`/`resume`/`cancel`/`requeue` from a process that serves no pages — a Queue panel's API — each said on
  `$job:<id>` through the page server's own pub/sub and retained store, so a watcher hears what an operator did.
- **A run's user carries no session** (`RunUser`): what a step, a function and a job see of who asked.
- **The builder shows the jobs** (`@plitzi/plitzi-builder`, `@plitzi/sdk-shared`): **Server → Functions** lists the
  jobs the code declares as it is typed (how long each may run; one spread in or built by a call is counted, not
  guessed), and the inspector of one says how it is started and who may watch it, with the space's runs of it — live
  while one moves, progress and step as its code reported them — and **Pause**, **Resume**, **Cancel** and **Run
  again**. Through two new builder operations, `SpaceJobs(kind, name, status, page, pageSize)` — a `SpaceJob` each:
  what it runs, where it is and how far, never its input, state or result — and `SpaceControlJob(jobId, control)`
  (`JobControlAction`). Beside them in `@plitzi/sdk-shared/actions`: `JOB_KINDS`/`isJobKind`, and `actionAccessOf`, the
  one reading of a channel's access, which the functions' manifest now reads a job's `watch` with too.

- **`ctx.oauth.token` for an SDK in the page** (`@plitzi/sdk-server`, `@plitzi/sdk-shared`): Spotify's Web Playback,
  Google's Picker and their kind ask the page for the access token themselves, and `ctx.oauth` kept every token on the
  server. A connection that declares `exposeToken: true` now answers `ctx.oauth.token(name, { owner })` —
  `{ token, type, expiresAt, scopes }`, renewed first when about to lapse — for a route of the code to hand to the
  connection's owner. The refresh token never leaves; a connection without `exposeToken` refuses `token`, naming the
  field. Through the sandbox's protocol and natively alike.

## Packaging

- **No package ships the declarations of its tests** (`@plitzi/sdk-server`, `@plitzi/sdk-mcp`, `@plitzi/plitzi-sdk`,
  `@plitzi/plitzi-builder`, `@plitzi/sdk-elements`, `@plitzi/sdk-shared`): each app wrote its declarations with its own
  `dts({ exclude })`, and the ones that left the tests out of it shipped a `.test.d.ts` beside their modules — 148 in
  sdk-server alone — and the base config let a `.bench.d.ts` through. Every `dts()` now excludes
  `'**/*.(test|bench).(ts|tsx)'`, and `yarn check:dist-exports` (CI, after `build:prod`) fails a build of any published
  package that holds one.
- **`@plitzi/plitzi-builder` depends on `graphql` ^16** (was ^17): Apollo Server — the builder's API — supports only
  16, so a host installing the builder beside it got two copies. The builder uses nothing of 17's.
