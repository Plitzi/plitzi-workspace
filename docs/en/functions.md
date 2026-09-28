# Functions: a space's own server code

When no server task does what a flow needs — parse a feed, call an API with its own shape, compute something — a
space can have its own: **functions**, TypeScript the platform builds and runs in a sandbox. A function's **tasks** are
steps like any other (`<namespace>.<action>` in an action's flow); its **routes** answer HTTP under `/api/` on the
space's own host.

Running them is part of the paid plans (Lifetime included); on any plan they can be written and saved, and a run
answers why it did not start.

- [1. What you write](#1-what-you-write)
- [2. What a function can do: `ctx`](#2-what-a-function-can-do-ctx)
- [3. Where you write it](#3-where-you-write-it)
- [4. Trying it, and what ships](#4-trying-it-and-what-ships)
- [5. Routes under `/api/`](#5-routes-under-api)
- [6. Limits](#6-limits)
- [7. Security: why one space cannot reach another](#7-security-why-one-space-cannot-reach-another)
- [8. For a deployment](#8-for-a-deployment)
- [9. What still needs a server of your own](#9-what-still-needs-a-server-of-your-own)

## 1. What you write

A space's functions are a handful of files under `functions/`. `index.ts` exports the definition by default:

```ts
import { defineFunctions } from '@plitzi/sdk-server/functions';
import { parseFeed } from './lib/feed';

export default defineFunctions({
  // The hosts ctx.fetch may reach. Anything else is refused before it leaves: 'api.example.com', '*.example.com'.
  allow: { hosts: ['earthquake.usgs.gov'] },
  tasks: [
    {
      namespace: 'seismic',
      action: 'feed',
      title: 'Earthquake Feed',
      description: 'The last day of earthquakes, strongest first.',
      params: { minMagnitude: { type: 'text', label: 'Minimum magnitude', defaultValue: '2.5', canBind: true } },
      run: async ({ minMagnitude }: { minMagnitude: string }, ctx) => {
        const response = await ctx.fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
        ctx.log('feed', response.status);

        return parseFeed(await response.json(), Number(minMagnitude));
      }
    }
  ],
  routes: {
    'GET /quakes/:id': async (request, ctx) => Response.json({ id: ctx.params.id })
  }
});
```

- **Files import each other by relative path**, and `@plitzi/sdk-server/functions` — nothing else: no package, no
  Node built-in (`fs`, `process`, `Buffer`). Saving refuses anything else, with the file and line.
- **Web-standard only.** `Request`, `Response`, `Headers`, `URL`, `URLSearchParams`, `TextEncoder`/`TextDecoder`,
  `AbortController`/`AbortSignal`, `setTimeout`, `structuredClone`, `atob`/`btoa`, `crypto.randomUUID`,
  `crypto.getRandomValues` and `crypto.subtle` — digests, HMAC (what verifying a webhook needs) and PBKDF2
  (`deriveBits`, or `deriveKey` to an HMAC key: what keeping a password needs). A body is text or bytes: there are no
  streams, `Blob` or `FormData`. That is what lets the same bundle run on any runner (§8).
- **A derivation is the run's CPU.** The runner does PBKDF2 outside the isolate, so what it takes is added to the
  run's CPU time and counts against its limit and the plan's budget; one derivation is at most 1,000,000 iterations
  and 1024 bits. Pick the iterations that fit the budget on the machine the runner is on: the cost is linear in them,
  so time one call (`Date.now()` before and after) and scale.
- **A password hash is compared in constant time**: `crypto.subtle` has no `timingSafeEqual`, so XOR every byte and
  check the total is zero — or derive an HMAC key and let `crypto.subtle.verify` compare.
- **A task is a step.** `params` are drawn in the action editor the way any step's are — static ones only: a computed
  `type`, `when` or `options` is code, and the builder never runs a space's code. A namespace the platform uses (`kv`,
  `list`, `http`, `flow`, `realtime`, `email`, …) is refused.
- **The whole bundle is at most 1 MB** once built.

## 2. What a function can do: `ctx`

Everything a function does besides computing goes through `ctx` — the same object natively and in the sandbox.

| | |
|---|---|
| `ctx.kv` | The space's key/value store: `get`, `set`, `delete`, `increment`, `swap` (compare-and-set), `change` (read, change and write back — again when somebody wrote first) and scored lists (`listPut`, `listRange`, `listRemove`) — the same store the `kv.*` and `list.*` steps use |
| `ctx.rateLimit(bucket, { most, perSeconds, per })` | Counts one more and answers `{ allowed, count, remaining }` — per caller, or `per: 'everyone'`. The same count as `flow.rateLimit` on that bucket; what to answer past it is the code's |
| `ctx.sign(value)`, `ctx.verify(value, signature)` | HMAC-SHA-256 with a key of the space's own that the platform keeps: a link, an invitation, a key handed to a page. The code never holds the key, and what one space or environment signed no other verifies |
| `ctx.fetch(url, init)` | To the hosts in `allow.hosts` only (`*.example.com` is every subdomain of it, not `example.com` itself), through the platform's outbound guard: private and cluster addresses are refused whatever you declare |
| `ctx.publish`, `ctx.grant`, `ctx.revoke` | The space's realtime channels, as the server — see [Realtime channels](./realtime.md) |
| `ctx.user` | Who asked — `id`, `username`, `email`, `verified`, `roles`, `permissions` — never their session |
| `ctx.callerId` | `user:<id>` or `ip:<address>`: what a limit per person keys on |
| `ctx.log(...)` | A line on the step that ran it: shown by Try, and in the run history |
| `ctx.emit(chunk)` | Progress for a caller that asked for a stream |
| `ctx.signal` | Aborted when the run is — cancelled, or out of time |

**Changing a value two people may change at once** is `ctx.kv.change`: it reads, hands the value to your function, and
writes back what it answers only if nobody wrote in between — otherwise it reads again and asks again. Answer
`undefined` to write nothing; the lifetime may be worked out from what is written:

```ts
const board = await ctx.kv.change(`board:${id}`, current => ({ ...asBoard(current), title }), next => ttlOf(next));
```

The function may run more than once, so it only computes: anything it must do once goes after.

**Refusing is `ActionRefusal`**, from `@plitzi/sdk-server/functions`: throw it with a reason written for whoever
asked, and the page reads it as the step's error (`{{ step.error }}`) — a route answers it with a `400` and
`{ "error": … }`. Anything else a function throws stays in the run's record and the caller only learns that it failed:
an error can carry a query, a URL or a credential's name, and a page is read by anybody.

```ts
import { ActionRefusal, defineFunctions } from '@plitzi/sdk-server/functions';

if (!(await ctx.rateLimit(`open:${id}`, { most: 10, perSeconds: 300 })).allowed) {
  throw new ActionRefusal('Too many tries — wait a few minutes and try again');
}
```

`ctx.kv.change` refuses the same way when others kept winning the value: `Many people are changing this at once`.

**Secrets are named, never read.** A function cannot see a credential's value. It names the credential, and the
platform writes its keys into the request where it says `{{ credential.<key> }}` — in the URL, a header or the body:

```ts
await ctx.fetch('https://api.stripe.com/v1/charges', {
  method: 'POST',
  credential: 'stripe',
  headers: { authorization: 'Bearer {{ credential.apiKey }}' },
  body: 'amount=1000&currency=eur'
});
```

The value never enters the code, and it is redacted from every trace and log.

The global `fetch` refuses: the network is reached through `ctx.fetch`, which knows the hosts a space declared.

## 3. Where you write it

One source — the space's `functions/` files — and three editors of it. They never disagree silently: a save is
refused when the space's copy changed since the editor read it.

**In the builder** — the **Functions** panel: the files, an editor with TypeScript that knows `ctx` (completion,
hover, errors as you type), **Save** (built and checked on the platform; what is wrong comes back under the file and
line), **Try**, and what the saved code declares (its steps, routes and hosts). A space with none starts from one file
and one task already written.

**In a project**, with the CLI:

```bash
plitzi functions pull        # the space's files into functions/ — refused if it would overwrite what is not pushed
plitzi functions push        # functions/ as the space's draft — refused if the space moved on since the pull
plitzi functions try seismic.feed --params '{"minMagnitude":"4"}'
plitzi functions dev seismic.feed --params '{}' --watch   # on this machine, as the platform runs it
```

`functions/` is a working copy: `.plitzi/functions.json` keeps what was pulled, so a pull knows what it would
overwrite. `dev` runs the files with the project's own `@plitzi/sdk-server` (install `isolated-vm` and `core-js` beside
it) — the same build, checks, isolates and limits as the platform; nothing reaches the space. Credentials for `dev`
come from `PLITZI_FUNCTIONS_CREDENTIALS`, a JSON object of credential id → its keys.

**By an agent**, over MCP: the `upsertFunctionFile` / `deleteFunctionFile` operations of `plitzi_apply`, the
`plitzi://functions/{env}` resources, and `plitzi_try_function`. The same build, checks and history as a person's —
see [AI agents](./mcp.md).

Every save is in the space's [change history](./history.md), file by file, with who made it.

## 4. Trying it, and what ships

**Try** runs one task of the saved draft, in the sandbox, as you: the value, what it logged, how long it took, why it
failed. It is a real run — its fetches and writes happen, it counts against the plan, it has the same limits.

The draft is what the builder, its preview and Try use. **Publishing the space freezes its functions with it**: the
live site runs what it was published with, never the draft, and rolling back is publishing an earlier revision.

## 5. Routes under `/api/`

A route is a web-standard handler — `(request, ctx) => Response` — keyed by method and path:
`'GET /boards/:board'` answers `GET /api/boards/kanban` with `ctx.params.board === 'kanban'`. Literal segments and
`:params`; methods `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

- **The visitor's credentials never reach it**: the `cookie` and `authorization` headers are removed. `ctx.user`
  is who the session says.
- **It sets no cookies**: `Set-Cookie` is dropped — the host's cookies are the platform's.
- An answer is `Cache-Control: no-store` unless the route says otherwise.
- A route that throws answers `500 {"error":"This route failed"}`; one stopped by a limit `503`. The reason is in the
  server's log, not in the answer.
- `/api` is never a page: a page (or folder) whose path falls under it is refused (`page-route-reserved`).

## 6. Limits

Per invocation — a task step or a route request:

| | Default | |
|---|---|---|
| CPU | 100 ms | awaits not counted |
| Wall time | 10 s | and never past the run's own deadline |
| Memory | 64 MB | |
| Answer | 1 MB | as JSON |
| Calls to `ctx` | 100 | `kv`, `fetch`, `publish`… |

Past one, the invocation stops and says which ("Stopped after 100 ms of CPU"). On top of them, an **account's
functions share a CPU budget per minute** (30 s by default): past it the next invocation is refused until the minute
turns, so one space's loop slows its own account and nobody else. Each deployment sets both (§8).

## 7. Security: why one space cannot reach another

- **Nothing is shared at run time.** Every invocation gets an isolate of its own, from a fresh heap; nothing it leaves
  is seen by the next, even of the same space.
- **Scope comes from the platform, never from the code.** The `kv` namespace, the channels and the credentials are
  chosen by the platform for the run; there is no argument a function can pass to reach another space's.
- **The runner holds nothing.** It is a process of its own with no database, no keys but the one the platform presents,
  and no network: every call a function makes goes back to the page server that invoked it.
- **Editing is a permission**: the same one as editing the space's actions (`spaceManage`), from a person or an agent's
  grant — and every version is in the history with its author.

## 8. For a deployment

Everything here is `@plitzi/sdk-server`'s.

**A self-hosted server's own functions** are loaded natively — trusted code, in the process. `loadFunctions` builds a
`functions/` folder the way the platform builds a space's (same files, same imports, same checks) and loads it:

```ts
import { createServer, loadFunctions } from '@plitzi/sdk-server';

const functions = await loadFunctions(new URL('../functions/', import.meta.url));

createServer({ /* … */ functions: { native: functions } });
```

A server project made by `plitzi create` already does this, so the files `plitzi functions pull` brings run there as
they run on the platform. A `defineFunctions({ … })` written in the server's own code goes in `native` the same way.
Their tasks join the catalog and their routes answer under `/api/` on every space the server serves. This replaces
the old `action.tasks`: a deployment's own tasks and a space's are written the same way.

**The spaces' functions** need a runner — `functions.runner`, any `FunctionRunner`:

| From `@plitzi/sdk-server/functions-runner` | |
|---|---|
| `startFunctionsRunnerService({ secret, port })` | The runner as a service of its own: V8 isolates (`isolated-vm`, with `core-js` for the web APIs a bare isolate lacks), one per invocation, behind a shared secret. Run it where it reaches nothing: its pod needs no network out |
| `createRemoteRunner({ url, secret })` | The page server's client to it: one WebSocket per invocation, over which every call the code makes comes back and is answered by the replica holding the run — so replicas share nothing about it |
| `createIsolateRunner()` | The isolates in the page server's own process — for tests, or a deployment whose process holds nothing a space must not reach |
| `createLocalFunctions()` | What `plitzi functions dev` runs: build, check and try a source on this machine |

Wherever isolates run, Node must start with **`--no-node-snapshot`** (`NODE_OPTIONS=--no-node-snapshot`):
isolated-vm crashes beside Node's own startup snapshot, so the runner refuses to start without it and says so.
`plitzi functions dev` runs itself again with it. The page servers that only hand code to a remote runner need nothing.

A space's functions reach a run through `action.lookups.getFunctions(spaceId, at)` — the bundle and what it declared
when it was saved, as of the revision the run belongs to. `actions.prepareFunctions(source)` is the one way to make
one: built, read by the runner and checked. `functions.limits` sets the per-invocation ceilings; `functions.admit` and
`functions.onUsage` are how a deployment budgets CPU across a space's account.

**What a runner keeps, and what it does not.** A function is stateless, like a Lambda: everything it needs comes in its
params and `ctx`, and anything that must outlive the invocation goes to `ctx.kv` — so any runner, any replica, can run
any invocation. What a runner keeps is only what makes the next start cheap:

- the web-API prelude as a V8 snapshot, made before the service listens — the first request does not pay for it;
- each bundle's compiled code, by size (`cacheBytes`, 64 MB), least recently used out. A run carries its bundle by
  reference (`FunctionsBundleRef`): the code crosses the wire, and is read from storage, only when the runner does not
  keep it.

Nothing waits forever: past its wall time an invocation's isolate is disposed, and the page server's client
(`createRemoteRunner`) gives up on the runner `graceMs` after that (5 s) even if the runner never answers — its
connection is closed and the step fails with `wall`.

The runner is an adapter: the same bundle runs on another one — a Cloudflare Workers for Platforms dispatcher, or a
Lambda per bundle — that implements `describe` and `invoke` over the same messages.

## 9. What still needs a server of your own

Functions answer a step or a request and are done. What does not fit that is a self-hosted `@plitzi/sdk-server`'s:

- anything that holds a connection or state across requests — an agent session living on one replica, a game loop,
  a long-running import;
- native dependencies, a filesystem, or more CPU than a plan's limit;
- code a deployment wants on its own machines, for any reason — self-hosting stays first-class, and the same
  `defineFunctions` file loads natively there (§8).

