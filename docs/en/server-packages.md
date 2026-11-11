# Why the server is in packages

The server side is four packages and a composition, not one: `@plitzi/sdk-kernel` (what makes a server),
`@plitzi/sdk-runtime` (what runs an author's code, with no access), `@plitzi/sdk-actions` (the actions engine and its
server, the worker) and `@plitzi/sdk-server` (pages, RSC and signing in, and the subpaths that compose the rest). This
page keeps **why** — the decisions, numbered as the code's comments cite them (`D3`, `D13`), what was measured, and
what was left for later with its trigger. **How** to use each is its own page:

- writing functions and runtimes: [functions](./functions.md), [runtimes](./runtimes.md);
- actions, their ceilings, the worker and the deploy order: [server actions](./server-actions.md) and `sdk-actions`'
  README;
- one process (`createPlatform`), splitting it, actions on another origin: `apps/server/README.md` and the self-hosting
  examples;
- pools and `/_stats`: `sdk-kernel`'s README; what `sdk-shared` asks of its consumers: its README.

## The direction

```
sdk-kernel ◄──────────────┬─────────────────┬──────────────────┐
  servers: HTTP,          │                 │                  │
  identity, stats    sdk-runtime       sdk-actions       sdk-server ── composition subpaths only ──► sdk-runtime,
  (types only ↓)     guest: no access  host: engine,     pages, rsc,                                 sdk-actions
sdk-shared ◄──────────────┴─────────────────┴──────────────────┘    sign-in
  vocabulary + ./functions (the protocol)
```

Nothing points back: a worker or a runner never installs pages or signing in. The lint rules and the import tests named
below hold it.

## Decisions

- **D1 — Actions and functions stay two layers.** An action is what the platform runs on the author's behalf, with
  secrets, vetted tasks and guards; a function is the author's code, given nothing. What separates them is trust:
  merging them gives the author's code the secrets, or makes every no-code flow code.
- **D2 — Actions do not run in the functions runner.** Their tasks run where the secrets and the data are; in the
  runner the platform would still do the I/O, and the runner would hold an isolate while it waited. **An action runs
  where its data is; the author's code runs where there is no data.**
- **D3 — `sdk-kernel` holds what makes a server, and takes only types from Plitzi's vocabulary.** The HTTP server, the
  stages, the fleet, health and shutdown, security headers, CORS and CSRF, the host → deployment stage, the logger and
  the outbound guard, stats, and **verifying** who a request is. **Signing in** is `sdk-server`'s. The kernel answers
  "who is this request?", never "let this person in". A lint rule refuses any value import of `@plitzi/*` in it;
  `esbuild` is an optional peer of its `./build`.
- **D4 — The code is cut by trust (guest and host), not by feature.** Half of the functions module is host side: cut
  by feature, two packages would import each other.
- **D5 — The protocol lives in `sdk-shared/functions`**, so the guest and the host never depend on each other: the wire
  messages, the `FunctionRunner` interface, the `ctx` types and a functions definition's shape. Imported by both sides
  → there. A reach test holds the folder to loading no other package.
- **D6 — One direction** (above).
- **D7 — `sdk-actions` is named for the engine, not a process**: the worker, the API and a one-process deployment all
  use it.
- **D8 — The worker is `sdk-actions`' own server, `createWorker()`, on the kernel**: `/_action`, webhooks, `/fn/`,
  realtime and the job queue, and nothing of pages. "Runner" means no access: the worker never runs an author's code,
  and lint rules keep `sdk-runtime` from credentials and stores and `sdk-actions` from the sandbox.
- **D9 — Secrets stay in the trusted plane; the egress proxy waits for its trigger** (below).
- **D10 — No compatibility layer**: the imports changed in one change, everywhere; no package re-exports another's.
- **D11 — One process can still run everything**, through `sdk-server`'s composition subpaths (`./platform`,
  `./project`, `./bundle`) and nowhere else. A page server's entries never reach `sdk-actions` or `sdk-runtime` (an
  import test follows them), and both are optional peers, so one deployed alone installs neither;
  `createPlatform` without them refuses, naming the package.
- **D12 — Each package owns its configuration and its types.** `createServer` takes pages, RSC and signing in;
  `createWorker` and `createActionsModule` the actions and functions; the server-only types left `sdk-shared`, which
  keeps what the browser also reads. The CLI's `upgrade` migrates a project's server file.
- **D13 — `sdk-shared` is cheap to depend on**: no plitzi-ui, React, React DOM and nexus optional peers, the generic
  helpers copied into a server-safe folder, and the rule evaluator copied with Plitzi reading only its own
  (`evaluateRuleGroup`, `@plitzi/sdk-shared/conditions`) so the preview and the server never decide one condition two
  ways. `src/serverSafe.test.ts` holds the server-safe folders to none of them.
- **D14 — Protocols are `major.minor` and tolerate additions**, because the processes no longer ship together: a
  major not spoken is refused naming both versions and the side to upgrade. The same for the remote render resolver and
  `/_stats`' document. **Deploy order: runners, then workers, then page servers.**
- **D15 — Sessions and tokens are signed with ES256**, the private key with whoever signs people in and the public keys
  with every verifier, by key id: a worker that is compromised reads sessions and never mints one, and a key rotates
  without signing everybody out.

Settled on the way: realtime goes with the worker; the kernel's identity adapters are one object (`identity`), taken by
`createServer` and `createWorker` alike; the identity store (`createMysqlStore`) is the kernel's, so its tables have one
owner and a worker reads sessions without installing `sdk-server`.

## What was measured

On a laptop, production builds, the bench at the `standard` profile (1 CPU, 512 MB). The machine moves a run by
±12 %: a before and an after are measured the same afternoon, one after the other.

| | CPU per request | Requests a second | Memory |
|---|---|---|---|
| A page rendered, before the split | 1.44–1.69 ms | 620–700 | |
| A page rendered, after it (2026-11-11) | 1.53–1.78 ms | 625–650 | |
| A page from the cache | 0.10–0.13 ms | ~8,000–10,000 | ~95 MB |
| A typical call (`kv.increment` and a template) | 0.11–0.15 ms | ~8,700 | ~105 MB |

- **A call costs a tenth of a render**, so visitors' calls do not saturate a page server: the case for the worker is
  isolation — one call reading a large answer holds the event loop of every render in flight — not CPU.
- **Reading a large answer** (`http.request`): 1 MB blocks the loop 9 ms, 5 MB 20 ms, 20 MB 102 ms, the heap held up to
  ~4× the body. No ceiling per run bounds a process alone, so `maxRunBytes` (10 MB) goes with **admission by memory**
  (`concurrency.memoryShare`): past its share a process refuses a new run as `over_capacity`, with a retry.
- **A function through the remote runner**: ~2.4 ms; transport is a quarter of it, starting the isolate and the guest
  three quarters, a `ctx` call ~0.06 ms. A fresh context in a kept isolate would save most of the start (0.57 → 0.25
  ms): the lever worth its security review.
- **Process memory**: a worker 160 MB with `createWorker` alone, ~185–190 MB with the hosted platform's lookups
  (Prisma, Mongo, Redis), ready in ~1 s; a page server 187 MB.
- **The one regression the split was suspected of** was not the split's: the page's icon faces resolved the SDK's folder
  on every render. A CPU profile of both named it, where bisecting 165 commits would have taken an hour.

## Left for later, each with its trigger

- **The egress proxy** (D9): the worker's CPU or memory going to fetches made on the runners' behalf.
- **`/_metrics`**: an operator wants the history in an existing metrics stack.
- **A kept isolate with a fresh context**: its security review, against the runner's own snapshot.
- **Shared read calls** (a `call` joined in flight and kept, as a render may be): first count the seeds' calls that
  would qualify and list every way a caller's data reaches a flow.
- **A successful run's log as a summary**: a product decision — it changes what the run history shows.
- **The worker's autoscaling signal**: runs in flight against slots, or the queue's depth, once an orchestrator reads
  one; until then the scaler's floor.
