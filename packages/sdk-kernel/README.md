# @plitzi/sdk-kernel

What every Plitzi server process is built on, and nothing else: the HTTP server and its request pipeline, health and
shutdown, the workers of one machine, the host → deployment resolution, and checking who a request is.

The page server ([`@plitzi/sdk-server`](../../apps/server/README.md)), the MCP server
([`@plitzi/sdk-mcp`](../../apps/mcp/README.md)), the actions worker ([`@plitzi/sdk-actions`](../sdk-actions/README.md))
and the functions runner ([`@plitzi/sdk-runtime`](../sdk-runtime/README.md)) run on it: a process
that renders no page installs this and never loads React.

## Entries

Each folder is an entry of its own, so a process loads what it imports and nothing beside it.

| Entry | What it holds |
|---|---|
| `@plitzi/sdk-kernel/http` | `createHttpServer`, `makeHandler` and the stage types; health (`healthStage`, `registerHealthCheck`); `closeOnSignals` and the drain; the fleet of workers; security headers, cross-site writes, static files; `parseRequest` and the other request readers; SSE and WebSocket framing; `unusedPort` for tests |
| `@plitzi/sdk-kernel/identity` | Who a request is: the session cookies, CSRF, origins and domains, `createIdentity`, the RBAC checks, the scopes a token may carry, the preview token's carrier, the one `RequestIdentity` a page server and a worker take, and the account store's contract (`AccountAdapters`) and password hashing |
| `@plitzi/sdk-kernel/tokens` | Minting and verifying the tokens themselves (`createTokens`, `generateTokenKeys`). An entry of its own because it loads `jsonwebtoken`: a page server that only reads a session cookie does not |
| `@plitzi/sdk-kernel/mysql` | The account store over MySQL (`createMysqlStore`): accounts, sessions, linked identities, space tokens, with its schema. Reads sessions for a worker and writes accounts for sign-in, one schema with one owner. `mysql2` is an optional peer |
| `@plitzi/sdk-kernel/engine` | Types alone: what a page server is handed of the actions engine (`PageEngine`) and the resolver of a page's server element (`RscElementResolver`) |
| `@plitzi/sdk-kernel/data` | A space's data folder as a lookup (`dataDirLookup`): what a `/data/<file>` provider and a function's `ctx.data` read alike |
| `@plitzi/sdk-kernel/pubsub` | The pub/sub a cache's invalidations and the realtime channels travel on (`createMemoryPubSub`, `createRedisPubSub`) |
| `@plitzi/sdk-kernel/files` | Writing a file whole or not at all (`writeFileAtomic`) |
| `@plitzi/sdk-kernel/deployment` | Which deployment a request's host is: the stage and the middleware, and the adapter they ask |
| `@plitzi/sdk-kernel/cache` | The bounded caches a server keeps (`TtlCache`, `CompressedFileCache`) |
| `@plitzi/sdk-kernel/log` | `serverLog`, `consoleLogger` and the log levels |
| `@plitzi/sdk-kernel/outbound` | Where a request somebody else wrote may go (`assertOutboundAllowed`, `fetchOutbound`), and a process's requests to its own public address sent to where it listens (`reachOwnServer`, `reachSpaceInside`) |
| `@plitzi/sdk-kernel/build` | `esbuildBuild`: the one way a process builds, so esbuild's child is stopped once nothing builds |
| `@plitzi/sdk-kernel/stats` | A process's stats and its pools: the recorder (`createStatsRecorder`), `GET /_stats` behind a secret (`statsStage`), `readPools` and `createLocalPoolSource`, and the `PoolScaler` contract |
| `@plitzi/sdk-kernel/types` | Types alone: the request pipeline (`SSRRequest`, `SSRMiddleware`, `SSRContext`), the adapters a deployment answers (`SSRAdapters`, `SSRPageAdapters`) and what they are asked with, the configuration every server shares (`ServerBaseConfig`), the log's events and OAuth's |
| `@plitzi/sdk-kernel/testing` | What the packages built on this test with: `TEST_KEYS`, `TEST_CERTIFICATES`, a fleet simulated in one process, the names of an integration run's tables (`runName`, `dropTablesOfThisRun`) |

The root carries the types a server is written against (`BaseContext`, `Stage`, `HttpServer`…) and no code.

## A server on the kernel

```ts
import { createHttpServer, healthStage, makeHandler } from '@plitzi/sdk-kernel/http';

import type { BaseContext, BuildContext, Stage } from '@plitzi/sdk-kernel/http';

const hello: Stage = ({ res }) => {
  res.send('hello');

  return true;
};

const config = { httpVersion: 1, adapters: {} } as const;
const handlerFor = (port: number) => {
  const context: BuildContext<BaseContext> = (raw, rawRes, req, res) => ({ raw, rawRes, req, res, config, port });

  return makeHandler('HELLO', context, [healthStage, hello]);
};

await createHttpServer(config, handlerFor, { label: 'HELLO' }).listen(8080);
```

A stage answers the request and returns `true`, or returns `false` to let the next one try. `createHttpServer` is the
transport and its lifecycle: `listen`, `close`, and a fleet of workers when `workers` asks for one. What a server offers
beyond that it builds itself.

## Credentials

Tokens are signed with ES256. `generateTokenKeys()` makes a key pair once, for the deployment to keep:

```ts
import { createTokens, generateTokenKeys } from '@plitzi/sdk-kernel/tokens';

const keys = generateTokenKeys(); // { signing: { kid, privateKey }, verifying: [{ kid, publicKey }] }
const tokens = createTokens({ keys, issuer: 'https://acme.com' });
```

A process that only checks credentials is given `verifying` alone: it cannot mint one, and asked to, it refuses and
names the missing key. Signing people in — the `/auth` flows, passwords, second factors — is `@plitzi/sdk-server/auth`.

## What it may import

From another Plitzi package, types only: a value would load that package into every process built on this one. ESLint
refuses a value import of `@plitzi/*` here. Its own dependencies are `jsonwebtoken`, `ws` and `undici` (loaded only by `reachOwnServer` and `reachSpaceInside`); `esbuild` is an optional
peer, needed only by a process that imports `./build`.
