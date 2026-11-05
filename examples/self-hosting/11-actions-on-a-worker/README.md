# Actions on a worker of their own

Pages on one server, their actions on another: a **worker** that serves no page. The page server renders, the worker
runs every `/_action` call and `/fn/` route, and each can be restarted, scaled or moved to another machine without the
other. Each part here is a process of its own, as it would be on a machine of its own.

```bash
yarn start             # worker, page server and a gateway in front: one origin, http://127.0.0.1:4018/
yarn start:elsewhere   # the worker on an origin of its own, no gateway: the page on http://127.0.0.1:4019/
```

```
[worker] on http://127.0.0.1:4020 — /_action and /fn, and nothing else
[pages] on http://127.0.0.1:4019/ — actions called at this origin
[gateway] the pages on http://127.0.0.1:4018/ — /_action, /fn sent to the worker
```

Open the page and press **Press**: the count comes from the worker. Each part also starts alone
(`yarn start:worker`, `start:pages`, `start:gateway`), and `WORKER_URL`, `PAGES_URL` and `PUBLIC_URL` say where the
others are when they run on other machines.

## What is in it

| File | |
|---|---|
| `src/pages.ts` | The page server: `createServer` with `engineOnWorker` — told where its pages call their actions, running none |
| `src/worker.ts` | The worker: `createWorker`, with the actions' documents and the space's kv |
| `src/gateway.ts` | The one origin people see, sending `/_action` and `/fn` to the worker and the rest to the pages |
| `src/actions.ts`, `src/space.ts` | The page and its one action, documents like any space's |
| `src/main.ts` | All three on this machine, each started once the one behind it listens |

## Two ways to reach the worker

**One origin, routed by path** (`yarn start`) — the recommended way. A gateway — here thirty lines of Node; an ingress,
nginx or a load balancer in a real deployment — sends a space's `/_action` and `/fn` to the worker. The browser sees one
origin, so the visitor's session cookie and the cross-site check work as they do on one server.

**Another origin** (`yarn start:elsewhere`) — the worker at `https://actions.example.com`, say. The page server is told
`action.origin`, and its pages call there with the visitor's cookies. The worker is told the same, and which pages call
it (`action.pageOrigins`): it answers them with CORS and credentials, takes them as its own in the cross-site check, and
refuses every other site. It refuses to start with `origin` and no `pageOrigins`. What it needs of the deployment:

- the session readable there — a cookie scoped to a parent domain both share (`authCookie.domain: 'example.com'`);
- the space resolved from that host: its `getSpaceDeployment` sees `actions.example.com`, not the page's;
- a page's `/fn/` routes and realtime channels on its own origin still — only the actions move.

The guide is `@plitzi/sdk-server`'s README, *Actions apart from pages*, and
[`docs/en/server-actions.md`](../../../docs/en/server-actions.md).
