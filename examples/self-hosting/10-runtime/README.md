# A space's runtime, on a server of your own

A space's own server code, as one module: `defineRuntime` from `@plitzi/sdk-server/runtime`. It is for what a
space's [functions](../../../docs/en/functions.md) cannot be — a connection held open, memory that outlives a request,
Node and its packages. This example is the smallest one that shows all three parts, and loads it into a server of its
own with `serveRuntime`.

```bash
yarn start
yarn start:dev   # the same, reloading on save, while you edit it
```

```
[runtime] the page on http://127.0.0.1:4017/ — its count at http://127.0.0.1:4017/fn/visits, its pulse at http://127.0.0.1:4017/pulse
```

Open the page and press **Count me**; open `/pulse` in two tabs and watch the number of listeners.

## What is in it

| File | |
|---|---|
| `src/runtime.ts` | The module: `start({ env, publicUrl })` answers its `functions`, its `endpoints` and how to `close` |
| `src/functions.ts` | A task (`visits.count`, `visits.read`) and a route (`GET /visits`, served at `/fn/visits`), written as any space's functions are — with the server's `ctx.kv` |
| `src/pulse.ts` | `/pulse`: an event stream held open for as long as someone listens, saying how many are — what a function cannot be |
| `src/actions.ts`, `src/space.ts` | The page and its two actions, documents like any space's: they name the tasks, and nothing else of the runtime |
| `src/main.ts` | A server of your own: `serveRuntime` gives the runtime's functions to it (`native`) and its endpoints as a stage |

## What matters

**The same module runs on the platform.** `plitzi runtime push` packs it and the platform runs it beside the space it
serves: its tasks for the space's flows with the space's `kv`, `/pulse` answered on the space's own host. Nothing in
it changes — which is what this server shows: it is what the platform would be for it.

**Its variables are its environment.** `PULSE_SECONDS` sets how often `/pulse` speaks. Here it is this process's
environment; on the platform, `plitzi runtime vars set PULSE_SECONDS`, kept encrypted and handed to the runtime alone.

**An endpoint is a web handler.** `(request: Request) => Response`, streaming if it likes. It never receives the
visitor's cookie or authorization, and it may not take a path the server answers itself — `/api`, anything under
`/_`, `/auth`, `/.well-known`.

See [`docs/en/runtimes.md`](../../../docs/en/runtimes.md) for the whole of it.
