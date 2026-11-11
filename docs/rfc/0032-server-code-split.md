# RFC 0032 — Server code split: a kernel, the author's runtime, an independent worker and visible pools

- **Status:** Accepted, with the kernel as its own package (option K). Making `sdk-shared` lighter (plitzi-ui out, React
  and nexus as optional peers) is its last phase (phase 11, D13)
- **Author:** Plitzi
- **Date:** 2026-11-05
- **Scope:** `apps/server` (`@plitzi/sdk-server`) split into three new packages, `packages/sdk-kernel`,
  `packages/sdk-runtime` and `packages/sdk-actions`, with `sdk-server` keeping pages, sign-in and the composition.
  The work also covers:
  - an independent actions worker;
  - a byte ceiling per run, and the levers that size the worker and the runner;
  - a versioned protocol, and asymmetric session signing;
  - the mechanism for a view of every process pool;
  - `packages/sdk-shared`, which gains the functions protocol, and in the last phase loses plitzi-ui (with a change to
    plitzi-ui, D13);
  - the consumers of today's server-code subpaths: `apps/cli`, `apps/builder`, `apps/mcp`, `packages/sdk-authoring`,
    the self-hosting examples, `docs/en` and the skills.

  How the hosted platform deploys, sizes, observes and scales it is that platform's own document (§7.4).

---

## 1. Summary

A space has four kinds of server-side machinery:
- **the platform** (`sdk-server`);
- **server actions**: flows the author declares, run by the platform with its secrets;
- **server functions**: the author's code, run in a sandbox with access to nothing;
- **a space runtime**: the author's own long-lived process.

Today all four live in one package and, on a deployment, mostly in one process: the page server. That has four costs.

1. **Load.** The page server renders every space and also runs their actions and their jobs. A page served from cache
   costs nearly nothing, but the calls its visitors' browsers make cannot be cached by nature, so under heavy traffic
   actions, not rendering, decide how much a page server can take.
2. **Weight and isolation.**
   - The functions runner and every space runtime start from the platform's whole image, so React, the SDK, esbuild
     and Prisma are installed to run a few thousand lines. That costs disk, image pulls and cold starts. Memory is a
     different matter: a process's memory is what it loads, not what is installed (§4.5).
   - An author's project depends on all of `@plitzi/sdk-server` just to import `defineFunctions`.
   - A fault in the actions engine (a leak, a stuck event loop) takes the pages down with it, because they are the
     same process and the same code.
3. **Density.** The package has 50,750 lines, not counting tests. Actions and functions make up a third of that, and
   they import each other in a cycle (§2.3).
4. **Black boxes.** An operator cannot see how many runners and runtimes are up, how loaded they are, how often they
   fail, or whether they are up at all. Nor can they add capacity when an autoscaler does not.

This RFC separates the pieces so that each can run on its own, anywhere. A self-hoster who wants their actions on
another machine, or in another region, starts the worker there. The cut is **by trust, not by feature**:

| Package | What it is | What it holds |
|---|---|---|
| **`@plitzi/sdk-kernel`** (new) | What every Plitzi server process is built on, and nothing else | The HTTP pipeline, health and shutdown, the host → deployment resolution, **verifying** who a request is (session, tokens, CSRF, origin), process stats. **No value of any `@plitzi/*` package**: from `sdk-shared`, types only |
| **`@plitzi/sdk-runtime`** (new) | What runs the author's code, with no access | `defineFunctions`, `defineRuntime`, the sandbox, the functions runner, the runtime host |
| **`@plitzi/sdk-actions`** (new) | What the platform runs on the author's behalf, with the secrets | The engine and **its own server**, the worker (`createWorker`) |
| **`@plitzi/sdk-server`** | Pages and accounts | Pages, RSC, **signing in** (sign-up, OAuth, social, TOTP, passwords), and the subpaths that compose everything into one process |
| **`@plitzi/sdk-shared`** (existing) | The vocabulary the browser and the server share | As today, plus **the functions protocol** (`./functions`), and without the server-only types. In the last phase, **without plitzi-ui**, and React and nexus become optional peers (D13) |

Three rules hold the split together:
- `sdk-runtime` and `sdk-actions` never import each other, and neither imports `sdk-server`. What both sides of the
  wire need is the protocol in `sdk-shared`.
- `sdk-server` reaches them only from its composition subpaths, which a page server never loads, and it declares them
  as optional peers, which a page server never installs.
- `sdk-kernel` imports no value of any `@plitzi/*` package.

## 2. Where things stand

### 2.1 The four pieces

| | What it is | Who writes it | Where it runs | What it can reach | Lifetime |
|---|---|---|---|---|---|
| **sdk-server** | The platform: pages, auth, data, and the engines below | Plitzi, a self-hoster | Page server, API | Everything: database, secrets, configuration | Always on |
| **Server actions** | A declared flow: steps and vetted tasks (`http.request`, email, kv…) | The author, in the builder or with sdk-authoring | Inside sdk-server (`modules/actions`) | The secrets, through the platform's tasks only | A request or a job |
| **Server functions** | The author's code, stateless, lambda-like | The author (`defineFunctions`) | The functions runner, in isolates | Nothing of its own: every `ctx` call goes back to the platform | One invocation, with its `cpuMs` |
| **Space runtime** | The author's own stateful process | The author (`defineRuntime`) | One process per space, started by the orchestrator | Its launch and its variables | Always on |

How they relate:
- An action orchestrates. A function is one of its steps (the `function` task), and `/fn/` also exposes functions as
  HTTP routes.
- The platform reaches a runtime through a proxy stage, and the runtime reaches back with `reachOwnServer`.

### 2.2 Weight

- **sdk-server's dependencies:** `@plitzi/plitzi-sdk`, `@plitzi/sdk-shared`, `ejs`, `esbuild`, `jsonwebtoken`,
  `nodemailer`, `undici`, `ws`.
- **The functions runner** needs `ws` and `isolated-vm`.
- **In the hosted platform**, both the runner and each space runtime run from the platform's full image, with an
  entrypoint of their own.
- **A space runtime's bundle leaves every `@plitzi/*` package and React to its host.** The hosted platform's
  `scripts/bundle.ts` builds it that way, so that one copy of each is loaded. Whatever runs a runtime must therefore
  provide what the runtime's code imports (§11, question 2).
- **Authors import `@plitzi/sdk-server/functions` and `@plitzi/sdk-server/runtime`.**
  - The builder's functions editor loads `@plitzi/sdk-server/functions-api.d.ts`.
  - The CLI uses `/functions-runner`, `/runtime` and `/actions`.
  - The hosted platform's seeds hold 67 files that import these subpaths.

Non-test lines per module of `apps/server/src`:

| Module | Lines | | Module | Lines |
|---|---|---|---|---|
| `core` (of it `auth` 6,572, `http` 2,299, `server` 1,503, `oauth` 1,409) | 14,463 | | `modules/rsc` | 1,198 |
| `modules/actions` | 9,021 | | `modules/connectors` | 765 |
| `modules/functions` | 7,588 | | `modules/mongo` | 717 |
| `modules/mysql` | 3,029 | | `modules/runtime` | 694 |
| `modules/ssr` | 2,937 | | `modules/images` | 513 |
| `helpers` | 2,604 | | `fonts`, `sqlite` | 534 |
| `modules/realtime` | 1,587 | | `hosts` (`project`, `authoringHost`) | 1,846 |
| | | | **total** | **50,750** |

### 2.3 Coupling

Imports between modules that are not tests:

| From → to | Imports | |
|---|---|---|
| `functions` → `actions` | 34 | a cycle |
| `actions` → `functions` | 21 | |
| `core/server` → `actions` | 4 | a second cycle (`fleet/stores` builds actions' memory kv and queue; actions imports `fleetStore`) |
| `actions` → `core/server` | 4 | |
| `runtime` → `functions` | 9 | |
| `realtime` → `actions` | 5 | consumers of the engine |
| `rsc` → `actions` | 4 | |
| `sqlite` → `actions` | 4 | |

The functions contract and protocol import actions' vocabulary:
- `LaterRequest` and `LaterAnswer`;
- `RateLimit` and `RateCount`;
- `ActionKvStore`;
- `ActionRefusal`;
- `kvChange`.

Both sides of the wire need that vocabulary: the guest that sends a `ctx` call and the host that answers it. It
belongs with the protocol, below both (D5).

Two places compose everything today:
- **`createServer` builds the actions module itself** (`core/createServer.ts` imports `actionsModuleFor`), from
  `config.action`.
- **`hosts/project`** (`serveProject`, `bundleProject`) wires actions, functions, runtimes and connectors into a
  project's own server. Every CLI project's server imports it (`scaffold/server.ts` writes the file), and it is what a
  self-hoster runs.

### 2.4 What the actions engine needs from sdk-server

Less than its size suggests. `modules/actions`, `modules/functions` and `modules/runtime` import **nothing from
`core/auth`**. From `core` and `helpers` they take:
- the logger and `outboundGuard`;
- `onAbort`, `requestParser`, `webExchange` and `sse`;
- `wsFrame`, `fileStore` and `flagOverrides`;
- `esbuild`, which only the functions build needs;
- the fleet's store channel, and `drain`.

The coupling is in the **entry**. The `/_action` stage (`core/services/action.ts`) expects the pipeline to have already
resolved two things:
- `req.ctx.spaceDeployment`: which space the host serves (`hostDeployment` stage);
- `req.ctx.user`: who the visitor is, from their session.

It also relies on the pipeline's CORS and origin checks, CSRF (`crossSiteWrites`), body parsing, health and orderly
shutdown. None of that can be copied into a worker: a second implementation of identity is a second place for it to
be wrong. It must **move below both**, which is `sdk-kernel` (D3).

`sdk-server` already exports a `./kernel` subpath, with `createHttpServer`, the dispatcher, `healthStage`, the static
stages, `requestParser`, the logger, `outboundGuard` and `esbuildBuild`. That is the package's seed.

Sessions and tokens are signed with **HS256** by default (`core/auth/tokens.ts`, `algorithms ?? ['HS256']`). So
every process that verifies a session also holds the secret that can mint one (D15).

### 2.5 What the server-side code needs from sdk-shared

Type-only imports cost nothing at run time, and every import from the root `@plitzi/sdk-shared` is type-only.

**The kernel's files import 34 names, and 31 of them are types:**

| | Names | Who else uses them |
|---|---|---|
| **Server-only types** (23) | `SSRRequest`, `SSRServerConfig`, `SSRPageServerConfig`, `SSRSpaceDeployment`, `SSRSession`, `SSRAuthCookie`, `SSRHeaders`, `SSRMiddleware`, `SSRResponseHelpers`, `SSRServer`, `SSRTemplateFn`, `ServerLogger`, `ServerLogEvent`, `LogLevel`, `CacheManager`, `JobQueue`, `SpaceRevision`, `PluginRegistry`, `PluginAction`, `PluginSourceFile`, `ActionErrorReason`, `FunctionOAuthConnection`, `FunctionsSourceReader` | Only `apps/server` and the CLI. No browser package |
| **Shared types** (8) | `Environment`, `ActionAccess`, `FunctionAskedLimits`, `FunctionJobView`, `InteractionCallbackParam`, `FunctionsManifest`, `ActionRunStep`, `OfflineDataRaw` | The SDK, the builder, the elements, authoring |
| **Shared values** (4) | `PLUGIN_ROUTES_SEGMENT`, `readFunctionsSource`, `FUNCTION_ROUTES_PREFIX` (the runtime), `isRecord` | 45 files use `isRecord`; the CLI and the builder use the others |

**The server-only types name much of Plitzi's vocabulary.** What each one drags from the rest of `sdk-shared`:
- **nothing:** `SSRHeaders`, `SSRSession`, `SSRAuthCookie`, `LogLevel`;
- **one or two types:** `SSRResponseHelpers`, `CacheManager`, `SpaceRevision` (`Environment`);
- **~12 types:** `ServerLogger` and `ServerLogEvent` (the action-run and MCP log events);
- **~20 types:** `JobQueue` (jobs, schedules, access). It belongs to `sdk-actions`, not the kernel;
- **~60 types:** `SSRRequest`, `SSRMiddleware` and `SSRSpaceDeployment`, through the deployment a request carries:
  `Element`, styles, plugins, interactions, `PageHeadTags`.

A kernel free of those would need its own generic request and deployment types, extended by every package above: a
rewrite of the server's most used types. Its only gain would be a kernel usable outside Plitzi. It saves nothing to
install: every process that loads the kernel also loads `sdk-runtime`, `sdk-actions` or `sdk-server`, all of which
depend on `sdk-shared`. **So the kernel takes types from `sdk-shared`, and nothing else** (D3).

**What the other server packages load at run time:**

| Package | Values | What they load |
|---|---|---|
| `sdk-runtime` | The protocol; `FUNCTION_ROUTES_PREFIX` | `/actions` is clean (11 files, nothing external); `isRecord` comes from the `/helpers` barrel, which loads **React and `@plitzi/plitzi-ui`** |
| `sdk-actions` | `/actions` (cron, access, triggers), `/helpers/twigWrapper`, `/flags`, `evaluateRuleGroup`, `/schema`'s `serverInputOf` | `twigWrapper` is clean. `/flags` and `evaluateRuleGroup` load plitzi-ui's rule evaluator. `/schema` is 149 files with React, plitzi-ui and date-fns |

The causes:
- `helpers/sharedContext.ts` calls React's `createContext` when it loads;
- `helpers/utils.ts` and `schema/serverInput.ts` import `get` from `@plitzi/plitzi-ui/helpers/lodash`;
- `helpers/ruleEvaluator.ts` wraps `QueryBuilderEvaluator`, whose only implementation is in plitzi-ui.

`sdk-shared`'s `dist` keeps one module per file, so importing a folder evaluates its whole barrel. So the runner, a
runtime and the worker load React and a UI library to call a two-line function. **None** of them reaches
`@plitzi/nexus`: no file of `apps/server` imports it, and no folder they use leads to it.

**What they install** is worse than what they load. `sdk-shared`'s dependencies are installed wherever it is:
- `@plitzi/plitzi-ui` and `@plitzi/nexus` are dependencies;
- `react` and `react-dom` are **required** peers, and npm 7 and later installs required peers automatically.

So a runner installs React today without ever loading it.

**What `sdk-shared` takes from plitzi-ui**, all of it (19 import lines):

| What | Size in plitzi-ui | Does plitzi-ui use it itself? |
|---|---|---|
| `get`, `set`, `omit`, `camelCase`, `capitalize` (`helpers/lodash`) | ~350 lines with `shared.ts` | Yes, in 29 files |
| `deepEqual` | 154 | Yes |
| `QueryBuilderEvaluator` | 373, plus ~75 of helpers (`isNumeric`, `isRuleGroup`, `isDate`) | **No**: no component uses it; plitzi-ui only exports it (`./QueryBuilder/evaluator`) |
| The types `Rule`, `RuleGroup`, `RuleValue`, `Field` | — | Yes, in the QueryBuilder's props |

The evaluator has four users in the workspace, and three of them skip `sdk-shared`'s wrapper (`evaluateRuleGroup`)
and import plitzi-ui directly:
- the builder's `BuilderAreaPreview`;
- `sdk-interactions`' `InteractionsHelper`;
- `sdk-auth`'s `AuthContextProvider`.

`sdk-shared` stays: it is the vocabulary the browser and the server share (12 packages and 6 apps), and the kernel
cannot replace it, because the browser cannot depend on a Node-only package. Making it cheap to depend on is the
last phase (D13).

### 2.6 What an action costs the page server

The ceilings that exist:
- **Per run** (`runtime/limits.ts`): 10 s (120 s when streaming), 50 nodes, 20 outbound requests, 5 MB per response
  (cut off while it is read, `cappedResponse`).
- **Concurrency** (`runtime/guards.ts`): 10 calls per space and 100 per process, **per replica**, plus 1,000 renders
  per process.

What these ceilings do not hold:
- **The event loop.** `http.request` parses its response synchronously (`tasks/http.ts:125`), and so are templates.
  A large response blocks every render in flight in that process while it is parsed.
- **Memory.** The 5 MB ceiling is per response, not per run, and every step's output stays in scope until the run
  ends. Nothing bounds a run's total.
- **Long holds and jobs.**
  - A streaming run holds its slot and its connection for up to 120 s.
  - Wherever a job queue is configured, the page server takes job work too.
- **Calls are neither cached nor shared.** Renders are shared through `renderShare`: identical renders in flight join
  one run, and a trigger's `cacheSeconds` keeps the answer. Calls are not. Under a spike, a popular space's 11th
  concurrent call on a replica is refused with "Too many actions are running right now". The `renderShare` comment
  explains why that answer is wrong for reads: refusing them "broke the page that was doing well".

### 2.7 What a function costs

- Every invocation opens **one WebSocket** from the platform to the runner (`runner/remote.ts`) and **one isolate**,
  started from a V8 snapshot with cached code (`sandbox/isolate.ts`).
- Every `ctx` call travels back over that socket to **the process holding the run**, which answers it. That includes
  `ctx.fetch`, with or without a credential (`op: 'fetch'`, `protocol.ts`).
- So the bytes a function fetches pass through the platform process twice: once read and parsed, once serialized back
  to the runner.
- **The protocol carries a version, but only an exact one.** The first message of every operation says
  `protocol: FUNCTIONS_PROTOCOL` (`1`), and the runner refuses any other, naming both (`runner/service.ts`). Today the
  runner and the platform come from one image, so they always match. Once they are separate processes, a rolling deploy
  or a self-hoster's worker on another machine can pair two versions, and any change to the protocol would refuse
  every call between them (D14).

### 2.8 What the author may see of a secret

Nothing:
- An `http.request` step names a credential by id, and only that step resolves its `{{credential.<key>}}` tokens
  (`tasks/http.ts`).
- `ctx.fetch({ credential })` is the same.
- A runtime gets its space's variables, never the platform's.

Moving where secrets are resolved therefore changes no space (D9).

## 3. Decisions

**D1 — Actions and functions stay two layers. Actions are not deprecated.**
- An action is what the platform runs on the author's behalf, with secrets, vetted tasks, input validation and
  guards. A function is the author's code, given nothing.
- What separates them is trust, not naming. Merging them would either give the author's code the secrets, or force
  every no-code flow to be code.
- Actions are also what no-code authors and free plans use. They are the "no customer JS" guarantee, and they need no
  isolate per run.

**D2 — Actions do not run in the functions runner.**
- Their tasks must run where the secrets and the data are. So in the runner, the platform would still do all the I/O,
  and it would pay a socket, an isolate and one round trip per step on top.
- Worse, the runner would hold an isolate (`memoryMb`) while waiting on the platform. The waiting would happen twice,
  and the runner would be what saturates.
- The argument is structural, so it holds whatever the measured cost per round trip is.
- The rule: **an action runs where its data is; the author's code runs where there is no data.**

**D3 — `sdk-kernel` holds what makes a server, and takes only types from Plitzi's vocabulary.**
- The kernel holds:
  - the HTTP server, the dispatcher of stages, and the per-machine worker supervisor (`core/server/fleet`);
  - health and orderly shutdown (`drain`, `closeOnSignals`);
  - security headers, CORS and origin, CSRF (`crossSiteWrites`);
  - the host → deployment stage and its adapter contract;
  - the logger, `outboundGuard`, SSE and WebSocket framing;
  - process stats and the pool contracts (§7);
  - **verifying** a request's identity: a session, a token, a space token, the visitor's roles in the space.
- **Signing in** stays in `sdk-server`: the `/auth` routes, sign-up, passwords, TOTP, OAuth and social providers,
  session renewal on page loads.
- **The line:** the kernel answers "who is this request?" and never "let this person in". One implementation of
  identity, below everything that needs it.
- **Its dependencies stay small:** Node's own modules, `jsonwebtoken`, `ws`, and `sdk-shared` for **types only**.
  - A lint rule refuses any value import of a `@plitzi/*` package in the kernel (§2.5 says why types are kept).
  - It keeps its own `isRecord`, a two-line type guard. That is the only code it repeats.
  - `esbuildBuild`, which `./kernel` exports today, moves to a `./build` subpath with `esbuild` as an **optional peer**.
    Whoever builds (the API, the CLI, a page server compiling plugins) installs it. The runner and the worker do not.

**D4 — The code is cut by trust (guest/host), not by "functions vs actions".**
- **Guest side:** what an author writes against and what runs the author's code. It has no access, and it depends on
  nothing trusted.
- **Host side:** what holds a run, answers `ctx`, resolves secrets and talks to the stores.
- Half of `modules/functions` is host side, so cutting by feature would leave two packages importing each other.

**D5 — The protocol lives in `sdk-shared`, so the guest and the host never depend on each other.**
- What both sides of the wire need goes to a Node-free folder, **`@plitzi/sdk-shared/functions`**:
  - the wire messages and their parsing (`protocol.ts`, `runner/messages.ts`), and the protocol's version (D14);
  - the `FunctionRunner` interface;
  - the `ctx` types and their vocabulary (`LaterRequest`, `RateLimit`, `ActionKvStore`, `ActionRefusal`,
    `kvChange`);
  - the shape of a functions definition (`scope.ts`, `isFunctionsDefinition`).
- **Why `sdk-shared` and not the kernel:**
  - the protocol is vocabulary two parties share, which is what `sdk-shared` is for;
  - the builder's editor already reads the `ctx` types (`functions-api.d.ts`);
  - `sdk-runtime` and `sdk-actions` already depend on `sdk-shared`;
  - the kernel stays what makes a server (D3).
- `sdk-runtime` keeps what only the author and the guest use: `defineFunctions` and `defineRuntime` (typed against those
  `ctx` types), the sandbox, the runner service and the runtime host.
- `sdk-actions` implements the host side against the same protocol.
- The rule that settles a file: **imported by both sides → `sdk-shared/functions`.** Phase 3a's lint rule decides the
  rest.

**D6 — One direction.**

```
sdk-kernel ◄──────────────┬─────────────────┬──────────────────┐
  servers: HTTP,          │                 │                  │
  identity, stats    sdk-runtime       sdk-actions       sdk-server ── composition subpaths only ──► sdk-runtime,
  (types only ↓)     guest: no access  host: engine,     pages, rsc,                                 sdk-actions
sdk-shared ◄──────────────┴─────────────────┴──────────────────┘    sign-in
  vocabulary + ./functions (the protocol)
```

- `sdk-kernel` → `sdk-shared`, types only.
- `sdk-runtime` → `sdk-kernel`, `sdk-shared`.
- `sdk-actions` → `sdk-kernel`, `sdk-shared`. **Never `sdk-runtime`.**
- `sdk-server` → `sdk-kernel`, `sdk-shared`, and `sdk-actions` and `sdk-runtime` **only from its composition subpaths**
  (D11).

Nothing points back. Neither `sdk-runtime` nor `sdk-actions` imports `sdk-server`, so a worker or a runner never
installs pages or sign-in.

**D7 — `sdk-actions` is named for the engine, not for a process.**
- The engine is used by the worker, by the API (the builder's test runs, as the hosted platform composes it), and by
  a one-process deployment.
- "Worker" is the server it ships, not the package.

**D8 — The worker is `sdk-actions`' own server: `createWorker()`, built on `sdk-kernel`.**
- It serves `/_action`, webhooks, `/fn/` and the job queue. It verifies the visitor with the kernel and resolves the
  host with the kernel's stage. Nothing of pages, RSC or sign-in is in it.
- It runs anywhere: beside the page servers, on another machine, in another region. It needs only its stores and the
  kernel's adapters (the host → deployment lookup, the session check).
- It reaches the functions runner through the `FunctionRunner` interface. A remote runner is `sdk-actions`' own
  client. An in-process one is handed to it by whoever composes (D11).
- **"Runner" means no access.** The worker is never called a runner and never runs the author's code. A lint rule backs
  the names:
  - `sdk-runtime` may not import credentials, kv stores or anything of `sdk-actions`;
  - `sdk-actions` may not import anything of `sdk-runtime`, the sandbox included.

**D9 — Secrets stay in the trusted plane. The egress proxy is deferred, with a trigger.**
- An egress proxy would substitute credentials so that a function's fetch skips the platform. That is the piece that
  would let many runners scale without the platform in the data path.
- It is not needed once the worker exists: `ctx.fetch` then passes through the worker, which scales on its own, and
  not through the page server.
- It is built only when §8's measurements show that the worker's CPU or memory goes to fetching and parsing on the
  runners' behalf.
- The authored contract already fits it (§2.8), so waiting costs nothing.

**D10 — No compatibility layer.**
- The import paths change in one change, across every surface: seeds, CLI templates (`scaffold/server.ts`), the
  builder, the MCP guide, the skills, `docs/en` and the self-hosting examples.
- No package re-exports another's API (no production yet; see the workspace's rule on legacy shims).

**D11 — One process can still run everything, through `sdk-server`'s composition subpaths.**
- No new package composes the others. `sdk-server` does, in subpaths only:
  - **`./platform`**: `createPlatform()`, which hands `createServer` what `sdk-actions` contributes (its stages, its
    in-process render resolver, its job workers) and an in-process `sdk-runtime` runner;
  - **`./project`** and **`./bundle`**: `serveProject` and `bundleProject` (`hosts/project`), a project's own server,
    composed the same way.
- The composition cannot live in the kernel: it imports everything, so it must sit above everything. In the kernel it
  would close a cycle (`sdk-server` → kernel → `sdk-server`) and put pages into every runner.
- **What a page server loads:** the root, `./ssr` and everything else it reaches never reach `sdk-actions` or
  `sdk-runtime`. **A test enforces it** by following the value imports from those entries.
- **What a page server installs:** `sdk-server` declares `sdk-actions` and `sdk-runtime` as **optional peers**.
  - Whoever uses `./platform` or `./project` (one process, the CLI, a self-hoster) installs them.
  - A page server deployed on its own does not.
  - `createPlatform` started without one of them refuses, naming the package to install.
- So the isolation of D6 holds at run time and at install time, not only on paper.
- That is how a self-hoster, `yarn start` and the CLI's local server keep working. Every phase's tests include the
  one-process configuration.
- The same deployment can move its actions out later by starting `createWorker()` elsewhere and pointing the page at
  it (§4.4), with no change to any space.

**D12 — Each package owns its configuration and its types.**
- `createServer` stops accepting `action` and `functions`. It takes pages, RSC, sign-in, and the stages and resolver it
  is handed.
- `createWorker` and `createActionsModule` take the actions and functions configuration. `createPlatform` takes both
  and passes each its own.
- The server-only types (§2.5) move out of `sdk-shared` to the package that owns them:
  - the pipeline's and identity's (`SSRRequest`, `SSRHeaders`, `SSRMiddleware`, `SSRSession`, `ServerLogger`…) to the
    kernel;
  - `JobQueue` and the action-run log events to `sdk-actions`;
  - the page server's (`SSRServerConfig`, `SSRPageServerConfig`, `SSRTemplateFn`, `PluginRegistry`…) to `sdk-server`.

  `sdk-shared` keeps only what the browser also reads.
- This is a breaking change for every self-hoster's server file. It is listed with the import changes of D10, and the
  CLI's `upgrade` migrates a project's server file, as it does other contract changes.

**D13 — Last phase: `sdk-shared` becomes cheap to depend on, with no plitzi-ui and React and nexus as optional peers.**
- **When:** phase 11, the last, so it holds up nothing else. Until then a runner and a worker install React and
  plitzi-ui through `sdk-shared` (§2.5), though they never load them: the slim images are finished only with it.
- **The generic helpers are copied.** `get`, `set`, `omit`, `camelCase`, `capitalize` and `deepEqual` (~500 lines, with
  their tests) go into a server-safe folder of `sdk-shared`.
  - plitzi-ui keeps its own, because 29 of its files use them.
  - They are lodash-like utilities with no Plitzi rule in them, so two copies are not two sources of truth for any
    rule.
- **The rule evaluator is copied, and Plitzi reads only sdk-shared's** (decided with the maintainer, 2026-11-05).
  - `QueryBuilderEvaluator` decides how flags, `when` and binding conditions evaluate. That is a Plitzi rule, and two
    copies read by Plitzi could let the builder's preview and the server decide one condition differently.
  - So plitzi-ui keeps its own, as a generic library may, with no release and no breaking change; the workspace's shared
    ESLint configuration refuses importing it, and every reader calls `evaluateRuleGroup`
    (`@plitzi/sdk-shared/conditions`).
  - The three users that imported plitzi-ui directly moved to `evaluateRuleGroup`, so all four evaluate one way.
- **The types of a condition** (`Rule`, `RuleGroup`, `RuleValue`, `Field`) are the stored format, which is Plitzi's
  schema, so `sdk-shared` defines them.
  - plitzi-ui's QueryBuilder keeps its prop types, of the same shape.
  - A type test in the builder, where the two meet, holds them assignable both ways.
- **React, React DOM and nexus become optional peers** (`peerDependenciesMeta`), as `@apollo/client` already is.
  - The consumers that render already declare them (`apps/sdk`, `apps/builder`, `sdk-elements`).
  - React-only helpers (`sharedContext`, `generateFacade`) leave `/helpers` for a folder of their own.
  - An import test holds every server-safe folder to never reaching `react`, `react-dom`, `@plitzi/nexus` or
    `@plitzi/plitzi-ui`.
- What a server then installs with `sdk-shared` is its `dist` (4 MB today), `zod` and `date-fns`.

**D14 — The protocol's version tolerates additions, because the processes no longer ship together.**
- Today's exact integer (`FUNCTIONS_PROTOCOL`, already sent first and already refused by name) becomes `major.minor`,
  defined in `sdk-shared/functions`.
  - A runner refuses a major it does not speak. The refusal names both versions and which side to upgrade, as it
    does today.
  - A minor adds without removing, so a newer runner accepts an older minor.
- The same holds for the remote render resolver (worker ↔ page server, §4.3) and for `/_stats`' document (§7.2).
- **Deploy order:** runners first, then workers, then page servers. Each side then always meets a peer at least as new
  as the one it last spoke to. The order is written in `sdk-actions`' README and in the hosted platform's runbook.

**D15 — Sessions and tokens are signed asymmetrically.**
- Signing moves from HS256 to **ES256**.
  - `sdk-server`, which signs people in, holds the private key.
  - Every verifier (the kernel, in a worker or a page server) holds the public key only.
  - So a worker on another machine, if compromised, can read sessions but never mint one.
- Session tokens and space tokens alike. Tokens carry a key id (`kid`), and verifiers hold a set of public keys, so a
  key rotates without signing everyone out.
- No production yet, so this changes the contract outright (D10). Local and e2e configurations generate their key
  pair; the CLI's local server makes its own.
- It ships with the identity split (phase 3b), where the signing and verifying halves are separated anyway.

## 4. Target architecture

### 4.1 Processes

```
visitor ──► gateway ──┬──► page server (sdk-server)                pages, render cache, renderShare
                      │        │ render actions: via the resolver contract (§4.3)
                      │        ▼
                      └──► worker (sdk-actions · createWorker)      /_action, webhooks, /fn/, jobs
                               │                                     holds the run, answers ctx
                               ├──► functions runner (sdk-runtime)   isolates, no access
                               └──► space runtimes (sdk-runtime)     one per space, its variables
```

| Process | Package | Scales on | Holds |
|---|---|---|---|
| Page server | `sdk-server` (on `sdk-kernel`) | Requests (CPU) | Nothing but caches |
| Worker | `sdk-actions` (on `sdk-kernel`) | Runs in flight, queue depth (§11, question 4) | The secrets, through its stores |
| Functions runner | `sdk-runtime` (on `sdk-kernel`) | CPU | Nothing |
| Space runtime | `sdk-runtime` (on `sdk-kernel`) | One per space | That space's variables |
| API, MCP | `sdk-server`, composed with `sdk-actions` where they run actions | — | As today |

Each process is independent at run time. They share only stores (Redis, MySQL, Mongo) and the realtime bus. What
fails when one piece is down:
- **Page server down:** pages fail. Webhooks, schedules and jobs carry on.
- **Worker down:** calls and forms fail. Cached pages are served. Pages with server providers depend on the resolver
  the deployment chose: in-process ones still render, remote ones fail.

Guards are per replica, by design. With `perSpace: 10`, five worker replicas let one space hold 50 calls at once, so
scaling the worker raises the effective ceiling.

### 4.2 Packages and their entry points

- **`@plitzi/sdk-kernel`**
  - `./http`: `createHttpServer`, the dispatcher, the stage types, health, drain, security headers, cross-site writes,
    static files, `requestParser`, SSE, WebSocket framing, the worker supervisor
  - `./identity`: who a request is — the session cookies, CSRF, origins, `createIdentity`, the RBAC checks, the scopes a
    token may carry, the preview token's carrier
  - `./tokens`: minting and verifying tokens (`createTokens`, `generateTokenKeys`). Apart from `./identity` because it
    loads `jsonwebtoken`, which a page server that only reads a session cookie does not
  - `./deployment`: the host → deployment stage and its adapter contract
  - `./cache`: the bounded caches (`TtlCache`, `CompressedFileCache`)
  - `./testing`: what the packages built on it test with (test keys, a fleet simulated in one process)
  - `./stats`: `ProcessStats`' recorder, `/_stats`, the pool source and scaler contracts (§7)
  - `./log`, `./outbound`: the logger and `outboundGuard`
  - `./build`: `esbuildBuild`, with `esbuild` as an optional peer
- **`@plitzi/sdk-runtime`**
  - `.`: `defineFunctions`, `defineRuntime`
  - `./functions-api.d.ts`: the rolled-up contract the builder's editor loads
  - `./runner`: the runner service, the in-process isolate runner
  - `./host`: the runtime host (`startSpaceRuntime`, `loadRuntime`)
- **`@plitzi/sdk-actions`**
  - `.`: `createActionsModule`, tasks, kv, jobs, scheduler, the run log, connectors
  - `./worker`: `createWorker()`, and the stages a composition hands `createServer`
  - `./render`: the in-process render resolver, and the remote one that asks a worker
  - `./functions`: the host side of functions (routes, jobs, OAuth, the remote runner client, loading and building a
    definition)
  - `./runtimes`: the orchestrator contract, the proxy, `createRuntimeRunner`. Plural, so it does not read as the
    `sdk-runtime` package
  - `./mysql`, `./mongo`, `./sqlite`: the stock job queues and kv stores
- **`@plitzi/sdk-server`**
  - keeps `.`, `./auth` (signing in), `./oauth`, `./handlers`, `./ssr` and `./env`;
  - gains `./platform` (`createPlatform`), and keeps `./project` and `./bundle`: the composition subpaths (D11);
  - loses `./kernel`, which becomes the package;
  - loses `./actions`, `./functions`, `./functions-runner`, `./runtime` and `./functions-api.d.ts`;
  - loses the job queues and kv stores of `./mysql`, `./mongo` and `./sqlite` to `sdk-actions`. Where the identity
    store goes is open (§11, question 7).
- **`@plitzi/sdk-shared`**
  - gains `./functions`, the protocol (D5), Node-free;
  - loses the server-only types (D12);
  - in phase 11: gains the copied helpers and the rule evaluator, and loses its dependency on plitzi-ui (D13).

The exact names are settled when each package is extracted. What is fixed is which side each one is on.

### 4.3 Render actions without importing sdk-actions

A page's server provider names an action (`runtime: 'server'`). Today the page server runs it in-process through
`createActionResolver` (`runtime/renderResolver.ts`), behind `renderShare`.

- **`sdk-server` defines the contract:** an RSC element resolver it already asks, `RscElementResolver`.
- **`sdk-actions` ships two implementations:**
  - in-process: the engine, as today;
  - remote: a request to a worker, versioned like the runner's protocol (D14).
- **The composition passes one** (`createPlatform`, or a deployment's own wiring). `renderShare` stays in the page
  server, in front of either, so identical renders still cost one run or one request.

Phase 6 ships the in-process one, because the move needs it. Phase 9 adds the remote one: the worker's `POST /_render`,
behind `render.secret`; the page server's `renderShare` stays the in-process resolver's, and the worker's own share joins
identical asks there.

### 4.4 Actions on another origin

A page learns where its actions are from `server.ssr.actionPath` (`resolveActionEndpoint`). With a worker elsewhere:

- **Same origin, routed by path:** the recommended way, and the hosted platform's.
  - A gateway or proxy sends `/_action`, webhooks and `/fn/` on the space's own host to the worker.
  - The visitor's session cookie and CSRF work unchanged, because the browser sees one origin.
- **Another origin** (`actions.example.com`) is supported by publishing an absolute endpoint (`action.origin`). Then:
  - the worker's CORS allows the space's origins (`action.pageOrigins`), with credentials;
  - the session must be readable there: a cookie scoped to a shared parent domain, or the same cookie domain;
  - `crossSiteWrites` treats that origin as the space's own.

  `createWorker` refuses to start with an absolute endpoint and no CORS origins, and says which setting is missing.

### 4.5 Sizing

**A process's memory is what it loads, not what is installed.** Removing packages from an image shrinks the image, the
pull and the cold start. Only not importing them shrinks memory.

Measured on 2026-11-05 on a laptop (macOS arm64, `NODE_ENV=production`, idle), and from the hosted cluster's
configuration:

| Process | Idle RSS | What grows it under load | Bound by |
|---|---|---|---|
| Page server | ~451 MB under the platform's bench (measured 11-03). `sdk-server` alone, ½ vCPU and 256 MB: ~360 renders/s, ~8,700 cached req/s | Renders in flight, its page cache (128 MB by default) | CPU, memory |
| Worker, phase 1 (`sdk-server` with pages off) | **180 MB**: the root of `sdk-server` loads React and the SDK | Runs in flight × what each holds (`maxRunBytes`) | Runs in flight, database connections |
| Worker, phase 6 (`createWorker`) | **~96 MB** for the engine and the store drivers (Node alone is 45 MB), plus the kernel. Before the deployment's own lookups (§8) | Same | Same |
| Functions runner | **81 MB** | Invocations at once × 2 × `memoryMb` (64 MB by default), plus its bundle cache (64 MB) | CPU (`cpuMs`), isolate memory |
| Space runtime | Its author's code | Its author's code | Its size (one per space) |

Linux arm64 differs somewhat from macOS. The hosted platform's numbers, and what fits on its node, are in its own
document (§7.4).

**At rest, the worker and the runner use almost no CPU.** So their CPU requests can be small, with the limits above
them (§6.3). A request is a reservation the scheduler counts, not use.

**One machine isolates; it does not scale.** On a single node, more replicas share the same cores. The split gives
each process its own ceiling, so a burst of webhooks no longer slows pages. More capacity means more machines.

### 4.6 What each process is given

| Process | Is given | Is never given |
|---|---|---|
| **Page server** | The stores pages and sign-in need; the session **private** key (it signs people in); the OAuth providers' secrets; the CDN's | The spaces' credentials, SMTP, the runner's secret, when the worker runs apart |
| **Worker** | The stores runs need; the spaces' credentials; the actions signing secret; SMTP; the runner's secret; the session **public** key | The session private key; the OAuth providers' secrets |
| **Functions runner** | Its own secret | Everything else, as today |
| **Space runtime** | Its launch and its space's variables | Any of the platform's secrets |
| **One process** (`createPlatform`) | The union, as today | — |

Each package's README lists what its server reads, and its server refuses to start without what it needs, naming the
setting.

## 5. File map (provisional)

The boundaries phases settle the ambiguous rows with the lint rule: a file goes to the side whose imports it already
has, and a file both sides of the wire import goes to `sdk-shared/functions`.

| Today | Goes to | Notes |
|---|---|---|
| `core/server/baseServer` (without `updatePages`), `closeOnSignals`, `drain`, `fleet/**`; `core/http/dispatcher`, `types`, `securityHeaders`, `sse`, `webExchange`, `socketResponse`, `navigation` | `sdk-kernel` | Today's `./kernel` subpath, completed |
| `core/http/stages/health`, `hostDeployment`, `crossSiteWrites`, `middlewares`, `static` | `sdk-kernel` | |
| `core/auth/session`, `tokens`, `spaceTokens`, `csrf`, `identity`, `authorize`, `domains`, `credentials` | `sdk-kernel` (`./identity`) | The verifying half, held apart by a lint rule since phase 3b. `tokens.ts` stays whole: minting needs the private key, which a verifier is not given (D15), so splitting the file would add nothing |
| `core/requestParser`, `core/health`, `helpers/serverLog`, `outboundGuard`, `onAbort`, `wsFrame` | `sdk-kernel` | |
| `helpers/esbuild` | `sdk-kernel` (`./build`) | `esbuild` as an optional peer |
| `sdk-shared`'s server-only types (§2.5) | `sdk-kernel`, `sdk-actions` or `sdk-server` | D12 |
| `functions/protocol.ts`, `runner/messages.ts`; the `ctx` types of `contract.ts`; the wire helpers of `capabilities.ts` | `sdk-shared` (`./functions`) | Moved in phase 3a (D5) |
| `actions/runtime/kvChange.ts`, `jobs/later.ts` (types), `runtime/rateLimit.ts` (types), `runtime/errors.ts` (`ActionRefusal`) | `sdk-shared` (`./functions`) | The `ctx` vocabulary |
| `functions/contract.ts` (`defineFunctions`), `runtime/contract.ts` (`defineRuntime`) | `sdk-runtime` | Typed against the `ctx` types |
| `functions/sandbox/**` (`isolate`, `prelude`, `guest/*`), `functions/driver.ts`, `functions/runner/service.ts` | `sdk-runtime` | The driver is printed into the isolate (`.toString()`), so it is the guest's. The prelude builds core-js with esbuild when the runner starts: `sdk-runtime` ships it built, or a runner installs esbuild |
| `runtime/host.ts`, `inside.ts` | `sdk-runtime` | The process half |
| `actions/**` (the rest), `core/services/action.ts`, `functionRoutes.ts` | `sdk-actions` | The stages become the worker's |
| `modules/connectors` | `sdk-actions` | Outbound calls with credentials: the trusted host |
| `modules/mysql`, `mongo`, `sqlite`: job queues and kv | `sdk-actions` (`./mysql`, `./mongo`, `./sqlite`) | |
| `modules/mysql`: `createMysqlStore`, `mysqlSchemaStatements` | Open (§11, question 7) | The identity store |
| `functions/load.ts`, `build.ts`, `runtime/bundle.ts` | `sdk-actions` | Reading a definition from disk builds it, through the kernel's `./build` |
| `functions/runner/remote.ts` | `sdk-actions` | The platform's client of the runner |
| `functions/config`, `context`, `native`, `space`, `jobs`, `jobControl`, `oauth`, `routes`, `local`, `tryEntry`, `scope`, `manifest`; what is left of `capabilities.ts` (`readCall`, `answerCall`) | `sdk-actions` | Host side: holds runs, answers `ctx`. `local.ts` builds an in-process isolate runner: from phase 5 it is handed one (D8) |
| `runtime/runner.ts` | `sdk-runtime` | A runtime's functions as a runner, inside the runtime's own process: the guest's |
| `runtime/stages.ts` | `sdk-actions` (`./runtimes`) | The platform half |
| `hosts/project/**`, `hosts/authoringHost`, a new `createPlatform`; `baseServer`'s `updatePages` | `sdk-server` (`./project`, `./bundle`, `./platform`) | The composition subpaths (D11) |
| `modules/rsc` | `sdk-server` | Reaches actions through the resolver contract (§4.3) |
| `modules/realtime` | Open (§11, question 1) | |
| `core/createServer.ts` | `sdk-server` | Stops building the actions module (D12) |
| `core/server/fleet` ↔ actions' memory stores | — | The cycle is inverted: the store is passed into the actions module |
| plitzi-ui's `helpers/lodash` (5 helpers), `utils/deepEqual` | `sdk-shared`, copied | D13, phase 11 |
| plitzi-ui's `QueryBuilderEvaluator` and its helpers | `sdk-shared`, moved | D13, phase 11; plitzi-ui drops the export |

Estimated sizes, from the file map rather than a move:

| Package | Lines |
|---|---|
| `sdk-kernel` | ~5,100 |
| `sdk-runtime` | ~3,000 |
| `sdk-actions` | ~15,000 (the engine, connectors and the stock stores) |
| `sdk-server` | ~26,000 |
| `sdk-shared` | grows by ~1,300: the protocol. Phase 11 adds ~950 more (the copied helpers and the evaluator) |

## 6. Load safeguards and resource levers

### 6.1 Safeguards

1. **The worker** (phase 1, then phase 6). Actions, webhooks, `/fn/` and jobs leave the page server, which keeps
   rendering whatever the calls do.
2. **A byte ceiling per run, and admission by memory** (phase 2, sized from §8.1).
   - `maxRunBytes` (10 MB by default, beside `maxResponseBytes`) counts what the run's steps hold. Past it, the run
     fails as `over_capacity`, and the message names the ceiling and how to raise it, like the request budget.
   - It bounds one run, not a process: §8.1 shows that 100 runs in flight at the ceiling exceed any pod. So a process
     whose resident memory is past a share of its limit (`concurrency.memoryShare`, 0.85 of its container's limit, or of
     V8's heap limit where there is none) refuses a new run of either kind as `over_capacity`, with a retry, and says it
     was memory. The limit is read once and the memory at most every 100 ms, so the check costs a call nothing.
3. **A rule for authors, stated in the skills and the docs:** what a page shows on load is a server provider (a
   render, cached with the page), not a call from the browser. A call is for what a visitor does.
4. **Render actions can leave the page server** (phase 9), through the remote resolver (§4.3).

Sharing read calls the way renders are shared is an open question (§11, question 5), not a phase.

### 6.2 Memory

**The runner.** What weighs is not the process (81 MB) but the isolates' budget: invocations at once × 2 ×
`memoryMb`.

| Lever | Effect | Cost |
|---|---|---|
| `memoryMb` 32 by default, more only by plan (`limitsFor` already exists) | Halves the isolates' budget | A function that parses large JSON needs a plan that allows more. The refusal already names the limit |
| Admission by memory: past a share of its limit, the runner refuses a new invocation as busy, with a retry | Size the pod for the typical case, not the worst, without an OOM kill | A small change, with its refusal stated |
| The bundle cache from 64 MB to 16–32 MB | −32 to −48 MB | More recompiles, softened by V8's code cache |
| `--max-semi-space-size=1` and a small main heap: the runner's own JS is little | A few MB | More GC on a thread that does little |

**The worker.**

| Lever | Effect | Cost |
|---|---|---|
| `createWorker()` instead of `sdk-server` with pages off (phase 6) | −70 to −80 MB (measured, §4.5) | It is the plan |
| Load only the configured store driver (a dynamic import per adapter) | −10 to −15 MB | None |
| Register task families on first use (email with nodemailer, database drivers, connectors) | Up to ~10–20 MB of the engine's 36; measured module by module first | A slower first use |
| A lower `perProcess` per replica (30, say), with `maxRunBytes` | Bounds the worst case: 30 × the run ceiling | More, smaller replicas |
| A smaller Mongo pool (10 → 5) | Less memory and fewer connections | Less parallelism per replica, which a low `perProcess` makes moot |

### 6.3 CPU

At rest, the worker and the runner use almost no CPU, so their requests can be ~50m each, with limits above them.

**The runner.** The author's code is already bounded by `cpuMs`. What the platform pays per invocation:

| Where | Lever | Cost |
|---|---|---|
| A new isolate per invocation (a snapshot, then a compile with V8's cache) | Reuse a bundle's isolate and create only a fresh **context** per invocation. Never across spaces | The largest lever. The isolate stays in memory, and invocations of the **same** space share an isolate: the context resets the globals, but the change gets a security review. Built only if §8's row shows it worth it |
| A new WebSocket per operation | Persistent connections carrying several operations, each with an id (calls are already numbered, `request?: number`) | Lower latency too. It changes the protocol, so it ships with a minor of D14 |
| `ctx.fetch` bodies serialized twice | Bodies in binary frames instead of JSON | None |

**The runner keeps its CPU limit.** Isolates run on threads, so four invocations at once could take four cores. The
limit is what stops authors' code from taking a node.

**The worker** mostly waits on I/O:
- `JSON.parse` of responses is bounded by `maxRunBytes`; there is no cheap fix.
- Twig templates are parsed once (`TemplateCache`).
- Writing each run's log serializes its whole trace. Whether successful runs keep a summary rather than the whole trace
  is a product decision (§11, question 8).
- Its CPU limit can be high, or absent: throttling adds latency spikes to a process that rarely needs the CPU.

## 7. Pools: what the packages provide

Every kind of process a deployment runs is a **pool**: the page servers, the workers, the functions runners, the space
runtimes. Each must be visible to whoever operates the deployment: how many are up, how loaded, how often they fail,
whether they are healthy. And capacity must be adjustable when an autoscaler does not act. The packages provide the
mechanism. A deployment supplies the adapters and the screen.

"Pool" is used on purpose. "Fleet" already names the supervisor of several worker processes on one machine
(`core/server/fleet`), which is a different thing.

### 7.1 What each process reports

`ProcessStats`, a type in `sdk-kernel`, recorded by `@plitzi/sdk-kernel/stats`. Every server process is built on the
kernel, so they all report the same way.

- **Identity:** pool, instance, version, protocol version, uptime.
- **Load:**
  - runs in flight against the process's slots (`perProcess`, `renderPerProcess`);
  - isolates in flight, for a runner;
  - CPU, memory (RSS and heap) and event-loop lag (p99).
- **Outcomes over the last 1, 15 and 60 minutes**, kept in memory in one-minute buckets:
  - runs;
  - failures by reason (`timeout`, `over_capacity`, `cpu`, `memory`, task error);
  - refusals, a version refusal (D14) among them;
  - p50/p95 duration.
- **Health**, derived from the above against thresholds the deployment may set:
  - `healthy`;
  - `degraded`: error rate, event-loop lag or slot use over its threshold;
  - `down` is never self-reported: it is the absence of an answer (§7.2).

Who feeds it: the guards and the run logger in the worker and the page server, the isolate runner in the runner, and
the host in a runtime.

### 7.2 How it is read

1. **Each process answers `GET /_stats`, always behind a secret:** its protocol's for the runner and a runtime, a stats
   secret for the page server and the worker. A deployment may also keep the path off its public network, but the
   secret does not depend on that, because a self-hoster may have no network policies. Reading stats needs no store,
   so a runner keeps its "no access" (D8).
2. **A pool source adapter** answers which instances each pool has, where to reach them, and what their orchestrator
   knows about them (ready, restarts, last exit reason).
   - The kernel ships a **`local`** source: the gateway's processes and the local runtime driver's children.
   - A deployment on an orchestrator supplies its own.
3. **`readPools(source)`** reads every instance's `/_stats` and answers one `PoolHealth` document, per pool and per
   instance.
   - An instance that does not answer is `down`, with the orchestrator's reason when there is one.
   - A pool with no source configured says so; it is never an empty list.
   - Instances on different versions are shown as such, so a rolling deploy is visible.
4. **Space runtimes** add what the orchestrator keeps: the space, its state (running / stopped idle / stopped
   manually / failing), its size, its digest and when it was last active. Their own health comes from their describe
   endpoint (`/_describe`).

Prometheus text (`/_metrics`) from the same counters is deferred. Its trigger is an operator who wants the history in
an existing metrics stack. Until then, `/_stats` is the one format.

### 7.3 How capacity is changed

**A scaler adapter**, optional, with a small contract:
- read a pool's floor, ceiling and current count;
- set its floor, with a reason and an expiry;
- list the overrides in force.

The kernel defines it and ships none. A deployment without one shows its pools read-only and says that scaling is not
managed from there.

A space runtime is started, stopped and restarted through the orchestrator's existing operations, not through the
scaler.

### 7.4 The hosted platform

How Plitzi's own platform fills these seams lives in `plitzi-platform/cluster/docs/future/pool-health.md`:
- the orchestrator's pool source and its scaler;
- the permissions they need;
- how a floor override coexists with the cluster's GitOps;
- the back office's screen;
- what each pool reserves, and what fits on today's node.

None of it is part of this workspace.

## 8. Measurements

Each one says what it decides. They are taken with production builds, on a process running alone, as the server's other
measurements are.

| Measure | Decides |
|---|---|
| The page server's CPU and event-loop lag under N concurrent calls to one space, cached page vs not | The baseline for "actions saturate the page server", and the worker's first replica count |
| `http.request` parsing a 1, 5 and 20 MB response: event-loop block, heap | `maxRunBytes`'s default |
| An empty function, and one with 5 `ctx` calls, through the remote runner | The cost per invocation and per `ctx` call |
| The same, reusing a bundle's isolate with a fresh context | Whether §6.3's first lever is worth its review |
| A typical action's run: CPU and memory | The worker's requests |
| A function fetching a 5 MB response through `ctx.fetch`: the worker's CPU and bytes | The trigger for the egress proxy (D9) |
| The worker's RSS and start time: `sdk-server` with pages off (phase 1) vs `createWorker` (phase 6), with the hosted platform's own lookups | That the independent worker is the lighter one, and what the deployment's lookups add (Prisma, if they use it) |
| A page render's p50/p95 in one process, before and after phase 6 | That composing through `stages` and the resolver costs nothing: it must not regress |
| The install size of an author's project: with `@plitzi/sdk-server` today vs `@plitzi/sdk-runtime` | What authors gain from phase 5 |
| What a server installs with `sdk-shared`, before and after phase 11 | That React, nexus and plitzi-ui are gone from a runner |
| A runtime's and a worker's image size and start time, before and after | That phase 10 delivered |

### 8.1 Phase 0's results (2026-11-05)

Taken on a laptop (Apple silicon, Node 24.22.1, production builds). The bench's targets ran in Docker at the `standard`
profile (1 CPU, 512 MB); the rest ran as scripts (`tmp/rfc0032/` of the workspace, kept out of git).

**What a visitor's call costs the page server** (bench: `sdk-server-call`, the bench's example space, 5 s per row):

| Request | CPU per request | Requests a second at 1 CPU | Memory at c=50 |
|---|---|---|---|
| A page rendered (`sdk-server-render`) | 1.24–1.40 ms | ~800 | 238 MB |
| A page from the cache (`sdk-server-cached`) | 0.08 ms | ~12,500 | 93 MB |
| **A typical call** (`kv.increment` and a template, `sdk-server-call`) | **0.11–0.15 ms** | **~8,700** | 105 MB |

**What it decides:**
- **A simple call costs a tenth of a render.** In CPU, visitors' calls do not saturate a page server; renders do.
- **The case for the worker is isolation, not CPU.** One call reading a large answer holds the event loop for every
  render in flight (below), holds memory while it waits, and jobs run beside pages.
- **The worker's first replica count is one.** A second comes from the pools' load, not from CPU.

**What reading a large answer costs** (`http.request` against a local server, one run at a time, the worst of three):

| Answer | Longest event-loop block | Run | Heap held, at least |
|---|---|---|---|
| 1 MB | 9 ms | 25 ms | +5 MB |
| 5 MB | 20 ms | 27 ms | +18 MB |
| 20 MB | 102 ms | 128 ms | +48 MB |

The block is the parse (`JSON.parse` of 20 MB alone: 77–94 ms). The heap is sampled between ticks, so its true peak
during the parse is higher: up to ~4× the body.

**What it decides:**
- **No byte ceiling per run can bound a process on its own.** At 100 runs in flight, 5 MB each held at ~3× is
  1.5 GB.
- So phase 2 pairs **`maxRunBytes` at 10 MB** (two answers at the 5 MB cap) with **admission by memory**: a process
  whose memory is past a share of its limit (`concurrency.memoryShare`) refuses a new run as `over_capacity`, with a
  retry, naming why (§6.1).

**What a function costs** (the remote runner in-process, 300 sequential runs, the CPU of both sides):

| Invocation | p50 | CPU |
|---|---|---|
| Empty task, remote runner | 2.3–2.5 ms | 2.4–2.65 ms |
| A task making 5 `ctx.kv.get` calls | 2.8 ms | 2.8 ms: **~0.06 ms per `ctx` call** |
| Empty task, in-process isolate runner | 1.8 ms | 1.8 ms |

**What it decides:**
- **Transport is a quarter of an invocation** (~0.6 ms: a WebSocket per operation and its JSON).
- **Starting the isolate and the guest is three quarters** (~1.8 ms).
- **`ctx` calls are cheap.** The protocol is not where a function's time goes.

**Reusing an isolate** (isolated-vm alone, with a script compiled from V8's cache):

| | CPU |
|---|---|
| A new isolate, a context and a compile | 0.57 ms |
| A fresh context in a kept isolate | 0.25 ms |

**What it decides:**
- Of the runner's ~1.8 ms of start, most is the guest's bootstrap in a new isolate. A kept isolate with a fresh context
  would save most of it: an estimate of up to half an invocation's CPU.
- **§6.3's first lever is worth its security review.** It is confirmed against the runner's own snapshot when phase 10
  builds it.
- **§6.3's second lever (persistent connections) is worth at most the quarter that transport is.**

### 8.2 Phase 6's results (2026-11-11)

Taken as § 8.1's: a laptop, production builds, the bench at the `standard` profile (1 CPU, 512 MB) with nothing else
running in Docker but the stores. Before and after were measured on the same afternoon, one after the other, because
the machine moves runs by ±12 %: § 8.1's figures are not the baseline for them.

**A page render, before the split and after phase 6** (`sdk-server-render`, CPU per request at c=1, 10 and 50):

| Code | CPU per request | Requests a second |
|---|---|---|
| Before the split (`963ce9587^`) | 1.44–1.69 ms (1.98 cold) | 620–700 |
| The split, built (`ff882cd03`) | 1.33–1.85 ms | — |
| HEAD, before the fix below | 1.63–2.15 ms | 490–590 |
| **HEAD** | **1.53–1.78 ms** | **625–650** |

**What it decides:**
- **Composing through `stages` and the resolver costs nothing**: the render is where it was before the split.
- The one regression found was not the split's: a page's icon faces resolved the SDK's folder (`createRequire`) on every
  render — a module lookup, dear under Docker's filesystem. It is resolved once a process now (`resolveSdkAssetsDir`).
  Found by a CPU profile of both, not by bisecting 165 commits: what is new in a profile names its caller.
- A cached page: 0.12–0.13 ms (0.10–0.11 before), within the machine's spread at these sizes.

**The worker with the hosted platform's lookups** (`plitzi-sdk-server`'s bundled `worker` role on its stores — Prisma,
Mongo, Redis — idle): ready in ~1 s; each of its processes ~185–190 MB, against 160 MB for `createWorker` alone (phase
11). The deployment's lookups add ~25–30 MB a process. `sdk-server` with pages off (phase 1) is no longer a
configuration to compare with: phase 6 removed it.

## 9. Phases

Each phase ends with typecheck, lint and tests passing (the one-process configuration included, D11), and nothing
half-moved. From phase 6 on, the server's e2e also runs **the split topology**: a page server, a worker and a runner as
three processes, so the seams between them are tested, not only the one-process path.

| # | What | Where | Done when |
|---|---|---|---|
| 0 | **Measure:** §8's first five rows | `bench`, scripts | Done 2026-11-05: §8.1 |
| 1 | **Worker role, as configuration:** a deployment runs `createServer({ services: { ssr: false } })` beside its page servers; `/_action`, webhooks and `/fn/` are routed to it; the page server and the API take no jobs | `apps/server` (README), the hosted platform | Done 2026-11-05: the hosted platform's `worker` role, its gateway and ingress paths, its Deployment; deployed with the next release |
| 2 | **`maxRunBytes` and admission by memory** (§6.1, sized in §8.1) | `apps/server` | Done 2026-11-05, released with the workspace's next release |
| 3a | **The guest and the host apart, nothing extracted** (see below) | `apps/server`, `packages/sdk-shared` | Done 2026-11-05: the protocol in `sdk-shared/functions` at `1.0`, both cycles broken, the boundary rule and the reach test pass |
| 3b | **Identity split, in place:** `core/auth` into a verifying half and a signing-in half; ES256 with key ids (D15) | `apps/server`, the examples | Done 2026-11-05 in the workspace (below); the hosted platform adopts it with the release |
| 3c | **The server-only types out of `sdk-shared`** (D12) | — | Folded into phases 4 to 6 (below) |
| 4 | **`sdk-kernel` extracted** | `packages/sdk-kernel`, `apps/server` | Done 2026-11-05 (below): the kernel imports no `@plitzi/*` value (a lint rule); `sdk-server`'s pipeline and identity checks come from it; the auth e2e passes |
| 5 | **`sdk-runtime` extracted:** the guest side moves; authors import from it; the builder's editor loads its `functions-api.d.ts`; the CLI's `functions dev` uses its runner | `packages/sdk-runtime`, every consumer (D10) | Done 2026-11-05 in the workspace (below): no surface writes the contract's old import; the hosted platform's seeds author 0/0 when it adopts the release |
| 6 | **`sdk-actions` extracted, with `createWorker()`** (see below) | `packages/sdk-actions`, `apps/server`, the CLI, the hosted platform | Done: `sdk-server` keeps no actions code outside its composition subpaths; the split-topology e2e passes (`platform.split.test.ts`); §8's worker and render rows are in (§8.2, 2026-11-11) |
| 7 | **Actions elsewhere for self-hosters:** a self-hosting example with the worker on its own; §4.4's other-origin mode with its refusal | `apps/server`'s examples, `docs/en` | Done 2026-11-05: `examples/self-hosting/11-actions-on-a-worker` runs the worker, the page server and a gateway as three processes (and the worker on its own origin, with no gateway); `action.origin` + `action.pageOrigins`, CORS with credentials, and `createWorker`'s refusal; both in the examples e2e |
| 8 | **Pools** (§7): `ProcessStats`, `/_stats` behind its secret, the `local` source, `readPools`, the scaler contract | `sdk-kernel`, `sdk-actions`, `sdk-runtime` | Done 2026-11-05 in the workspace: `@plitzi/sdk-kernel/stats`; the page server, the worker and the MCP answer `/_stats` with `stats`, the runner behind its protocol secret; the engine feeds runs, refusals and slots, the runner its isolates. The hosted platform's `yarn start` reporting is its adoption (below); a runtime's health stays its `/_describe` |
| 9 | **The remote render resolver** (§4.3) | `sdk-actions` | Done 2026-11-05: `createRemoteRenderResolver` and the worker's `POST /_render` (`render.secret`, `RENDER_PROTOCOL` `1.0`), handed with `engineOnWorker({ render })`; `platform.remoteRender.test.ts` renders a page server with no engine from a worker's kv |
| 10 | **Slim images and the resource levers:** the runner and the runtimes on Node, `sdk-kernel`, `sdk-runtime` and `sdk-shared`; the worker on `sdk-kernel`, `sdk-actions` and `sdk-shared`; §6.2's levers and, where §8 says so, §6.3's | the packages, the hosted platform | Done 2026-11-05 in the workspace: no install of `sdk-runtime` or `sdk-actions` reaches `sdk-server` (a test in `workspaceBoundaries`); the runner's levers — `memoryMb` 32, `cacheBytes` 32 MB, `busy` past `memoryShare` (protocol 1.1) — and the worker's store drivers and nodemailer load only when used. Measured locally (macOS, one process, `NODE_ENV=production`): a worker 187 MB after ten calls, a page server 211 MB; of the worker's start, `sdk-shared` brings plitzi-ui, React and 63 modules of date-fns — phase 11. The images and §8's image rows are the hosted platform's |
| 11 | **A lighter `sdk-shared`** (D13; see below) | `packages/sdk-shared`, plitzi-ui, their consumers | Done 2026-11-05 in the workspace: no file of `sdk-shared` names plitzi-ui; React, React DOM and nexus are optional peers; `src/serverSafe.test.ts` holds 18 folders to reaching none of them; a page server loads 0 modules of nexus, plitzi-ui and zod (from 31, 19 and 95). Measured as in phase 10: a worker 160 MB, a page server 187 MB. plitzi-ui keeps its evaluator, which a lint rule keeps the workspace from importing |

**Phase 3a in detail (done):**
- the protocol, `ctx`, its vocabulary and the wire helpers moved to `sdk-shared/functions` (D5), its version
  `major.minor` with `protocolRefusal` (D14);
- the cycle `functions` ↔ `actions` broken on the guest's side: what the guest imported of actions was the vocabulary;
- the cycle `core/server/fleet` ↔ `actions` broken: the fleet is handed its store catalogue (`FleetStores`), and each
  module names its own (`modules/actions/fleet.ts`; the page server composes the catalogue);
- **two guards:**
  - `import/no-restricted-paths` in `apps/server`: the guest's shipped files import nothing of the host (its tests may);
  - a reach test in `sdk-shared` (`functions/reach.test.ts`): loading `./functions` loads no other package.

Separating the page server from the engine — `createServer`, `pageServer`, the pipeline's context type and RSC still
reach the actions module directly — moves to phase 6: it is the same change as D12 (`createServer` losing `action`),
and doing it twice would be the same work twice.

**Phase 3b in detail (done in the workspace):**
- `createTokens` signs with ES256 and checks by the credential's `kid` (`TokenKeys`, `generateTokenKeys`); a process
  given `verifying` alone refuses to mint, naming `tokens.keys.signing`; a signing key `verifying` does not list, or no
  key at all, is refused at start;
- `createAuth` takes its own `secret` for the CSRF token (32 characters or more, refused otherwise): it was the tokens'
  secret, and a worker checks writes without holding a signing key;
- `import/no-restricted-paths`: the verifying half (`session`, `tokens`, `spaceTokens`, `csrf`, `identity`,
  `authorize`, `domains`, `credentials`) imports nothing of signing in;
- the tests of D15: a checker that cannot mint, an unknown or missing `kid`, an HS256 token "signed" with the public key,
  a rotation, the refusals at start.

**What the hosted platform adopts with the release** is its own page now: `plitzi-sdk-server/docs/adopting-the-server-split.md`
(it runs the published `sdk-server` until then).

**Phase 4 as done.**
- `createHttpServer` is the transport and its lifecycle (`{ listen, close, channel }`); the page server builds its own
  API (the caches and plugins relayed across the fleet, live pages, plugin functions) over `channel`.
- `core/http/types` keeps `BaseContext` and `Stage`; `SSRContext` and `PipelineExtensions` stay in `sdk-server`
  (`core/http/pageContext`), and the MCP imports them as types from its root. The middleware chain's stage is typed to
  what it reads (`DeployedContext`: a config whose adapters answer `getSpaceDeployment`).
- The SDK bundle's stage stays in `sdk-server`; the generic static stages move. `TtlCache` takes its TTL from its
  caller, and basic auth keeps its own default.
- The identity boundary rule is gone: the kernel cannot import `sdk-server`, so the separation is the package's. In its
  place, `@typescript-eslint/no-restricted-imports` holds the kernel to types of `@plitzi/*` — and, since phase 6, to
  nothing of the packages above it, types included.
- `sdk-server` re-exports none of it (D10), and `./kernel` is gone. The CLI's `upgrade` rewrites a project's imports
  (`movedExports`), and the release notes list the entries.
- What the page server loads at start: `sdk-server` 31 → 14 modules, the kernel's 14 beside them, and `jsonwebtoken`
  off the page path (`./tokens`).
- The kernel's types stay in `sdk-shared` until phase 6: `SSRServerConfig` imports the log's and the pipeline's, and
  moving those alone would make `sdk-shared` and `sdk-kernel` depend on each other. They move with the configuration's
  split (D12).

**Phase 5 as done.**
- `sdk-runtime`'s root is the contract (`defineFunctions`, `ActionRefusal`, the `ctx` types, `defineRuntime`); `./runner`
  the runner service, the isolates and the guest; `./host` the runtime's host. A lint rule keeps `sdk-server` and
  `sdk-actions` out of it, types included.
- What both sides of a runtime read — its types, the endpoint rules, `RUNTIME_DESCRIBE_PATH`, `PLATFORM_HEADERS` — went
  to `sdk-shared/functions`, and `defineFunctions` with them: the platform's build prints it into a space's bundle, and
  the host side imports nothing of `sdk-runtime`. `sdk-server` has it as a dev dependency alone, for its tests.
- `reachOwnServer` and `reachSpaceInside` went to the kernel (`./outbound`), not here: every project server with a
  certificate calls them, runtime or not.
- The prelude ships built (`dist/prelude.js`, made by the package's build with the same `buildPrelude` its sources
  call), so a runner installs `isolated-vm` alone. Run from its sources, the package builds it.
- `createLocalFunctions` is handed its runner (D8); the CLI's `functions dev` loads both packages from the project.
- The build of a space's functions resolves `@plitzi/sdk-runtime` and refuses `@plitzi/sdk-server/functions`, naming the
  new import; the CLI's `movedExports` rewrites a project's, and its scaffold declares the package, so `upgrade` adds it.
- The isolate's own tests stay in `sdk-server`, where the host they run under is; `sdk-runtime` tests its host and its
  prelude.

**Phase 3c, folded into 4 to 6.** Measured on 2026-11-05: the server's types sit in five files of `sdk-shared` that
reference each other (`ServerTypes`, `ServerConfigTypes`, `ServerAdapterTypes`, `ServerLogTypes`, `OAuthTypes`), and
three of them also hold vocabulary the browser reads (`PluginSource`, `PluginEntry`, `SpaceScope`, `SSRUser`, `RunUser`,
`SSRRscData`, `SpaceRevision`). With no package to take them before phase 4, moving them now would move them twice, and
change the MCP's imports twice. So each package takes its own types as it is extracted:
- phase 6, with the configuration's split (D12): the kernel takes the pipeline's, identity's, the log's
  (`ServerLogTypes`) and OAuth's (`OAuthTypes`); `sdk-actions` takes `JobQueue` and the action-run log events;
  `sdk-server` the page server's configuration. Not phase 4, which moved the code: see above;
- `sdk-shared` keeps the vocabulary the browser reads, and the protocol (D5).

**Phase 6, in the order it is built** (each step green before the next; steps 1 to 5 done 2026-11-05, and step 6's
store: `packages/sdk-actions` holds the engine (root, `./functions`, `./runtimes`, `./realtime`, `./render`, `./worker`,
`./mysql`, `./mongo`, `./sqlite`), `sdk-server` re-exports none of it and has it as an optional peer, and the account
store with its persistence types is `@plitzi/sdk-kernel/mysql` and `./identity`; step 7 too: `createWorker`
(`@plitzi/sdk-actions/worker`) on the kernel alone, taking the one `identity` (`RequestIdentity`, which `createAuth`'s
`ssrIdentityAdapters` is); step 9 too: `plitzi upgrade`'s `platformServer` and `movedExports`, the docs, and
`platform.split.test.ts` (pages on `createServer` with `engineOnWorker`, actions on `createWorker`, a gateway by
path); and step 8: the server's types are `@plitzi/sdk-kernel/types` (the pipeline, the adapters and what they are
asked with, `ServerBaseConfig`, the log's and OAuth's), `@plitzi/sdk-actions/types` (the job queue, `EngineOptions`,
`EngineConfig`) and `@plitzi/sdk-server`'s root (`SSRServerConfig`, the page server's own); `sdk-shared` keeps
`SSRUser`, `PluginSource`, `PluginEntry`, `SpaceScope`, `RunUser`, `SSRRenderResult`, `SSRRscData`, `SpaceRevision`,
the job's own record (`Job`, `JobTarget`, `SpaceJob`…) and `ServerFlags`, and `ServerConfigTypes`, `ServerLogTypes` and
`OAuthTypes` are gone from it. Two departures from the plan above: the log's vocabulary stays whole in the kernel
(a logger takes one union, the action-run events among them), and the types an adapter is asked with
(`SSRTemplateProps`, `SSRChangePage`, `SSRRscContext`, the component catalogue) go with `SSRAdapters` to the kernel,
which a worker and the MCP are handed too. The kernel's lint refuses any import of a package above it, types included.
Steps 1 to 4 — the page server
loads 10 modules of its own and 133 of `sdk-shared` at start, from 14 and 160; the pub/sub adapters went to the kernel
(`./pubsub`), shared by the cache bus and realtime; `loadFunctions` to `./functions`, the connectors to `./actions`):
1. What both halves read of a space's data (`dataDirLookup`, the data lookup's type) to the kernel (`./data`).
2. `PageEngine` in `sdk-server`: what a page server is handed of the engine — its stages (`/_action`, webhooks, `/fn/`,
   `/_realtime`), the WebSocket paths among them, the resolver of elements that name an action or a connector, its
   part in the server's life (jobs), the fleet's stores, plugins' functions, and what a page is told (the action and
   realtime paths). `SSRContext` loses `actions` and `realtime`; the engine's side builds it (`createPageEngine`).
3. `createPlatform` (`./platform`) composes the two; `createServer` refuses `action`, `functions`, `connectors` and
   `realtime`, naming `createPlatform`. Every caller moves.
4. The import test: `sdk-server`'s root and `./ssr` never reach the engine.
5. `packages/sdk-actions` extracted (the engine, the host side of functions and runtimes, the connectors, realtime, the
   stock queues and kv stores).
6. The identity store to the kernel (`./mysql`, §11 Q7) and the one `identity` object (§11 Q6).
7. `createWorker()`, and the worker role switched to it.
8. The types of D12 out of `sdk-shared`.
9. The CLI's `upgrade` for a server file, the docs, the examples, the split-topology e2e.

**Phase 6 in detail:**
- the page server reaches the engine only through `stages`, the render resolver (§4.3) and the fleet catalogue: no
  file of `core/`, `modules/rsc` or `modules/ssr` imports the actions module, and an import test in `sdk-server` holds
  its root and `./ssr` to never reaching it;
- composition gathered in `hosts/` and `createPlatform`;
- the engine, the host side of functions and runtimes, the connectors and the stock stores move;
- `createWorker()` and the in-process render resolver are added;
- `createServer` loses `action` and `functions`, and `createPlatform` composes (D12);
- `sdk-server` declares `sdk-actions` and `sdk-runtime` as optional peers (D11);
- the worker role switches from phase 1's configuration to `createWorker`;
- the CLI's `upgrade` migrates a project's server file.

**Phase 11 as done.** Beyond the plan: `security`, `state`, `theme` and `network` mixed what a server reads with what a
page draws or keeps in a store, so each was split at that line — the Trusted Types policies' names to `helpers`, the
persisted state to `store`, the theme's and network's React parts to `theme/react` and `network/react` (the `<area>/react`
convention). That took nexus and zod off the page server, and React off the CLI. `sdk-interactions` and `sdk-style` declare
nexus, which they hold stores with. The evaluator is `evaluateRules` in `conditions`; `evaluateRuleGroup` is what every
reader calls, with `{ whenMissing }` for a binding's condition.

**Phase 11 in detail:**
- the generic helpers and the rule evaluator copied, and a lint rule refusing plitzi-ui's evaluator in the workspace;
- the three direct users of the evaluator moved to `evaluateRuleGroup`, and the type test between `sdk-shared`'s
  condition types and plitzi-ui's QueryBuilder props;
- React-only helpers out of `/helpers`;
- React, React DOM and nexus as optional peers;
- an import test in `sdk-shared`: its server-safe folders never reach `react`, `react-dom`, `@plitzi/nexus` or
  `@plitzi/plitzi-ui` at run time.

**Phases 3c to 6, and 11, cross repositories.** For each one:
1. The workspace publishes the new package together with the ones it touches, in one changeset.
2. The hosted platform drops any portals, runs `yarn up '@plitzi/*'`, and changes its imports (the 67 seed files, its
   entrypoints and its services) in the same commit.
3. Its seeds are then authored again at 0 warnings and 0 suggestions.

Until step 2 the hosted platform stays on the previous versions; nothing half-updated is deployed.

**Two more orderings:**
- If the black boxes hurt sooner, phase 8 can move ahead of phases 5 to 7. It needs only phase 4, for its recorder.
- Phase 1 is configuration, not a shim. Phase 6 changes only which entrypoint the worker role starts.

**Deferred, each with its trigger:**
- **The egress proxy** (D9): §8's fetch row shows the worker's CPU or memory going to fetches made on the runners'
  behalf.
- **`/_metrics`** (§7.2): an operator wants the history in an existing metrics stack.

## 10. Costs and risks

- **Splitting identity is the delicate part.** Verifying a session and signing in share types and files today, and
  the signing algorithm changes with them (D15). A mistake there is a security bug, not a broken build.
  - Phase 3b does both in place, on their own, so the auth e2e runs against the split before any package exists.
  - Phase 4 then only moves files.
- **Three new packages released with `sdk-server` and `sdk-shared`** whenever the protocol or the kernel changes. The
  workspace already releases in one go (one changeset). No further package is planned: composition lives in
  `sdk-server`'s subpaths.
- **Processes of different versions meet** once they deploy apart. D14's version and deploy order cover the
  protocol; a refusal names both versions rather than failing at random.
- **Until phase 11, a runner and a worker install React and plitzi-ui** through `sdk-shared`, though they never load
  them. Their images reach their floor only then.
- **A breaking change in plitzi-ui** (the evaluator's export, D13), released before the workspace's phase 11.
- **~500 lines of generic helpers exist twice** from phase 11, in plitzi-ui and in `sdk-shared`. They carry no Plitzi
  rule. The evaluator, which does, exists once.
- **A breaking configuration change for self-hosters** (D12), migrated by the CLI's `upgrade`.
- **Optional peers move a duty to the consumer.** A one-process deployment must install `sdk-actions` and
  `sdk-runtime`, and `createPlatform` refuses with the package's name when one is missing. From phase 11, a package
  that renders must declare React and nexus itself; every rendering consumer in the workspace already does.
- **A rule to reword in the hosted platform.** "Everything auth is sdk-server's" becomes "everything auth is the
  platform packages'": the kernel verifies, `sdk-server` signs in. The intent is unchanged: no auth logic in the
  deployment's repository.
- **A worker on another origin** depends on cookies and CORS being set right (§4.4). Same origin through a proxy is the
  default for that reason.
- **The stores are the real ceiling.** Any number of workers and runners still meet Redis and MySQL, and each replica
  opens its own pools.
- **A big diff.** Phases 3a to 3c exist so the cut is seen and enforced before anything moves. Phases 4 to 6 are then
  mostly moves.

## 11. Open questions

1. **Realtime (`/_realtime`).** Decided 2026-11-05: **it goes with the worker**, into `sdk-actions`, its kv with it, so
   the page server holds only short requests. The gateway and the ingress send `/_realtime` where they send `/_action`;
   a page is still told the path and the transport by its configuration.
2. **What a runtime may import once it has its own image.** Today its bundle leaves every `@plitzi/*` package and React
   to its host (§2.2), so a slim image that does not provide them breaks it. Leaning towards the runtime's bundle
   carrying whatever its project declares, as the CLI bundles plugins, rather than a fixed list the image provides. It
   must be settled before phase 10.
3. **The builder's test runs:** API or worker. Leaning towards the worker, so that a test run meets every check a
   visitor's call does, in the process where calls run.
4. **The worker's autoscaling signal.** CPU underestimates an I/O-bound process. The candidates are runs in flight
   against slots, or the job queue's depth, both in `ProcessStats`. Until an orchestrator reads one, the scaler's
   floor (§7.3) covers it.
5. **Shared read calls.**
   - The idea: a `call` trigger declares that it is shared, as a render may (joined in flight, kept for
     `cacheSeconds`), so identical calls from many visitors cost one run instead of being refused.
   - What is unproven:
     - that sdk-authoring can tell for certain that a flow reads nothing of its caller. Caller data can arrive
       indirectly, through the browser's input or through providers resolved before the call;
     - that such calls are common.
   - Before it becomes a phase: count the seeds' calls that would qualify, and list every way caller data reaches a
     flow.
6. **The kernel's identity adapters.** Decided 2026-11-05: **one object.** The kernel defines the identity adapters
   (who a request is, whether a session is still live, the visitor's roles) as one type, and `createServer` and
   `createWorker` take the same `identity`, which `createAuth` produces.
7. **Where the identity store goes.** `createMysqlStore` holds accounts and sessions. A worker with MySQL-backed auth
   must read sessions from it without installing `sdk-server`.
   - **(a)** The whole store moves to `sdk-kernel` (`./mysql`). The kernel only reads through it; `sdk-server` writes
     accounts through it. The tables stay defined in one place.
   - **(b)** The store is split into a reading half (kernel) and a writing half (`sdk-server`), over the same tables.

   Decided 2026-11-05: **(a)**, so the schema has one owner. It puts account persistence, not sign-in logic, in the
   kernel.
8. **What a successful run's log keeps.** Each run writes its whole trace, which costs the worker CPU and the store
   room. Keeping the whole trace for failures and a summary for successes would save both, but it changes what the run
   history shows. It is a product decision, not an optimization.

## 12. When this ships

As the RFC README says, this file is deleted, and what it knew moves to where it stays true:
- **How to write functions and runtimes against `sdk-runtime`:** `docs/en/functions.md` and `runtimes.md`.
- **Actions, their ceilings, running the worker and the deploy order:** `docs/en/server-actions.md` and `sdk-actions`'
  README.
- **The one-process default (`createPlatform`), how to split, actions elsewhere, and what each process is given:**
  `apps/server/README.md`, the new package READMEs and the self-hosting examples.
- **Pools and `/_stats`:** `sdk-kernel`'s README.
- **What `sdk-shared` asks of its consumers** (`./functions` and who may import it, the optional peers, the
  server-safe folders): its README.
- **Why the cut is by trust, why the protocol is in `sdk-shared`, why the kernel takes only types, why identity is
  split where it is, and why signing is asymmetric:** comments at the lint rules, the import tests and the code that
  enforce them.
