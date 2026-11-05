# @plitzi/sdk-runtime

The contract a space's own code is written against, and what runs that code with no access: the functions runner, its
isolates, and the host a space's runtime runs in.

It holds nothing of a run. A run's secrets, its store and its log are the platform's, and every `ctx` call the code makes
is answered there. Neither the page server nor the actions engine is imported here, not even for their types.

## Entries

| Entry | What it holds |
|---|---|
| `@plitzi/sdk-runtime` | The contract: `defineFunctions`, `ActionRefusal`, the `ctx` types (`FunctionContext`, `FunctionTask`…), and `defineRuntime` with its types |
| `@plitzi/sdk-runtime/runner` | `startFunctionsRunnerService`, the runner as a service of its own, and `createIsolateRunner`, the same isolates in this process |
| `@plitzi/sdk-runtime/host` | `startSpaceRuntime`, the host a space's runtime runs in, and `createRuntimeRunner` |
| `@plitzi/sdk-runtime/functions-api.d.ts` | The contract as one declaration file, every type it reaches inlined: what the builder's editor types a space's code with |

## A space's functions

```ts
import { ActionRefusal, defineFunctions } from '@plitzi/sdk-runtime';

export default defineFunctions({
  tasks: [
    {
      namespace: 'shop',
      action: 'quote',
      title: 'Quote',
      params: {},
      run: async ({ zip }, ctx) => {
        if (typeof zip !== 'string') {
          throw new ActionRefusal('A quote needs a zip code');
        }

        return { zip, cents: Number(await ctx.kv.get(`rate:${zip}`)) };
      }
    }
  ]
});
```

Files import each other by relative path, and `@plitzi/sdk-runtime`: nothing else. The platform builds them and runs
the bundle in an isolate; a self-hosted server loads the same files natively. The whole guide is `docs/en/functions.md`.

## Running the code

The runner is a service of its own, behind a secret, in a process that reaches nothing:

```ts
import { startFunctionsRunnerService } from '@plitzi/sdk-runtime/runner';

const secret = process.env.RUNNER_SECRET;
if (!secret) {
  throw new Error('RUNNER_SECRET is the secret this runner shares with the platform alone');
}

await startFunctionsRunnerService({ secret, port: 8790 });
```

The isolates are `isolated-vm`'s, an optional peer: a process that runs them installs it and starts Node with
`--no-node-snapshot`. The web APIs a bare isolate lacks (`URL`, `atob`, `structuredClone`, `DOMException`) come built
in `dist/prelude.js`, so a runner installs neither core-js nor esbuild.

It answers `GET /health` for an orchestrator, and `GET /_stats` behind the same secret: its isolates in flight against
its `concurrency`, its invocations' outcomes, the protocol it speaks (`@plitzi/sdk-kernel/stats`). What it holds is its
isolates' budget — invocations at once × about twice `memoryMb` — so its levers are the plan's `memoryMb` (32 MB by
default), `concurrency`, `cacheBytes` (32 MB) and `memoryShare`, past which it answers `busy`; its own JavaScript is
little, so it starts well with `--max-semi-space-size=1` beside `--no-node-snapshot`.

What holds the runs is handed a runner, never builds one. The page server's `functions.runner` takes a
`createIsolateRunner()` or the remote client of `@plitzi/sdk-actions/functions`, and so does `createLocalFunctions`,
what `plitzi functions dev` runs.

## A space's runtime

```ts
import { defineRuntime } from '@plitzi/sdk-runtime';

export default defineRuntime({
  start: ({ env }) => ({ endpoints: { '/mcp': request => new Response(`hello from ${env.REGION ?? 'here'}`) } })
});
```

The platform starts it with `startSpaceRuntime` (`./host`), and forwards to it the paths it declares. The guide is
`docs/en/runtimes.md`.
