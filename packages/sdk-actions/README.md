# @plitzi/sdk-actions

The actions engine: server actions, a space's functions and runtimes as the platform holds them, the connectors,
realtime, the jobs, and the stock queues and key/value stores. It holds a run and its secrets: the credentials a step
uses, the space's store, the run's log. What runs a space's own code is elsewhere (`@plitzi/sdk-runtime`), and is
handed to it as a runner; it imports nothing of that package, nor of the page server.

It runs in two ways:

- **Beside the pages, in one process.** `createPlatform` (`@plitzi/sdk-server/platform`) builds the engine and hands it to
  the page server.
- **As a worker of its own.** `createWorker` serves `/_action`, webhooks, `/fn/`, `/_realtime` and the jobs on
  `@plitzi/sdk-kernel` alone, beside the page servers or on another machine.

## Entries

| Entry | What it holds |
|---|---|
| `@plitzi/sdk-actions` | `createActionsModule`, the tasks and their catalogue, the kv stores (`createMemoryKv`, `createFileKv`, `createRedisKv`), the job queues and the scheduler, the run log (`createRunLogger`), the connectors |
| `@plitzi/sdk-actions/worker` | `createWorker`, `createPageEngine` (what a page server is handed), `engineOnWorker` (what it is handed when its actions run on a worker — with `render`, its server elements too) |
| `@plitzi/sdk-actions/functions` | The host side of functions: their configuration and limits, building and loading a definition (`buildFunctions`, `loadFunctions`), the remote runner's client, `createLocalFunctions` |
| `@plitzi/sdk-actions/runtimes` | A space's runtime as the platform reaches it: packing and loading one, `serveRuntime`, the proxy stage |
| `@plitzi/sdk-actions/realtime` | The realtime channels: the hub, presence, grants, the publishing side for a process that serves no page |
| `@plitzi/sdk-actions/render` | Resolving a page's server element that names an action or a connector: in this process (`createActionResolver`), or on a worker (`createRemoteRenderResolver`, asked at its `/_render` with `RENDER_PROTOCOL`) |
| `@plitzi/sdk-actions/types` | Types alone: the job queue's contract (`JobQueue`, `ActionSchedule`), the engine's configuration (`EngineOptions`, `EngineConfig`, `SSRActionConfig`) |
| `@plitzi/sdk-actions/mysql`, `/mongo`, `/sqlite` | The job queue and the kv store over a database the deployment owns |

## A worker

```ts
import { createWorker } from '@plitzi/sdk-actions/worker';

const worker = createWorker({
  adapters: { getSpaceDeployment, getOfflineData },
  identity: auth.ssrIdentityAdapters,
  action: { lookups, kv, jobs: { queue } },
  realtime: { pubsub }
});

await worker.listen(8892);
```

It resolves which space a host is and who is calling with the same adapters a page server has (`identity` is
`@plitzi/sdk-kernel/identity`'s `RequestIdentity`), so a gateway sends those paths of a space's host to it and the
browser sees one origin. Started with nothing of the engine to run, it refuses and says what to name.

The page servers beside it are told where their pages call (`engineOnWorker`), or run the engine for their own renders
too (`createPlatform` with `action.jobs.workers: 0`). The guide is `@plitzi/sdk-server`'s README, *Actions apart from
pages*, and `docs/en/server-actions.md`.

## What it may import

The kernel and `sdk-shared`. Never `@plitzi/sdk-server` nor `@plitzi/sdk-runtime`, types included: ESLint refuses them
outside its tests. `nodemailer` and `ws` are its own; `mysql2`, `mongodb` and `esbuild` are optional peers, each needed
only by the entry that uses it.
