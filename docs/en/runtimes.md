# Space runtimes

A space's own server code, run as **a process of its own** beside the platform that serves the space. It is for what
[functions](./functions.md) cannot be: Node and the packages it installs, connections that stay open, state that
outlives a request, an endpoint that streams — an AI agent's session on a whiteboard, a queue consumer, a protocol of
its own.

The platform keeps serving the space: its pages, the flows authored in the builder, its credentials, its visitors, its
run history. The runtime only runs code — its tasks and routes, with the **platform's** `ctx`, and the paths it answers
itself. [`examples/self-hosting/10-runtime`](../../examples/self-hosting/10-runtime) is the smallest one — a task, a
route and a stream held open — loaded into a server of its own; Pizarra, the collaborative whiteboard on the platform
(`pizarra.plitzi.app`), is a whole product built this way.

## 1. What you write

A module whose default export is `defineRuntime`, from `@plitzi/sdk-server/runtime`:

```ts
import { defineRuntime } from '@plitzi/sdk-server/runtime';

import { createAgentEndpoint } from './agent';
import { createBoardFunctions } from './tasks';

export default defineRuntime({
  start: ({ env, publicUrl }) => {
    const store = connectTo(env.REDIS_URL);
    const agents = createAgentEndpoint({ store, publicUrl });

    return {
      functions: createBoardFunctions({ store }),
      endpoints: { '/mcp': agents.handle },
      close: async () => {
        await agents.close();
        await store.quit();
      }
    };
  }
});
```

`start` is called once, when the runtime starts, with:

| | |
|---|---|
| `env` | Its **variables** — set in the builder (Runtime → Variables) or with `plitzi runtime vars set`, kept encrypted, handed to this runtime alone. Self-hosted, the server's own environment |
| `publicUrl` | Where people reach the space — what a link written for a person, or an agent, is handed |

It answers what the runtime serves:

| | |
|---|---|
| `functions` | A `defineFunctions(…)` definition: tasks and `/fn/` routes, exactly as [functions](./functions.md) are written. Their `ctx` is the platform's — the space's `kv`, its channels, `ctx.sign`, `ctx.rateLimit` — over the same protocol the sandbox uses |
| `endpoints` | Paths the runtime answers itself, each a web handler `(request: Request) => Response`, streaming if it likes. A path answers everything beneath it (`/mcp` answers `/mcp/…`) |
| `close` | Called when it is stopped |

An endpoint never receives the visitor's `Cookie` or `Authorization`, nor a platform credential in the query
(`access-token`): the host's session is the platform's. It may not take a path the server answers itself — `/fn`,
anything under `/_`, `/auth`, `/.well-known`.

## 2. On the platform

**Its code lives in a project of yours** — a folder, usually a repository — and is sent from there: the builder shows
how a runtime runs and sets its variables, but it does not hold its code and cannot change it. The project needs
`src/runtime.ts` (the module above) and `@plitzi/sdk-server` installed: one made with `plitzi create` in server mode
has it, and [`examples/self-hosting/10-runtime`](../../examples/self-hosting/10-runtime) is the smallest one to start
from — it also runs as a server of its own. From that project, signed in (`plitzi login`) with the space chosen
(`plitzi space`):

```bash
plitzi runtime push                  # packs src/runtime.ts (or --entry) and keeps it as the space's draft runtime
plitzi runtime status                # how each environment's runtime is, and its variables' names
printf %s "$URL" | plitzi runtime vars set REDIS_URL   # a value from stdin stays out of the shell history
plitzi runtime vars unset REDIS_URL
plitzi runtime size medium           # the size the draft's runtime runs at (--environment for a published one)
plitzi runtime stop                  # stopped, and kept stopped until started (--environment as above)
plitzi runtime start                 # started again — one stopped by hand, or for going unused
```

- **Publishing is deploying.** A push is the draft's runtime (`main`); publishing the space copies its code into the
  revision, and the published site's runtime restarts on it — the pages, their flows and the code they call ship
  together.
- **Its source goes up with it.** `plitzi runtime push` also keeps the source it was packed from — every file of the
  project the module reaches, followed from its entry, and the packages they import — in the same private bucket, and
  a publish freezes it with the code. That is what `plitzi create --from` brings back as `src/runtime.ts` and the files
  it imports, run in the project's own process with `serveRuntime`: see [A space as a project](./projects-from-spaces.md).
  A source that cannot be kept (a credential in it, a file outside the project) never undoes the push; the CLI says why.
- **The builder shows it.** **Server → Runtime**, in the left sidebar: each environment's code, whether it runs, why not, its tasks
  and endpoints — and the variables, by name. A value is written and never read back.
- **It is part of the plans that carry `spaceRuntimes`.** A push on another plan is refused with the reason.
- **Its code is kept in a private bucket of the space's CDN** — your own storage account, which holds as many buckets
  as you give it. Server code never goes in a public one: in the builder's **Assets → Files**, add a bucket with its visibility
  set to **Private** — no public access; the platform reads it with the CDN's credential. A push to a space without one
  is refused, saying so; with several, the oldest is used. The code is named there by what it holds, so a
  publish copies a name, not the code; **Assets → Files** lists it under **Server code** with the versions that run it, and what
  no version runs any more can be removed from there.
- **It runs at a size** — small (0.25 CPU, 256 MB), medium (0.5 CPU, 512 MB) or large (1 CPU, 1 GB) — chosen per
  environment among the sizes its plan includes: in the builder's **Server → Runtime**, which shows what each environment runs
  at, or with `plitzi runtime size <size> [--environment <name>]`. Changing it starts that runtime again at it.
- **An unused runtime stops by itself**, so it spends nothing idle: nothing forwarded to its endpoints and no task run
  on it for a while (a week on the platform, where runtimes come with the paying plans), and it is stopped until
  somebody starts it again — the builder's Start, `plitzi runtime start`, or a push or a publish. The builder's header
  says so a day before, with a way to keep it running. While stopped, its endpoints answer 503 and its tasks refuse, each saying it is stopped.

What is pushed is packed with the project's own `@plitzi/sdk-server` (`packRuntime`): the module and every package it
imports, for Node, gzipped — at most 32 MB — except `@plitzi/*`, `react` and `react-dom`, which the runtime's host
provides so there is one copy of each. The platform reads a packed runtime's shape and never runs any of it.

## 3. What a runtime can reach

A runtime runs in its own box. On the platform's cluster that is a pod of its own in the `plitzi-runtimes` namespace:

- **sandboxed by gVisor** — the space's code talks to a kernel in user space, not the node's;
- **reached by the platform alone** — the roles that forward to it and run its tasks, behind a secret of its own;
- **reaching** DNS, the platform's api (for its own code, and nothing else of it), the ingress (its own space, as the
  Internet reaches it — without leaving through the edge to come back) and the Internet — no private range, so none of
  the cluster: not the databases, not the platform's roles, not another space's runtime;
- **holding** its launch, its secret and its variables — never the platform's configuration, keys or a token for the
  cluster's API. Its filesystem is read-only but for the directory its code is written to.

The platform's side of every call is the one that decides: a task's `ctx` call is answered by the platform, scoped to
the space, with every rule a function's call meets.

## 4. What it is not

- **Not a renderer.** The platform renders the space's pages; the runtime's code never enters the shared renderer, so
  elements of the space's own (plugins on its CDN) render in the browser, as any remote plugin does.
- **Not the platform's data.** Its `ctx.kv` is the space's; anything else it keeps — pictures, sessions, a queue —
  is in stores it brings, through its variables.
- **Not one replica per visitor.** One runtime per environment of the space. Code that needs several says so with its
  own stores, as a self-hosted replica set does.

## 5. Self-hosted: the same module

A server of your own loads the module with `serveRuntime` — its functions natively, its endpoints as a stage:

```ts
import { createServer } from '@plitzi/sdk-server';
import { serveRuntime } from '@plitzi/sdk-server/runtime';

import runtime from './runtime';

const served = await serveRuntime(runtime, { env: process.env, publicUrl: 'https://boards.example.com' });
const server = createServer(
  { /* … */ functions: { native: served.native }, action: { /* … */ } },
  { preAuth: [served.stage] }
);
```

`examples/self-hosting/10-runtime`'s `main.ts` is exactly this: the server the platform would be (its `kv`, its
actions) and its runtime loaded into it, its variables this process's environment.

## 6. For a deployment

A deployment of the platform runs the runtimes with an orchestrator, in its api role:

| | |
|---|---|
| `startSpaceRuntime({ runtime, secret, env, publicUrl, insideUrl? })` | The host: starts a runtime and serves it — its tasks over the functions runners' protocol (`createRemoteRunner` reaches it), its endpoints as HTTP, both behind `secret` |
| `await reachSpaceInside({ publicUrl, insideUrl })` | What `insideUrl` does: every `fetch` and `WebSocket` the process opens to the space's host connects to `insideUrl` instead — plain HTTP, the host and `X-Forwarded-Proto` kept. The space's code keeps writing its public address; the request stops going out through the edge to come back. It loads `undici` only when called — importing the package replaces the process's dispatcher, which the page server that loads this entry must keep |
| `createRuntimeProxyStage({ lookup })` | A page-server stage: a space's declared endpoints forwarded to its runtime, streamed both ways |
| `SpaceFunctions.runner` | A space's functions answered by its runtime instead of the sandbox: `lookups.getFunctions` hands one per space |
| `packRuntime` / `inspectRuntime` / `loadRuntime` | A runtime packed, read without running it, and loaded where the host resolves its packages |

`plitzi-sdk-server` is the reference: `services/runtimes` (the orchestrator, with a `local` driver — child processes
beside `yarn start` — and a `k8s` one), `entrypoints/spaceRuntime.ts` (the host) and the `space_runtime*` tables.

Locally, spaces answer at `<permanentUrl>.plitzi.local`, which the development certificate covers — one `/etc/hosts`
line (`127.0.0.1 pizarra.plitzi.local`) and a runtime's public address resolves on the machine that runs it.
