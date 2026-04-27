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
| `devMode` | `boolean` | `NODE_ENV !== 'production'` | Enables development mode: appends `?dev` to esm.sh CDN URLs for React, and activates per-request timing metrics (see [Dev metrics](#dev-metrics)). |
| `assetVersion` | `string` | — | Cache-buster appended as `?v=<assetVersion>` to all default SDK asset URLs. Compute from file mtime or package version at startup. |
| `cacheTtlMs` | `number` | `300000` | TTL in milliseconds for the SSR render cache. Set to `0` to disable. |
| `loginPath` | `string \| false` | `'/auth/login'` | Path for the built-in login endpoint. Set to `false` to disable it entirely. |
| `logoutPath` | `string \| false` | `'/auth/logout'` | Path for the built-in logout endpoint. Set to `false` to disable it entirely. |
| `templateFn` | `SSRTemplateFn` | built-in EJS template | Custom render function. Receives all template params and returns an HTML string. |
| `plugins` | `Record<string, PluginSource>` | — | Named plugin definitions. Compiled or copied on first use and cached for `pluginsTtlMs`. |
| `pluginsCacheDir` | `string` | `.sdk-plugins` | Directory where compiled plugin files are stored. |
| `pluginsTtlMs` | `number` | `604800000` | TTL in milliseconds for compiled plugins (default: 1 week). |
| `autoLoadSchemaPlugins` | `boolean` | `true` | Auto-download and cache plugins declared in the schema's `offlineData.plugins` list. Set to `false` to manage plugin loading manually. |
| `publicDir` | `string` | — | Absolute path to a directory served at the root URL level (e.g. `robots.txt`, `favicon.png`). Files are checked after the built-in public directory and before `static` prefix routes. |
| `static` | `Record<string, string>` | — | URL prefix → filesystem path mappings for static file serving. |
| `ssrOnly` | `boolean` | `false` | Omit client-side JS from the rendered page. Useful for verifying SSR HTML without hydration. |
| `streaming` | `boolean` | `false` | Stream HTML to the browser incrementally to reduce TTFB. See [Streaming](#streaming). |
| `middlewares` | `SSRMiddleware[]` | — | Array of custom middleware functions executed before the SSR renderer on every request (see [Custom middlewares](#custom-middlewares)). |
| `rsc` | `SSRRscConfig` | — | React Server Components endpoint configuration (see [RSC](#react-server-components-rsc)). |
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
  onLogin?: (req: SSRRequest) => Promise<boolean>;
  onLogout?: (req: SSRRequest) => Promise<void>;
  getRscData?: (
    req: SSRRequest,
    spaceId: number,
    environment: Environment,
    revision: number,
    user: SSRUser | undefined,
    ids?: string[]  // present on partial refresh; absent for full fetch
  ) => Promise<SSRRscData>;
};
```

- **`getOfflineData`** — returns the space snapshot (schema, plugins, styles, segments, collections) for SSR.
- **`getSpaceDeployment`** — resolves which space and environment to render for a given inbound request. Return `{ error: { code, message } }` to abort with an HTTP error. Optionally include `templateProps` to override template variables, or `pluginNames` to activate plugins for the space (see [Plugins](#plugins) and [Template props](#template-props)).
- **`getUser`** *(optional)* — resolves the authenticated user from the inbound request (e.g. via a session cookie or `Authorization` header). Called in parallel with `getOfflineData` on every cache miss. The returned user is forwarded to the SDK as `authenticated: true` and `user.details`, which controls page-level access for guest vs. registered users. Return `undefined` for unauthenticated requests.
- **`onLogin`** *(optional)* — called when `POST {loginPath}` is received. Responsible for establishing a session or issuing tokens. Return `true` if login succeeded; return `false` to respond with `401 Unauthorized`.
- **`onLogout`** *(optional)* — called when `POST {logoutPath}` is received. Responsible for invalidating any server-side user session or cache entry. The server responds with `204 No Content` after the adapter resolves.
- **`getRscData`** *(optional)* — called by the RSC endpoint (`/_rsc`) to fetch server-side data for schema elements with `runtime: 'server'`. Receives the full request, space context, and the resolved user so that authenticated operations can be performed. When `ids` is provided the adapter should return data only for those element IDs (partial refresh); omitting `ids` means a full fetch for all elements. Return `{}` when there is no server data for the current request (see [RSC](#react-server-components-rsc)).

## JSON adapters (offline mode)

`createJsonAdapters` provides a ready-made adapter set that reads data from local JSON files, useful for offline mode, integration tests, and static deployments.

```ts
import { createSSRServer, createJsonAdapters } from '@plitzi/sdk-server';

const server = createSSRServer({
  adapters: createJsonAdapters({
    offlineData: '/exports/offline.json',
    deployment: { spaceId: 1, environment: 'main', revision: 0 },
    user: { id: 1, username: 'admin', email: 'admin@example.com', verified: true, permissions: [], roles: [] }
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
| `user` | `SSRUser` | Fixed user returned for every request. Useful for testing authenticated flows. |
| `user` | `(req) => SSRUser \| undefined \| Promise<SSRUser \| undefined>` | Function for dynamic user resolution per request. |

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

### Public directory

Any file placed in the package's `public/` directory is served automatically at its root path (e.g. `public/favicon.png` → `/favicon.png`).

Use `publicDir` to serve your own root-level files (e.g. `robots.txt`, `sitemap.xml`) without prefixes:

```ts
createSSRServer({
  publicDir: path.resolve(process.cwd(), 'src/services/ssr/public'),
  adapters: { ... }
});
```

The lookup order for a request is: built-in `public/` → `publicDir` → `static` prefix routes → SSR renderer.

`/.well-known/` paths follow the same lookup order: served from `publicDir` if a matching file exists, otherwise `404 Not Found`. They are never handled by the SSR renderer.

## Compression

Responses are compressed automatically based on the `Accept-Encoding` request header. The server prefers Brotli (`br`) over gzip, and skips compression for payloads under 1 KB.

| Encoding | Algorithm | Settings |
|---|---|---|
| `br` | Brotli | Quality 4 |
| `gzip` | Gzip | Level 6 |

`Content-Encoding` and `Vary: Accept-Encoding` are set on all compressed responses.

## Render cache

SSR output is cached in-memory per `(spaceId, environment, revision, hostname, path, search)`. The cache uses a 5-minute TTL by default. The `main` environment is always excluded from caching — it is the development environment and its schema changes frequently.

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

Schema data (`getOfflineData`) is also cached under the same TTL, keyed by `(spaceId, environment, revision)`. This avoids repeated adapter calls on consecutive HTML cache misses for the same space version.

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
      css: '/abs/path/to/MyChart.css',  // filesystem path — copied to .sdk-plugins
      version: '1.2.0'
    },
    // Pre-compiled local file — copied as-is (version defaults to '1.0.0')
    'data-table': {
      js: '/abs/path/to/table.js',
      action: 'copy'
    },
    // Pre-compiled from a CDN — fetched and cached
    'video-player': {
      js: 'https://cdn.example.com/player.js',
      css: 'https://cdn.example.com/player.css',
      version: '3.0.1'
    },
    // CSS already served via `static` — referenced directly, not copied
    'plitziBuilder': {
      js: '/abs/path/to/builder/index.ts',
      css: '/builder-assets/plitzi-builder.css',  // web URL — injected as-is
      action: 'compile',
      version: '2.1.0'
    }
  },
  adapters: { ... }
});

// Invalidate one specific version
await server.plugins.invalidate('my-chart', '1.2.0');

// Invalidate all versions of a plugin (my-chart, my-chart@1.2.0, …)
await server.plugins.invalidate('my-chart');

// Invalidate everything
await server.plugins.invalidate();
```

The adapter controls which plugins each space gets via `pluginNames` (for pre-registered plugins) and `pluginSources` (for plugins defined inline — downloaded and cached automatically):

```ts
const getSpaceDeployment = async (req): Promise<SSRSpaceDeployment> => {
  const space = await fetchSpace(req.hostname);

  return {
    spaceId: space.id,
    environment: space.environment,
    revision: space.revision,
    // Activate pre-registered plugins by name
    pluginNames: space.hasPremiumPlugins ? ['my-chart', 'data-table'] : [],
    // Inline plugin definitions — auto-downloaded and compiled on first use
    pluginSources: space.customPlugins
      ? {
          'custom-widget': {
            js: `https://cdn.example.com/widgets/${space.id}/index.js`,
            css: `https://cdn.example.com/widgets/${space.id}/index.css`,
            version: space.customPluginVersion
          }
        }
      : undefined
  };
};
```

Plugins listed in `pluginSources` are registered into the plugin manager on-the-fly using `ensure()`, which only triggers a rebuild if the plugin is new or its `version` has changed. Both `pluginNames` and `pluginSources` entries are resolved in parallel before the HTML is rendered.

### Plugin sources

| Shape | Action | When to use |
|---|---|---|
| `{ js: 'file.tsx' }` | Auto-detected → compile | TypeScript/JSX source files |
| `{ js: 'file.js' }` | Auto-detected → copy | Pre-compiled local JS |
| `{ js: 'https://...' }` | Auto-detected → copy (fetch) | CDN or external URLs |
| `{ js: '...', action: 'compile' \| 'copy' }` | Explicit | Override auto-detection |

> **Client vs. SSR-only plugins**: A plugin registered as `{ component: MyFC }` (component reference) is rendered only on the server — no JS bundle is emitted for the browser. Elements using this plugin will disappear after client-side hydration. To keep the component alive in the browser, use a source file with `action: 'compile'` so esbuild produces a browser-loadable ESM bundle, and list the plugin in `pluginNames` so it is injected into the page template.

### Plugin versioning

Every plugin registered through `createSSRServer` (or via `server.plugins.register`) is versioned. If you omit `version`, it defaults to `'1.0.0'`:

```ts
plugins: {
  // explicit version
  'my-chart': {
    js: 'https://cdn.example.com/chart@1.2.0/index.js',
    css: 'https://cdn.example.com/chart@1.2.0/index.css',
    version: '1.2.0'
  },
  // version defaults to '1.0.0'
  'data-table': {
    js: '/abs/path/to/table.js'
  }
}
```

Versioned plugins:
- **Never expire by TTL** — considered immutable; disk cache is kept indefinitely.
- **Version change triggers rebuild** — if the on-disk `meta.json` has a different version, the old cache is discarded and the plugin is recompiled/re-fetched automatically on the next request.
- **Bump `version`** whenever you deploy a new build to guarantee all nodes pick up the update.

Plugins coming from `pluginSources` in the deployment follow the same rules — version is required there to avoid stale caches across deployments.

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

## React Server Components (RSC)

The SSR server includes a lightweight RSC endpoint that delivers server-side data to schema elements with `runtime: 'server'`. This is not the React RSC wire protocol — it uses a simple JSON transport that any element can consume via `useRscData()`.

### Schema setup

Enable RSC at the top level of your schema:

```json
{
  "rsc": { "enabled": true },
  "items": [
    {
      "id": "my-element",
      "type": "myPlugin",
      "runtime": "server",
      "loadStrategy": "eager"
    }
  ]
}
```

**`runtime`** — controls where an element renders:

| Value | Behaviour |
|---|---|
| `'server'` | Rendered during SSR; filtered out on the client until RSC data arrives. |
| `'client'` | Skipped during SSR; rendered only in the browser after hydration. |
| `'shared'` | Rendered on both server and client (default behaviour). |

**`loadStrategy`** — controls when the browser requests the element's data (schema field; browser runtime behaviour is handled by the SDK):

| Value | Behaviour |
|---|---|
| `'eager'` | Data fetched immediately on mount. |
| `'lazy'` | Data fetched after the initial render completes. |
| `'visible'` | Data fetched when the element enters the viewport. |

### `getRscData` adapter

Implement `getRscData` in your adapters to serve data from the `/_rsc` endpoint. `serverData` is a map keyed by schema element ID — each element reads only its own slice, so multiple `runtime:'server'` elements in the same schema can have independent data.

When `ids` is provided the client is performing a **partial refresh** — only return data for those element IDs. When `ids` is absent, return data for all elements (full fetch):

```ts
import type { SSRAdapters, SSRRscData, SSRUser } from '@plitzi/sdk-server';

const getRscData = async (
  req: SSRRequest,
  spaceId: number,
  environment: string,
  revision: number,
  user: SSRUser | undefined,
  ids?: string[]
): Promise<SSRRscData> => {
  // Only serve data when the schema has RSC enabled
  const offlineData = await getOfflineData(spaceId, environment, revision);
  if (!offlineData?.schema.rsc?.enabled) {
    return {};
  }

  // Authenticated operations are safe here — user is already resolved
  const profile = user ? await db.profiles.find(user.id) : null;

  const all: Record<string, unknown> = {
    // keys are the schema element IDs that have runtime:'server'
    'my-profile-card': {
      authenticated: !!user,
      userId: user?.id ?? null,
      profile
    },
    'my-stats-widget': {
      totalOrders: await db.orders.countByUser(user?.id)
    }
  };

  // Filter to requested IDs on partial refresh
  const serverData = ids?.length
    ? Object.fromEntries(ids.filter(id => id in all).map(id => [id, all[id]]))
    : all;

  return { serverData };
};

const adapters: SSRAdapters = { getOfflineData, getSpaceDeployment, getUser, getRscData };
```

### Partial refresh

The `/_rsc` endpoint accepts an optional `?ids=elem1,elem2` query string. When present, the server calls `getRscData` with only those IDs and returns a partial payload. On the client the partial data is **merged** into the existing `serverData` state rather than replacing it, so unrelated elements are unaffected:

```ts
// From a plugin — refresh only this element's data
const [{ refresh }] = useRscData();
await refresh(['my-stats-widget']);

// Refresh multiple elements at once
await refresh(['my-profile-card', 'my-stats-widget']);

// Full refresh (replaces all serverData)
await refresh();
```

### `SSRRscData`

```ts
type SSRRscData = {
  /** Per-element server data keyed by schema element ID. */
  serverData?: Record<string, unknown>;
};
```

Return `{}` (empty object) when there is no server data for the current request. Each key must match the `id` of a schema element with `runtime: 'server'`.

### `/_rsc` endpoint

The server automatically registers `GET /_rsc` when `adapters.getRscData` is provided. The endpoint:

1. Reads `spaceId`, `environment`, and `revision` from the resolved `spaceDeployment` context.
2. Reads the authenticated user from `ctx.user`.
3. Reads optional `?ids=elem1,elem2` for partial refresh.
4. Calls `adapters.getRscData(req, spaceId, environment, revision, user, ids?)`.
5. Returns a JSON payload:

```json
{
  "version": 1,
  "transport": "json",
  "spaceId": 42,
  "environment": "main",
  "revision": 7,
  "serverData": { ... }
}
```

**Cache-Control**: `no-store` for the `main` environment; `private, max-age=30` for other environments when `rsc.cacheTtlMs > 0`. Responses also include `X-Cache: HIT` or `X-Cache: MISS` for observability.

The endpoint returns `400` if `spaceId` is missing or invalid, `500` if `getRscData` throws, and `501` if the adapter is not configured.

### RSC configuration

```ts
createSSRServer({
  rsc: {
    enabled: true,   // default: true when getRscData is provided
    path: '/_rsc'    // default: '/_rsc'
  },
  adapters: { getRscData, ... }
});
```

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` (when adapter provided) | Activate or deactivate the RSC endpoint. |
| `path` | `string` | `'/_rsc'` | URL path for the RSC endpoint. |
| `cacheTtlMs` | `number` | `30000` | TTL in milliseconds for the RSC response cache. Set to `0` to disable RSC caching. Ignored for the `main` environment. |

### Consuming RSC data in plugins

Schema elements with `runtime: 'server'` can read the server payload via the SDK's `useRscData` hook:

```tsx
import { useRscData } from '@plitzi/sdk-elements';

const MyPlugin = () => {
  const [{ loaded, serverData, refresh }] = useRscData();

  if (!loaded) return <p>Loading...</p>;
  if (!serverData) return null;

  return (
    <>
      <pre>{JSON.stringify(serverData, null, 2)}</pre>
      <button onClick={() => refresh()}>Refresh all</button>
      <button onClick={() => refresh(['my-stats-widget'])}>Refresh this</button>
    </>
  );
};
```

The hook is backed by `RscProvider`, which fetches `/_rsc` once on mount and updates on navigation. The `loaded` boolean distinguishes "still fetching" from "fetched but returned no data". `refresh(ids?)` re-fetches server data: when `ids` is provided only those elements are refreshed and their results are merged; omitting `ids` performs a full replace.

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
| `token` | `string` | Opaque token or JWT from the auth provider. |
| `id` | `number` | Unique user identifier. |
| `username` | `string` | Display name. |
| `email` | `string` | Email address. |
| `verified` | `boolean` | Whether the account is active/verified. |
| `permissions` | `string[]` | Permission keys for fine-grained access control. |
| `roles` | `string[]` | Role names. |

### Login endpoint

The server exposes a built-in `POST /auth/login` endpoint. When hit, it calls `adapters.onLogin(req)` and responds with `200 OK` on success or `401 Unauthorized` when the adapter returns `false`:

```ts
const onLogin = async (req: SSRRequest): Promise<boolean> => {
  const { username, password } = JSON.parse(req.body ?? '{}');
  const user = await db.users.authenticate(username, password);
  if (!user) return false;

  // Set session cookie or issue token here
  return true;
};

createSSRServer({ adapters: { getOfflineData, getSpaceDeployment, onLogin } });
```

The path is configurable via `loginPath`. Set it to `false` to disable the endpoint entirely:

```ts
createSSRServer({
  loginPath: '/api/login',   // custom path
  // loginPath: false,       // disable
  adapters: { ... }
});
```

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

Credential comparison uses `crypto.timingSafeEqual` to prevent timing attacks. Invalid credentials always receive a `WWW-Authenticate` challenge and `401 Unauthorized`.

## Custom middlewares

Register request-scoped middleware to run before the SSR renderer. Middlewares execute in the order they are declared and can short-circuit by not calling `next()`.

```ts
import type { SSRMiddleware } from '@plitzi/sdk-server';

const corsMiddleware: SSRMiddleware = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');
  return next();
};

const rateLimitMiddleware: SSRMiddleware = async (req, res, next) => {
  const allowed = await rateLimiter.check(req.hostname);
  if (!allowed) {
    res.setStatus(429);
    res.send(JSON.stringify({ error: 'Too Many Requests' }));
    return;
  }
  return next();
};

createSSRServer({
  middlewares: [corsMiddleware, rateLimitMiddleware],
  adapters: { ... }
});
```

Middlewares run after the built-in auth checks (Basic auth, `spaceDeployment` resolution, `getUser`) and before RSC and the SSR renderer.

## SSR-only mode

Set `ssrOnly: true` to serve raw server-rendered HTML without any client-side scripts. Useful for inspecting SSR output or building purely static pages:

```ts
createSSRServer({
  ssrOnly: true,
  adapters: { ... }
});
```

The `<script>` block that bootstraps the SDK client is omitted from the response. Images, styles, and static assets are still served normally.

## Asset versioning

Append a cache-buster to all default SDK asset URLs (JS, CSS, React CDN imports) to force browsers to re-fetch after a deployment:

```ts
import { statSync } from 'node:fs';

const assetVersion = String(statSync('./node_modules/@plitzi/plitzi-sdk/dist/plitzi-sdk.js').mtimeMs | 0);

createSSRServer({
  assetVersion,
  adapters: { ... }
});
```

URLs become `/sdk-assets/plitzi-sdk.js?v=<assetVersion>`. This is separate from plugin versioning — it only affects the built-in SDK asset paths, not plugin URLs.

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

**Streaming compatibility**: when `streaming: true` the server calls `templateFn` with a sentinel placeholder (`<!--SSR_CONTENT-->`) in place of the React HTML, splits the output at that marker, and streams head and tail separately. Existing templates that interpolate `html` as-is are compatible without any changes.

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
| `react` | `string` | React ESM URL. Defaults to `esm.sh/react@19`. |
| `reactDom` | `string` | ReactDOM ESM URL. |
| `reactDomClient` | `string` | ReactDOM client ESM URL. |
| `reactJsx` | `string` | React JSX runtime ESM URL. |
| `ssrOnly` | `boolean` | When `true`, the client-side `<script>` block is omitted. |

## Streaming

Enable streaming to reduce TTFB by sending the `<head>` section to the browser before React finishes rendering:

```ts
createSSRServer({
  streaming: true,
  adapters: { ... }
});
```

How it works:

1. All async data (`getOfflineData`, `getRscData`, plugins) is fetched and prepared in parallel as usual.
2. The page template is called with a sentinel placeholder in place of React HTML.
3. The `<head>` section — including `<script>` and `<link>` tags — is flushed immediately. The browser starts loading JS and CSS while React is still rendering.
4. React renders via `renderToPipeableStream` and streams its HTML chunks as they are produced.
5. The closing tags are flushed when React finishes.

**Cache hits** are unaffected — cached HTML is sent as a single compressed response as usual, since the full string is already available.

**Compression**: streaming responses use chunked transfer encoding and skip Brotli/gzip compression. A `Content-Length` header cannot be set before the body is complete, so compression is intentionally bypassed for streaming responses.

## Dev metrics

When `devMode: true`, per-phase timing is instrumented on every render and reported in two ways:

- A `Server-Timing` header is set on the response, visible in the browser's DevTools under **Network → Timing**.
- A one-line summary is logged to stdout:

```
[SSR] GET / — schema=1ms rsc=0ms extPlugins=0ms plugins=0ms template=2ms react=16ms | total=19ms
```

| Phase | Description |
|---|---|
| `schema` | `getOfflineData` adapter call (or cache hit — skipped from log). |
| `rsc` | `getRscData` + `getUser` resolution via `buildServerInfo`. |
| `extPlugins` | Auto-loading plugins declared in the schema's `offlineData.plugins` list. |
| `plugins` | Dynamic import and component loading for all active plugins. |
| `template` | `templateFn` call — HTML string assembly. |
| `react` | `renderToString` duration (buffered mode) or time until `onShellReady` (streaming). |
| `total` | Wall-clock time from request entry to response headers flushed. |

In production (`devMode: false`) timing instrumentation is skipped entirely — no `Server-Timing` header, no console output.

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
  SSRRscData,
  SSRRscConfig,
  SSRServer,
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
