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
| `logoutPath` | `string \| false` | `'/auth/logout'` | Path for the built-in logout endpoint. Set to `false` to disable it entirely. |
| `templateFn` | `SSRTemplateFn` | built-in EJS template | Custom render function. Receives all template params and returns an HTML string. |
| `plugins` | `Record<string, PluginSource>` | — | Named plugin definitions. Compiled or copied on first use and cached for `pluginsTtlMs`. |
| `pluginsCacheDir` | `string` | `.sdk-plugins` | Directory where compiled plugin files are stored. |
| `pluginsTtlMs` | `number` | `604800000` | TTL in milliseconds for compiled plugins (default: 1 week). |
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
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  onLogout?: (req: SSRRequest) => Promise<void>;
};
```

- **`getOfflineData`** — returns the space snapshot (schema, plugins, styles, segments, collections) for SSR.
- **`getSpaceDeployment`** — resolves which space and environment to render for a given inbound request. Return `{ error: { code, message } }` to abort with an HTTP error. Optionally include `templateProps` to override template variables, or `pluginNames` to activate plugins for the space (see [Plugins](#plugins) and [Template props](#template-props)).
- **`getUser`** *(optional)* — resolves the authenticated user from the inbound request (e.g. via a session cookie or `Authorization` header). Called in parallel with `getOfflineData` on every cache miss. The returned user is forwarded to the SDK as `authenticated: true` and `user.details`, which controls page-level access for guest vs. registered users. Return `undefined` for unauthenticated requests.
- **`onLogout`** *(optional)* — called when `POST {logoutPath}` is received. Responsible for invalidating any server-side user session or cache entry. The server responds with `204 No Content` after the adapter resolves (see [User authentication](#user-authentication)).

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

### Cache manager

`server.cache` exposes programmatic cache control, useful when content changes and you need to invalidate entries without restarting the server.

```ts
const server = createSSRServer({ cacheTtlMs: 300_000, adapters });

// Invalidate all entries for a specific space
server.cache?.invalidate({ spaceId: 42 });

// Invalidate a specific hostname
server.cache?.invalidate({ hostname: 'app.example.com' });

// Invalidate by space + environment
server.cache?.invalidate({ spaceId: 42, environment: 'staging' });

// Clear everything
server.cache?.clear();

// Inspect size
console.log(server.cache?.size);
```

`server.cache` is `null` when caching is disabled (`cacheTtlMs: 0`).

#### `CacheFilter`

| Field | Type | Description |
|---|---|---|
| `spaceId` | `number` | Match entries for this space. |
| `environment` | `string` | Match entries for this environment. |
| `hostname` | `string` | Match entries for this hostname. |

All fields are optional and combined with AND logic. Calling `invalidate()` with no filter (or an empty object) clears the entire cache.

## Plugins

Plugins are React component bundles that extend the Plitzi schema renderer. They are defined globally at server config level, compiled or copied on first use, and cached on disk for one week. The `getSpaceDeployment` adapter controls which plugins each space gets access to via `pluginNames`.

```ts
import type { SSRSpaceDeployment } from '@plitzi/sdk-server';

const server = createSSRServer({
  plugins: {
    // From a source file — compiled to ESM with esbuild
    'my-chart': {
      js: '/abs/path/to/MyChart.tsx',
      css: '/abs/path/to/MyChart.css'  // optional
    },
    // Pre-compiled local file — copied as-is
    'data-table': {
      js: '/abs/path/to/table.js',
      action: 'copy'
    },
    // Pre-compiled from a CDN — fetched and cached
    'video-player': {
      js: 'https://cdn.example.com/player.js',
      css: 'https://cdn.example.com/player.css'
    },
    // React component passed directly (SSR-capable, compiled from source for client)
    'rich-text': {
      component: RichTextComponent,
      js: '/abs/path/to/RichText.tsx'
    }
  },
  adapters: { ... }
});

// Manually invalidate a plugin (e.g. after deploying a new version)
await server.plugins.invalidate('my-chart');

// Invalidate all plugins
await server.plugins.invalidate();
```

The adapter returns which plugin names the space is allowed to use:

```ts
const getSpaceDeployment = async (req): Promise<SSRSpaceDeployment> => {
  const space = await fetchSpace(req.hostname);

  return {
    spaceId: space.id,
    environment: space.environment,
    revision: space.revision,
    pluginNames: space.hasPremiumPlugins ? ['my-chart', 'data-table'] : []
  };
};
```

### Plugin sources

| Shape | Action | When to use |
|---|---|---|
| `{ js: 'file.tsx' }` | Auto-detected → compile | TypeScript/JSX source files |
| `{ js: 'file.js' }` | Auto-detected → copy | Pre-compiled local JS |
| `{ js: 'https://...' }` | Auto-detected → copy (fetch) | CDN or external URLs |
| `{ js: '...', action: 'compile' \| 'copy' }` | Explicit | Override auto-detection |
| `{ component: MyComp, js: 'file.tsx' }` | compile | Component reference for SSR + source for client |

### Action auto-detection

When `action` is not set, the server infers it from the `js` value:

- HTTP/HTTPS URL → `copy` (fetched over the network)
- `.tsx`, `.ts`, `.jsx` extension → `compile` (esbuild, ESM output, React/SDK externalized)
- `.js` extension → `copy`

### Plugin serving

Compiled and copied plugin files are served under `/sdk-plugins/{name}/`:

```
/sdk-plugins/my-chart/index.js
/sdk-plugins/my-chart/index.css   (if CSS was generated or provided)
```

Plugin responses are compressed with Brotli or gzip like all other responses.

### TTL and invalidation

Plugins are compiled once and cached for `pluginsTtlMs` (default: 1 week). The TTL is tracked via a `meta.json` file written alongside each plugin's compiled output. On the next request after expiry the plugin is automatically recompiled.

To force recompilation without waiting for TTL expiry, call `server.plugins.invalidate(name?)`.

### Dynamic plugin registration

Plugins can be registered after the server has started without restarting it. This is useful when plugins are loaded from a database or activated at runtime:

```ts
const server = createSSRServer({ adapters });
server.listen(3001);

// Later — register a new plugin dynamically
server.plugins.register('my-chart', {
  js: '/abs/path/to/MyChart.tsx'
});

// Or re-register an existing plugin to update its source
server.plugins.register('my-chart', {
  js: 'https://cdn.example.com/chart-v2.js',
  action: 'copy'
});
```

`register` clears any in-memory cache for that plugin name, so the next request triggers a fresh compile/copy. Previously compiled disk files are reused if they are within their TTL; call `server.plugins.invalidate(name)` beforehand to force a full rebuild.

## User authentication

The server supports per-request user resolution to enable page-level access control within a space. Schemas can have pages restricted to registered users; the SDK uses `authenticated` and `user.details` to decide which pages to render.

### `getUser` adapter

Implement `getUser` to resolve the current visitor from the request. The server calls it on every render (cache misses only) in parallel with `getOfflineData`, so there is no sequential overhead.

```ts
import type { SSRUser } from '@plitzi/sdk-server';

const getUser = async (req: SSRRequest): Promise<SSRUser | undefined> => {
  const token = req.headers['authorization']?.replace('Bearer ', '')
    ?? parseCookies(req.headers['cookie'] ?? '')['my_session'];

  if (!token) {
    return undefined;
  }

  const user = await db.users.findByToken(token);
  if (!user || user.tokenExpiredAt < Date.now() / 1000) {
    return undefined;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    verified: user.isActive,
    permissions: user.permissions,
    roles: user.roles
  };
};

createSSRServer({ adapters: { getOfflineData, getSpaceDeployment, getUser } });
```

### `SSRUser`

| Field | Type | Description |
|---|---|---|
| `id` | `number` | Unique user identifier. |
| `username` | `string` | Display name. |
| `email` | `string` | Email address. |
| `verified` | `boolean` | Whether the account is active/verified. |
| `permissions` | `string[]` | Permission keys for fine-grained access control. |
| `roles` | `string[]` | Role names. |

### Logout endpoint

The server exposes a built-in `POST /auth/logout` endpoint. When hit, it calls `adapters.onLogout(req)` and responds with `204 No Content`. Implement `onLogout` to invalidate the session or cached user entry:

```ts
const onLogout = async (req: SSRRequest): Promise<void> => {
  const token = parseCookies(req.headers['cookie'] ?? '')['my_session'];
  if (token) {
    await cache.delete(`user-${token}`);
  }
};

createSSRServer({ adapters: { getOfflineData, getSpaceDeployment, getUser, onLogout } });
```

The path is configurable via `logoutPath`. Set it to `false` to disable the endpoint entirely:

```ts
createSSRServer({
  logoutPath: '/api/logout',   // custom path
  // logoutPath: false,        // disable
  adapters: { ... }
});
```

## Basic auth

Per-space HTTP Basic authentication is handled automatically via `ctx.spaceDeployment.credential`. Set `credential.provider = 'ssr'` and `credential.data = { type: 'basic', user, pass }` in your `getSpaceDeployment` adapter. Successful authentications are cached in-memory for 5 minutes.

## Custom template

By default the server uses its built-in EJS template. You can replace it with any function that receives the template params and returns an HTML string:

```ts
import type { SSRTemplateFn } from '@plitzi/sdk-server';

const templateFn: SSRTemplateFn = ({ html, offlineData, jsPath, cssPath, plugins, react, reactDom, reactDomClient, reactJsx }) => `
  <!doctype html>
  <html lang="en">
    <head>
      <script type="importmap">
        { "imports": { "react": "${react}", "react-dom": "${reactDom}", "@plitzi/plitzi-sdk": "${jsPath}" } }
      </script>
      <link href="${cssPath}" rel="stylesheet" />
      ${(plugins ?? []).filter(p => p.css).map(p => `<link href="${p.css}" rel="stylesheet" />`).join('\n')}
    </head>
    <body>
      <div id="plitzi">${html}</div>
    </body>
  </html>
`;

createSSRServer({ templateFn, adapters: { ... } });
```

The function is called once per render (cache misses only). The built-in `template.ejs` is used as fallback when `templateFn` is not set.

## Template props

Override or extend template variables per space by returning `templateProps` from `getSpaceDeployment`. Values are merged over the server defaults, with `html` and `offlineData` always computed by the server.

```ts
return {
  spaceId: space.id,
  templateProps: {
    title: space.name,
    builderJsPath: '/builder-assets/plitzi-builder.js',
    builderCssPath: '/builder-assets/plitzi-builder.css'
  }
};
```

### `SSRTemplateProps`

| Property | Type | Description |
|---|---|---|
| `title` | `string` | Page `<title>`. Defaults to `'Plitzi App'`. |
| `jsPath` | `string` | URL for the SDK JS module. Defaults to `/sdk-assets/plitzi-sdk.js`. |
| `cssPath` | `string` | URL for the SDK stylesheet. Defaults to `/sdk-assets/plitzi-sdk.css`. |
| `builderJsPath` | `string` | URL for the builder JS module. Omitted by default. |
| `builderCssPath` | `string` | URL for the builder stylesheet. Omitted by default. |
| `plugins` | `PluginEntry[]` | Plugin entries to inject. Normally set automatically via `pluginNames`. |
| `react` | `string` | React ESM URL. Defaults to `esm.sh/react@{version}`. |
| `reactDom` | `string` | ReactDOM ESM URL. |
| `reactDomClient` | `string` | ReactDOM client ESM URL. |
| `reactJsx` | `string` | React JSX runtime ESM URL. |

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
  SSRTemplateProps,
  SSRTemplateFn,
  SSRCredential,
  SSRUser,
  SSRHeaders,
  PluginSource,
  PluginSourceFile,
  PluginSourceComponent,
  PluginAction,
  PluginEntry,
  PluginRegistry,
  CacheFilter,
  CacheManager,
  JsonAdaptersConfig
} from '@plitzi/sdk-server';
```
