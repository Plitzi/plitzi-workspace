# @plitzi/sdk-server

Server-side rendering (SSR) server for Plitzi spaces. Ships as an HTTP/2 server by default with support for HTTP/1.1 and HTTP/3.

## Installation

```bash
yarn add @plitzi/sdk-server
```

## Usage

```ts
import { readFileSync } from 'node:fs';
import { createSSRServer } from '@plitzi/sdk-server';

const server = createSSRServer({
  httpVersion: 2,
  tls: {
    key: readFileSync('./certs/server-key.pem'),
    cert: readFileSync('./certs/server.pem')
  },
  adapters: {
    getOfflineData,
    getSpaceDeployment
  }
});

server.listen(3001);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `httpVersion` | `1 \| 2 \| 3` | `2` | HTTP protocol version. Falls back to the nearest available lower version. |
| `tls` | `{ key, cert, minVersion? }` | — | TLS key and certificate. Required for versions 2 and 3; optional for version 1. |
| `sdkEnvironment` | `'production' \| 'staging' \| 'development' \| 'local'` | `'production'` | SDK environment forwarded to the React component. |
| `devMode` | `boolean` | `NODE_ENV !== 'production'` | Appends `?dev` to esm.sh CDN URLs for React. |
| `reactVersion` | `string` | `'19'` | React version used in importmap URLs. |
| `cacheTtlMs` | `number` | `300000` | TTL in milliseconds for the SSR render cache. Set to `0` to disable. |
| `static` | `Record<string, string>` | — | URL prefix → filesystem path mappings for static file serving. |
| `adapters` | `SSRAdapters` | — | Required. Adapter callbacks for data fetching. |

### HTTP version behaviour

| `httpVersion` | TLS required | Transport |
|---|---|---|
| `1` | No | Plain HTTP, or HTTPS when `tls` is set |
| `2` | Yes | HTTP/2 with HTTP/1.1 fallback via ALPN |
| `3` | Yes | HTTP/2 primary + HTTP/3 QUIC when available |

HTTP/3 requires Node.js ≥ 23 started with `--experimental-quic`. When unavailable the server falls back to HTTP/2 and logs a warning. An `Alt-Svc` response header is added automatically so browsers can upgrade.

## Adapters

The `adapters` option is the integration point between the SSR server and your data layer.

```ts
type SSRAdapters = {
  getOfflineData: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  getSpaceDeployment: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
};
```

- **`getOfflineData`** — returns the space snapshot (schema, plugins, styles, segments, collections) for SSR.
- **`getSpaceDeployment`** — resolves which space and environment to render for a given inbound request. Return `{ error: { code, message } }` to abort with an HTTP error.

## JSON adapters (offline mode)

`createJsonAdapters` provides a ready-made adapter pair that reads data from local JSON files, useful for offline mode, integration tests, and static deployments.

```ts
import { createSSRServer, createJsonAdapters } from '@plitzi/sdk-server';

const server = createSSRServer({
  adapters: createJsonAdapters({
    offlineData: '/exports/offline.json',
    deployment: { spaceId: 1, environment: 'main', revision: 0 }
  })
});

server.listen(3001);
```

### `JsonAdaptersConfig`

| Option | Type | Description |
|---|---|---|
| `offlineData` | `string` | Path to a single JSON file used for every request. |
| `offlineData` | `(spaceId, environment, revision?) => string` | Function returning the path for the requested space. |
| `deployment` | `string` | Path to a JSON file containing an `SSRSpaceDeployment` object. |
| `deployment` | `SSRSpaceDeployment` | Inline deployment object used for every request. |
| `deployment` | `Record<hostname, SSRSpaceDeployment>` | Per-hostname map. Use `'*'` as a catch-all. |

## Static files

Map URL prefixes to local directories:

```ts
createSSRServer({
  static: {
    '/sdk-assets': './node_modules/@plitzi/plitzi-sdk/dist',
    '/builder-assets': './node_modules/@plitzi/plitzi-builder/dist'
  },
  adapters: { ... }
});
```

Static responses include `ETag`, `Last-Modified`, and `Cache-Control` headers. Subsequent requests with `If-None-Match` receive `304 Not Modified` when the file has not changed. JS, CSS, and font files are served with `Cache-Control: immutable`; all other assets use a 1-hour max-age.

### Built-in public directory

Any file placed in the package's `public/` directory is served automatically at its root path (e.g. `public/favicon.png` → `/favicon.png`), before consumer-defined `static` routes.

## Compression

Responses are compressed automatically based on the `Accept-Encoding` request header. The server prefers Brotli (`br`) over gzip, and skips compression for payloads under 1 KB.

| Encoding | Algorithm | Settings |
|---|---|---|
| `br` | Brotli | Quality 4 |
| `gzip` | Gzip | Level 6 |

`Content-Encoding` and `Vary: Accept-Encoding` are set on all compressed responses.

## Render cache

SSR output is cached in-memory per `(spaceId, environment, revision, hostname, path, search)`. The cache uses a 5-minute TTL by default.

```ts
createSSRServer({
  cacheTtlMs: 60_000,  // 1 minute
  adapters: { ... }
});

// Disable caching entirely
createSSRServer({
  cacheTtlMs: 0,
  adapters: { ... }
});
```

Responses include an `X-Cache: HIT` or `X-Cache: MISS` header for observability. The cache is cleared and its sweep timer is stopped when `server.close()` is called.

## Basic auth

Per-space HTTP Basic authentication is handled automatically via `ctx.spaceDeployment.credential`. Set `credential.provider = 'ssr'` and `credential.data = { type: 'basic', user, pass }` in your `getSpaceDeployment` adapter. Successful authentications are cached in-memory for 5 minutes.

## HTML template

The HTML page shell is defined in `src/ssr/views/template.ejs`. The template is compiled once at server startup and rendered synchronously on each request. Variables use `locals.variable` so missing optional values fall back gracefully to empty strings rather than throwing.

## Exported types

```ts
import type {
  SSRAdapters,
  SSRServerConfig,
  SSRRequest,
  SSRResponseHelpers,
  SSRMiddleware,
  SSRMiddlewareNext,
  SSRContext,
  SSRSpaceDeployment,
  SSRCredential,
  SSRHeaders,
  JsonAdaptersConfig
} from '@plitzi/sdk-server';
```
