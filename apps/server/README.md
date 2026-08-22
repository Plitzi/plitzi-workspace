# @plitzi/sdk-server

The page server for Plitzi spaces: server-side rendering, React Server Components, plugins, connectors and the
HTTP kernel they run on. Ships as an HTTP/2 server by default, with support for HTTP/1.1 and HTTP/3.

This package serves **pages**. The AI surface — the MCP server, its tool engine and the draft-preview
endpoint — lives in [`@plitzi/sdk-mcp`](../mcp/README.md), which builds on this one. A deployment that only
renders pages never installs it, and never loads it.

## Installation

```bash
yarn add @plitzi/sdk-server
```

## Usage

```ts
import { createServer } from '@plitzi/sdk-server';

const server = createServer({ adapters: { getOfflineData, getSpaceDeployment } });

server.listen(3001);
```

That is a whole page server: two adapters saying which space to render and where its content lives. The SDK bundle,
the transport and the rest have defaults the server can work out for itself — see
[What the server does without being asked](#what-the-server-does-without-being-asked).

Add TLS and it speaks HTTP/2:

```ts
import { readFileSync } from 'node:fs';

createServer({
  tls: { key: readFileSync('./certs/server-key.pem'), cert: readFileSync('./certs/server.pem') },
  adapters: { getOfflineData, getSpaceDeployment }
});
```

## Your first space

A page server needs a **space** to serve, and there are two ways to get one: export it from the Plitzi builder, or
write it yourself. This is the second one, whole — one file, no account, no API key, no JSON:

```ts
// server.ts
import { consoleLogger, createJsonAdapters, createServer } from '@plitzi/sdk-server';
import { authorSpace, container, heading, link, text } from '@plitzi/sdk-server/authoring';

/** A space is a tree, some CSS and a palette. Ids, class names and the breakpoint maps are derived from it. */
const space = authorSpace({
  name: 'My space',
  permanentUrl: 'my-space',

  variables: { color: { ink: { light: '#17171c', dark: '#fafafa', default: '#17171c' } } },

  // Rules written once and named. An element reaches one with `class`.
  classes: {
    page: {
      desktop: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '16px',
        padding: '96px 24px',
        'font-family': 'system-ui, sans-serif',
        color: 'var(--ink)'
      }
    },
    card: { desktop: { 'border-radius': '12px', border: '1px solid #e4e4e7', padding: '24px' } }
  },

  pages: [
    {
      name: 'Home',
      slug: '',
      class: 'page',
      body: [
        heading('Hello from my own server', { subType: 'h1' }),
        container({
          class: 'card',
          children: [text('This page is a document. Nothing here was compiled.'), link({ href: '/about' })]
        })
      ]
    },
    { name: 'About', slug: 'about', class: 'page', body: [heading('About', { subType: 'h1' })] }
  ]
});

/** Where the server gets a space from. Hand it the documents and it fills in the reads a page server needs; a
 *  real deployment swaps this for adapters that hit its own database, and the server never learns the difference. */
const server = createServer({
  port: 3001,
  devMode: true,
  adapters: createJsonAdapters({ offlineData: space }),
  logger: consoleLogger
});

server.listen(3001, '127.0.0.1');
```

```bash
yarn add @plitzi/sdk-server react react-dom
yarn tsx server.ts     # http://127.0.0.1:3001/
```

Both pages render server-side, with the CSS the space declared. `authorSpace` refuses to hand back a space that
would not render — a CSS property the style editor could not read back, a class nothing declares, a binding
pointing at an element that is not there — so a mistake is an error at the line that made it rather than a blank
section in production.

**Shorthands are fine.** `padding: '96px 24px'` and `border: '1px solid #e4e4e7'` above are expanded into the
atomic longhands Plitzi's style editor reads back, so a space written the way anyone writes CSS still opens in the
builder.

Everything else — data on the server, sessions, an agent editing the space, work the server runs — is the same
space with more declared in it. The full surface (element factories, bindings, flows, validation) is in
**[Authoring spaces](https://github.com/plitzi/plitzi-workspace/blob/main/docs/en/authoring-spaces.md)**, and
there are runnable versions of each step in
[`examples/`](https://github.com/plitzi/plitzi-workspace/tree/main/examples).

### Working with an agent

This package ships an [Agent Skill](https://agentskills.io/) for authoring, because an agent in your project sees
only what npm installed — not this repository. It teaches the declaration, the flat prop model, the binding and
flow builders, and the mistakes the validator refuses, so an agent writes a space instead of reconstructing schema
JSON from memory:

```bash
cp -R node_modules/@plitzi/sdk-server/skills/plitzi-authoring ~/.claude/skills/
```

It installs the same way into any agent that reads a `SKILL.md` (Claude Code, VS Code / Copilot, Codex, Gemini
CLI, Cline, Goose). Everything it defers to is in the package too: every factory, spec field and step builder
carries its documentation in the published `.d.ts`, so hovering a call or reading
`node_modules/@plitzi/sdk-elements/dist/authoring/` answers what an attribute takes without leaving the project.

### Already have a space?

An export from the builder is a `{ schema, style }` JSON and goes in the same door:

```ts
adapters: createJsonAdapters({ offlineData: './space.json' })
```

`validateSpace({ schema, style })` from `@plitzi/sdk-server/authoring` answers whether one is servable before you
serve it — worth running over anything that arrives as a file.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `httpVersion` | `1 \| 2 \| 3` | `2` with `tls`, else `1` | HTTP protocol version. Falls back to the nearest available lower version. |
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
| `publicDir` | `string` | — | Absolute path to a directory served at the root URL level (e.g. `robots.txt`, `favicon.png`). Files are checked before `static` prefix routes. |
| `static` | `Record<string, string>` | — | URL prefix → filesystem path mappings for static file serving. |
| `ssrOnly` | `boolean` | `false` | Omit client-side JS from the rendered page. Useful for verifying SSR HTML without hydration. |
| `streaming` | `boolean` | `false` | Stream HTML to the browser incrementally to reduce TTFB. See [Streaming](#streaming). |
| `middlewares` | `SSRMiddleware[]` | — | Array of custom middleware functions executed before the SSR renderer on every request (see [Custom middlewares](#custom-middlewares)). |
| `rsc` | `SSRRscConfig` | — | React Server Components endpoint configuration (see [RSC](#react-server-components-rsc)). |
| `compression` | `SSRCompressionConfig \| false` | Brotli, then gzip | Response compression (see [Compression](#compression)). `false` never compresses. |
| `health` | `SSRHealthConfig` | identity payload | The `/health` endpoint. `check` adds live state per probe and turns it into a readiness probe (see [Health](#health)). |
| `adapters` | `SSRAdapters` | — | Required. Adapter callbacks for data fetching. |
| `onListenError` | `(error, { port, host, label }) => void` | exits non-zero | What to do when the server cannot take its port. By default it prints what went wrong and what to do about it, then exits — a process whose server never bound is not running. Supply this to keep it alive and decide yourself. |

### HTTP version behaviour

| `httpVersion` | TLS required | Transport |
|---|---|---|
| `1` | No | Plain HTTP, or HTTPS when `tls` is set |
| `2` | Yes | HTTP/2 with HTTP/1.1 fallback via ALPN |
| `3` | Yes | HTTP/2 primary + HTTP/3 QUIC when available |

HTTP/3 requires Node.js ≥ 23 started with `--experimental-quic`. When unavailable the server falls back to HTTP/2 and logs a warning. An `Alt-Svc` response header is added automatically so browsers can upgrade.

## Adapters

The `adapters` option is the integration point between the SSR server and your data layer. For the auth ones, `createAuth` answers all three for you — see [User authentication](#user-authentication).

```ts
type SSRAdapters = {
  getOfflineData: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  getSpaceDeployment: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  authenticate?: (credentials: Record<string, string>, req: SSRRequest) => Promise<SSRSession | undefined>;
  endSession?: (req: SSRRequest) => Promise<void>;
  getRscData?: (context: SSRRscContext) => Promise<SSRRscData>;
};
```

- **`getOfflineData`** — returns the space snapshot (schema, plugins, styles, segments, collections) for SSR.
- **`getSpaceDeployment`** — resolves which space and environment to render for a given inbound request. Return `{ error: { code, message } }` to abort with an HTTP error. Optionally include `templateProps` to override template variables, or `pluginNames` to activate plugins for the space (see [Plugins](#plugins) and [Template props](#template-props)).
- **`getUser`** *(optional)* — resolves the authenticated user from the inbound request (e.g. via a session cookie or `Authorization` header). Called in parallel with `getOfflineData` on every cache miss. Return `undefined` for unauthenticated requests. What it returns is inlined into the page — `authenticated`, `user.details`, the access token and its expiry — and that does two things: it decides page-level access for guest vs. registered users during the render, and it **saves the browser its first auth request**. The SDK adopts the inlined session on boot, stores it and schedules the renewal, rather than asking the same authority the same question a few milliseconds later. Implement this one adapter and every server-rendered page starts signed in with no round trip; `createAuth` answers it for you.
- **`authenticate`** *(optional)* — called when `POST {loginPath}` is received, with the credentials already parsed from the body (a posted form or JSON), whatever fields they are. Return a session to grant one, `undefined` to refuse — and never throw for a wrong password. **Identity only**: the cookies, their lifetimes and the readable hint are the server's, which is what keeps a session established here visible to the API side and the other way round. For a navigation (full-page form submit, `Sec-Fetch-Mode: navigate`) the server answers a `303` so the view re-renders via a GET; for a fetch it answers `200` with `{ success, access_token, expire_at }` or `401` with `{ error, reason }` — never a bodyless status, which leaves a caller holding nothing. This route knows a session and not the account behind it; `createServer({ auth })` serves the same path from the auth kernel instead, which answers the full grant.
- **`endSession`** *(optional)* — called when `POST {logoutPath}` is received. Revoke the session at the source; the server clears the cookies. Clearing them alone would leave the credential itself working for anyone who had already copied it. A navigation receives a `303` redirect; a fetch receives `204 No Content`.
- **`getRscData`** *(optional)* — called by the RSC endpoint (`/_rsc`), and once per page render, to fetch server-side data for schema elements with `runtime: 'server'`. Takes one `SSRRscContext`: the request, the space context, the resolved user so authenticated operations are safe, `ids` on a partial refresh (absent means every element), and `loadOfflineData`. That last one is the space itself, shared with the page render happening alongside — await it instead of fetching the schema again, and it is read once per request however many callers ask. Return `{}` when there is no server data for the current request (see [RSC](#react-server-components-rsc)).

## Space adapters (a space per domain)

`getSpaceDeployment` looks like glue and is not: the same handful of rules turn up in every deployment that serves
more than one space, and getting any of them wrong is a real failure. `createSpaceAdapters` states them once and
asks you only for the lookups.

```ts
import { authoringPreview, createSpaceAdapters, verifiedDomain, wildcardSubdomain } from '@plitzi/sdk-server';

const spaces = createSpaceAdapters({
  resolvers: [
    authoringPreview({ hosts: platformHosts, resolveGrant: auth.identity.resolveGrant, find: findSpace }),
    wildcardSubdomain({ suffix: 'example.app', find: findSpaceBySlug }),
    verifiedDomain(findDeploymentByDomain)
  ],
  cache: redisCache,
  frameAncestors: { find: findSpaceDomains, floor: platformHosts, cache: true },
  decorate: resolution => Promise.resolve({ pluginNames: pluginsFor(resolution.spaceId) })
});

createServer({ adapters: { ...spaces.adapters, getOfflineData } });
```

**Resolvers are an ordered list**, and the order is the policy. Each returns a resolution, a refusal, or nothing —
and the difference between the last two is the point: a refusal ENDS the chain, so a request that tried to act for
a space and failed is never quietly served as an anonymous visitor of whatever else that host resolves to. Three
are built in and a fourth is `(req) => …` of your own, which is how a deployment that identifies tenants by header,
by path prefix or by a table nobody else has still gets everything below.

| Built in | What it is |
|---|---|
| `authoringPreview` | An author looking at their own space through a builder, on a host you own. Marks the render `authoring` so metering skips it. Put it first. |
| `wildcardSubdomain` | `<slug>.example.app`, with no per-space row to configure. Refuses to read a deeper sub-domain as a slug. |
| `verifiedDomain` | A custom domain, through a row that says it was proven. |
| `fixedSpace` | Always this one — a single-space deployment, or a catch-all last in the chain. |

What it decides for you:

- **A credentialed request is never served from, nor written to, the shared cache.** It is keyed by host, and a
  credential resolves the same host to a different space — so a hit would serve one author's preview to the next.
- **`frame-ancestors` is derived on every resolution**, from the domains the space declared plus your floor.
  Deriving it per branch is how a deployment ends up with one branch that forgets, and that branch serves a space
  framable by anyone.
- **Refusals are not cached**, so fixing a row fixes the site rather than fixing it in five minutes.
- **A resolver that throws is a 404 for that request**, reported through `onError`, not a dead server.

`cache` is any `get`/`set`/`delete` of strings — Redis, Memcached, whatever you have — or `createMemoryCache()` for
a single-process deployment. `invalidate.resolution(host)` and `invalidate.domains(spaceId)` drop what a change made
untrue, which matters the moment an owner edits a domain list: until then the old framing policy stands, and a TTL
is not a security boundary.

## JSON adapters (offline mode)

`createJsonAdapters` provides a ready-made adapter set that reads a space from local JSON files, useful for offline mode, integration tests, and static deployments.

```ts
import { createServer, createJsonAdapters } from '@plitzi/sdk-server';

const server = createServer({
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
| `offlineData` | `OfflineDataRaw` | The space itself, for a consumer that already holds it. Read-only: `saveOfflineData` is offered only for a path. |
| `deployment` | `string` | Path to a JSON file containing an `SSRSpaceDeployment` object. |
| `deployment` | `SSRSpaceDeployment` | Inline deployment object used for every request. |
| `deployment` | `Record<hostname, SSRSpaceDeployment>` | Per-hostname map. Use `'*'` as a catch-all. |

## Auth adapters

Where a space comes from and who is looking at it are two integrations, so they are two factories. `createAuthAdapters` answers the identity half, and the two compose with a spread:

```ts
import { createAuthAdapters, createJsonAdapters, createServer } from '@plitzi/sdk-server';

createServer({
  adapters: {
    ...createJsonAdapters({ offlineData: '/exports/offline.json' }),
    ...createAuthAdapters({ user: req => sessionsFor(req) })
  }
});
```

### `AuthAdaptersConfig`

| Option | Type | Description |
|---|---|---|
| `user` | `SSRUser` | Fixed user returned for every request. Useful for testing authenticated flows. |
| `user` | `(req) => SSRUser \| undefined \| Promise<SSRUser \| undefined>` | Dynamic resolution per request. |
| `authenticate` | `(credentials, req) => Promise<SSRSession \| undefined>` | Verify credentials and mint a session for `POST {loginPath}`. |
| `endSession` | `(req) => Promise<void>` | Revoke this request's session for `POST {logoutPath}`. |

Anything left out is omitted rather than set to `undefined`, so composing these never unwires an adapter another factory supplied.

A deployment running the auth kernel needs none of this: `createServer({ auth })` fills the same three in from `createAuth(...).ssrAdapters`, and serves the full `/auth` surface instead of just login and logout.

## What the server does without being asked

Four things it used to make every deployment declare, each of which it can answer itself:

| | |
|---|---|
| **The SDK bundle** | The rendered page is told to fetch `/sdk-assets/plitzi-sdk.js`, so the server serves it, from its own copy of `@plitzi/plitzi-sdk`. Declaring `static: { '/sdk-assets': … }` still wins — a pinned build, a CDN mirror |
| **The transport** | `httpVersion` defaults to HTTP/2 with `tls` and HTTP/1.1 without. No browser speaks cleartext h2, so the old default of `2` meant every local run had to say otherwise |
| **The audience** | `tokens.audience` defaults to the issuer, which is right for a deployment that is its own audience |
| **The space** | `createJsonAdapters({ offlineData })` alone resolves to space 1, `main`, revision 0 |

A page server therefore needs `port`, `adapters`, and nothing else.

## Health

Every server answers `GET /health` with its identity — no wiring needed:

```json
{ "Server": "SDK Server", "Version": "v1.2.3", "role": "ssr" }
```

`check` adds what only the deployment can know, read on every probe. Returning `healthy: false` answers **503**,
which is what makes this a readiness probe rather than a liveness one: an orchestrator stops routing to a replica
whose database has gone, instead of sending it traffic it can only fail. A check that throws is itself an unhealthy
answer, reported as one rather than as a 500.

```ts
createServer({
  health: {
    role: 'ssr',
    name: 'Acme Renderer',
    version: pkg.version,
    check: () => ({ Databases: { mongo: mongo.status() }, healthy: mongo.healthy })
  },
  adapters
});
```

## Static files

Map URL prefixes to local directories:

```ts
createServer({
  static: {
    '/sdk-assets': './node_modules/@plitzi/plitzi-sdk/dist',
    '/builder-assets': './node_modules/@plitzi/plitzi-builder/dist'
  },
  adapters: { ... }
});
```

Static responses include `ETag`, `Last-Modified`, and `Cache-Control` headers. Subsequent requests with `If-None-Match` receive `304 Not Modified` when the file has not changed. JS, CSS, and font files are served with `Cache-Control: immutable`; all other assets use a 1-hour max-age.

### Public directory

Use `publicDir` to serve your own root-level files (e.g. `robots.txt`, `sitemap.xml`, `favicon.png`) without prefixes:

```ts
createServer({
  publicDir: path.resolve(process.cwd(), 'src/services/ssr/public'),
  adapters: { ... }
});
```

The lookup order for a request is: `publicDir` → `static` prefix routes → SSR renderer.

`/.well-known/` paths follow the same lookup order: served from `publicDir` if a matching file exists, otherwise `404 Not Found`. They are never handled by the SSR renderer.

## Compression

Responses are compressed based on the `Accept-Encoding` request header. By default the server offers Brotli, then
gzip, and leaves payloads under 1 KB alone — below that the compressed body plus its headers is no smaller.

`Content-Encoding` and `Vary: Accept-Encoding` are set on every compressed response. An encoding the client refused
with `q=0` is never used.

```ts
createServer({
  compression: { encodings: ['gzip'], threshold: 2048, gzipLevel: 9 },
  adapters
});

// Nothing at all — for a CDN or proxy in front that already compresses.
createServer({ compression: false, adapters });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `encodings` | `('br' \| 'gzip')[]` | `['br', 'gzip']` | What this server offers, most preferred first; the first one the client accepts wins. `[]` disables compression. |
| `threshold` | `number` | `1024` | Responses smaller than this many bytes go out uncompressed. |
| `brotliQuality` | `number` | `4` | Brotli quality, 0–11. Past 4 the CPU cost outgrows the bytes saved on HTML. |
| `gzipLevel` | `number` | `6` | Gzip level, 0–9. |

A response that sets `Cache-Control: no-transform` is never compressed, whatever the settings say — that header is
how a handler declares its body must reach the client byte for byte. The OAuth token endpoint in
[`@plitzi/sdk-mcp`](../mcp/README.md) relies on it: a credential travelling beside a caller-chosen value is the
shape a BREACH-style attack needs.

## Render cache

SSR output is cached in-memory per `(spaceId, environment, revision, hostname, path, search)`. The cache uses a 5-minute TTL by default. The `main` environment is always excluded from caching — it is the development environment and its schema changes frequently.

```ts
createServer({
  cacheTtlMs: 60_000,  // 1 minute
  adapters: { ... }
});

// Disable caching entirely
createServer({
  cacheTtlMs: 0,
  adapters: { ... }
});
```

Schema data (`getOfflineData`) is also cached under the same TTL, keyed by `(spaceId, environment, revision)`. This avoids repeated adapter calls on consecutive HTML cache misses for the same space version.

Responses include an `X-Cache: HIT` or `X-Cache: MISS` header for observability. The cache is cleared and its sweep timer is stopped when `server.close()` is called.

### Cache manager

`server.cache` exposes programmatic cache control, useful when content changes and you need to invalidate entries without restarting the server.

```ts
const server = createServer({ cacheTtlMs: 300_000, adapters });

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

const server = createServer({
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

Every plugin registered through `createServer` (or via `server.plugins.register`) is versioned. If you omit `version`, it defaults to `'1.0.0'`:

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
const server = createServer({ adapters });
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
import type { SSRAdapters, SSRRscContext, SSRRscData } from '@plitzi/sdk-server';

const getRscData = async ({ user, ids, loadOfflineData }: SSRRscContext): Promise<SSRRscData> => {
  // Only serve data when the schema has RSC enabled. `loadOfflineData` joins the read the page render already
  // started — it never costs a second trip to your database.
  const offlineData = await loadOfflineData();
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
4. Calls `adapters.getRscData({ req, spaceId, environment, revision, user, ids, loadOfflineData })`.
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
createServer({
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

Sessions, in one call. `createAuth` takes what only your deployment knows — the signing secret, what you call your
cookies, and the store your accounts live in — and returns the whole cycle wired together.

```ts
import { createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';

const auth = createAuth({
  tokens: { secret: process.env.AUTH_SECRET, issuer: 'https://acme.com', audience: ['https://acme.com'] },
  cookie: { name: 'acme_session' },
  adapters: accounts
});

createServer({ port: 443, adapters: { getOfflineData, getSpaceDeployment }, auth });
```

There is no third argument for the security-relevant parts, on purpose: password hashing defaults to scrypt, sign-in
is rate-limited in memory, mailed links expire, and CSRF is on. Each of those used to be an option with no default —
which meant the ordinary deployment went without, because nobody configures what they have not read about. Supply
`api.hashPassword`/`verifyPassword` to keep an existing algorithm (a store of bcrypt hashes needs bcrypt), and
`api.rateLimit` to put one counter behind a fleet.

`auth` on the server is the whole of the wiring: it mounts the `/auth` flows, answers the identity adapters a page
server asks for, and carries the cookie naming with it — so there is no second place to keep in step. Everything is
still exported separately (`createTokens`, `createIdentity`, `createAuthApi`, `authRoutes`, …) for a deployment that
wants to assemble or replace one piece.

Nothing here assumes a web framework: a request is `{ headers, hostname, cookies?, query?, body? }` and a response is
anything that can carry `Set-Cookie`, both true of bare `node:http`.

### Serving the flows from your own server

A page server gets the `/auth` surface from `createServer({ auth })`. A deployment that serves its API elsewhere —
its own HTTP server, or one behind a router — gets the same flows as ready-made handlers from
`@plitzi/sdk-server/handlers`.

**That entry imports no framework and does not add one as a dependency.** The request, response and router are
described by the few properties the handlers touch, which an Express, Connect or Koa object already satisfies and a
`node:http` server satisfies with a few lines of its own.

```ts
import { createAuthMiddleware, mountAuthRoutes } from '@plitzi/sdk-server/handlers';

// Every request: resolves the credential against your policy and puts it on `req.user` / `req.grant`,
// or answers `{ error, reason }` with the right status.
app.use(createAuthMiddleware(auth.identity, policy));

// The twelve flows, on whatever has `get` and `post`.
const router = Router();
mountAuthRoutes(router, { api: auth.api, cookies: auth.cookies });
app.use('/auth', router);
```

Without a router, `createAuthRouteHandlers` returns the same flows as a list — `{ method, path, handle }` — and
dispatching them is yours:

```ts
import { createAuthRouteHandlers } from '@plitzi/sdk-server/handlers';
import { parseRequest } from '@plitzi/sdk-server/kernel';

const routes = createAuthRouteHandlers({ api: auth.api, cookies: auth.cookies });
const route = routes.find(r => r.method === req.method && `/auth${r.path}` === req.path);
await route?.handle(req, res);
```

What is *not* here is anything a deployment must decide: its accounts, its policy, its cookie naming. Those stay
`createAuth`'s. What is here is the part that was identical in every deployment that wrote it by hand — including
one real trap: `hostname` is a prototype getter on several frameworks, so building the carrier with a spread drops
it, and every cookie is then named for nowhere.

### What you implement

An account store. These are the only functions the server needs from it, and it never learns whether they read
Postgres, MySQL, Mongo or an identity service:

| Adapter | Needed for |
|---|---|
| `findAccountByToken(token)` | every request — the row **is** the revocation switch, so look accounts up *by token* |
| `saveSession(userId, session)` | signing in and renewing. Storing the new pair retires the previous one; that is rotation |
| `clearSession(target)` | signing out |
| `loadAccess(userId)` | the roles and permissions a grant answers with |
| `findByUsername(username)` | password sign-in |
| `findByRefreshToken(token)` | renewal. Answer with `refreshExpiresAt`, or every renewal is refused as expired |
| `findMembership(userId, spaceId)` | space-level permission checks (`auth.can`) |
| `createAccount`, `findByEmail`, `setResetToken`, `sendMail`, … | signup, password reset, verification |

**What is absent decides what the deployment offers.** No `createAccount`, no signup — and the route answers 404
rather than failing at runtime. Declining a flow is one act: do not implement it. `GET /auth/capabilities` publishes
the result, so a sign-in page renders what the backend actually answers instead of a button that dead-ends.

### …or don't: `@plitzi/sdk-server/mysql`

If you are standing a user store up rather than adapting one you have, the table above is ceremony. Import the
store instead — it is every adapter in it, already written, over tables it creates:

```ts
import { createMysqlStore } from '@plitzi/sdk-server/mysql';

const store = await createMysqlStore({ url: process.env.DATABASE_URL });

const auth = createAuth({
  tokens: { secret, issuer },
  adapters: store.authAdapters,   // spread your own on top: { ...store.authAdapters, sendMail }
});
```

It connects to a MySQL server; it does not start one. `store.admin` seeds the roles, permissions and memberships
that no request creates. `mysql2` is an optional peer dependency, since this is the only part of the package that
touches a database.

The tables, the contract they satisfy, and the four traps that fail somewhere other than where they were caused
are in [`docs/auth/mysql-schema.md`](./docs/auth/mysql-schema.md) — worth reading even if you are mapping your own
schema, because it is written as the set of questions your adapters have to answer.

### What you get

`POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/sessions/revoke`, `/auth/exchange`, `GET /auth/session`,
`GET /auth/capabilities`, plus signup, password reset and verification where the adapters support them. Sign-in and
sign-out also answer a full-page form submission with a `303` so the view re-renders, which a `fetch` client does
not need and a `<form>` does.

**Changing an email is a confirmation, not a write.** Supply `setPendingEmail` / `findByPendingEmail` /
`clearPendingEmail` (the MySQL store has them) and `POST /auth/profile` parks the new address instead of applying
it: the account keeps signing in with the old one until `POST /auth/confirm-email` proves somebody reads the new
one, which also marks it verified. A typo then costs a resend rather than the account. Leave them out and the
address changes on the spot, as before.

**Impersonation is off until you name its permission.** With `api.impersonationPermission` set,
`POST /auth/admin/impersonate` answers a session as another account — one that carries `act` (RFC 8693) so every
request made with it is distinguishable from the account holder's, lives fifteen minutes, cannot renew, and is
returned in the body rather than written over the administrator's own cookie. `Actor.impersonatedBy` is that claim
read back, and `GET /auth/session` reports it.

Behaviour you do not have to get right yourself: the credential is renewed ahead of expiry and rotated when it is;
signing out revokes at the source rather than only clearing the browser's copy; a readable hint cookie rides beside
the session carrying nothing but expiry timestamps, so a page can tell that nobody is signed in without a request;
and every refusal names a machine-readable `reason`, so a client can tell "renew me" from "you are gone".

### Beyond the defaults

| Config | Effect |
|---|---|
| `cookie` | Name, domain, `SameSite`, `Secure`, the refresh path, the hint suffix. Defaults derive from the request host |
| `api.password` | What a password has to be. `minLength` defaults to 8 (NIST SP 800-63B's floor); `validate` is where a breach-list lookup or a strength estimator goes. Applied wherever one is set — signing up, resetting, changing |
| `api.rateLimit` | May this attempt proceed? **Defaults to an in-memory sliding window**, so no deployment is unthrottled by omission; supply one to put a single counter behind a whole fleet. Called before the password is checked, so a throttled attempt costs no hash |
| `api.adminPermission` | The global capability the `/auth/admin/*` routes require. Default `userManage` |
| `api.impersonationPermission` | The capability it takes to obtain a session **as** another account, and the switch that offers the flow at all — **absent, there is no impersonation**. Its own permission on purpose: suspending an account and becoming one are not the same grant |
| `api.onEvent` | Every act worth recording — sign-ins, failures, password changes, admin actions — as a `SecurityEvent`. An audit trail, a webhook and an alert are the same feed. Never awaited and never able to fail a request |
| `api.mfaIssuer` | What an authenticator app calls this deployment. Defaults to the token issuer |
| `tokens.lifetimes.session` | The longest a session may live however often it renews. `0` (default) means no cap — the renewal window is already an idle timeout, since a session nobody refreshes dies with its refresh token |
| `api.onMailError` | Where a failed delivery is reported. It is never thrown: every one of these sends after something has already been committed, so letting the provider decide whether the request succeeded reports a change that did happen as a 500 |
| `basePath` | Where the flows are mounted. The guard's rules follow it |
| `rules` / `fallback` | Extra authorization rules, applied before the derived ones, and what an unlisted path requires |
| `identity` | Your own hosts and origins — the floor for domain binding and framing |
| `tokens.lifetimes` | How long each credential lives |

Working examples are in [`examples/02-with-users`](../../examples/02-with-users): `01-sessions` over a store you
write, `02-mysql` over one you do not.

### Cross-site request forgery

**On by default.** The session cookie defaults to `SameSite=None` off localhost — a space is embedded in an iframe
on somebody else's domain — so the browser attaches it to requests another site caused. That is the attack, and
`Lax` is what would otherwise prevent it.

Two requests can never be forged into whatever they are reaching, and neither is ever asked for a token:

| Never asked | Why |
|---|---|
| `GET`, `HEAD`, `OPTIONS` | They change nothing |
| Anything with `Authorization: Bearer` | A cross-origin page cannot set that header without a preflight you would have to allow. **Every API client is unaffected** |

After that it depends on what the flow does, because there are two different attacks:

| Flow | Guarded by | Because |
|---|---|---|
| **An action taken as somebody** — profile, password, sessions, admin | A token, whenever a **session cookie** is present | The attack is the browser attaching the victim's credentials. No cookie, nothing to forge |
| **A sign-in** — login, signup, the password-reset pair, the passwordless and MFA halves, `confirm-email` | A token, whenever the request came from **a site this deployment does not recognise** | There is no cookie to protect yet. The attack is login CSRF: another site signing a visitor into an account *it* controls. What separates that from a legitimate sign-in is not a cookie — it is where the request came from |
| **`/auth/exchange`** | Its own grant | It acts for a space and is already refused unless the origin is one that space declared — narrower than any list here. A space is embedded on somebody else's domain by design |
| **`/auth/refresh`, `/auth/logout`** | Nothing | Both authenticate with the refresh credential and must work when the access token has lapsed. Forging either gains an attacker nothing: renewing somebody's session hands the new credential to their own browser |

**"A site this deployment recognises"** is decided by two headers a page cannot set: `Sec-Fetch-Site` — the
browser's own account of where the request came from — and, where that is absent, `Origin`, matched exactly against
this host or `identity.platformOrigins`, the hosts you already declared. **Neither header present means the caller
is not a browser**, and a client that is not a browser has no victim's session in it to forge with — which is what
lets every API client, mobile app and script sign in with nothing extra to send.

#### What a browser client does

```js
// Once, or whenever a write is refused with 403 and reason "mismatch".
const { token } = await (await fetch('/auth/csrf', { credentials: 'include' })).json();

await fetch('/auth/profile', {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json', 'x-csrf-token': token },
  body: JSON.stringify({ email })
});
```

The same token is also written to a **readable cookie** (`<session cookie>_csrf`), so a page that would rather read
it out of `document.cookie` than call an endpoint can. A `<form>` without JavaScript posts it as `_csrf` instead.

**Signing in re-issues it.** The token a signed-out page held is bound to nobody, and every write it attempted
afterwards would be refused — so the grant that creates a session writes a fresh cookie bound to it. A client that
re-reads the cookie after signing in never notices this exists.

#### Why it is a signed token and not just a matching cookie

Plain double-submit compares a cookie to a header, which fails against anyone who can *write* a cookie — a
sub-domain they took over. Here the token is an HMAC over a nonce **and the session it belongs to**, so forging one
needs the secret, and a token minted for one session is refused for another. A refusal always names a `reason`:
`missing`, `malformed`, `expired` or `mismatch`.

There is nothing to configure: the secret, the cookie scope and the origins all come from what you already told
`createAuth`. Turn it off entirely with `csrf: false`. Outside this package, `createCsrfMiddleware` from
`@plitzi/sdk-server/handlers` applies the same check to your own routes.

### `SSRUser`

What a rendered page sees, so a schema can restrict pages to signed-in visitors — the SDK reads `authenticated` and
`user.details`.

| Field | Type | Description |
|---|---|---|
| `token` | `string` | Opaque token or JWT. |
| `id` | `number` | Unique user identifier. |
| `username` | `string` | Display name. |
| `email` | `string` | Email address. |
| `verified` | `boolean` | Whether the account is active/verified. |
| `permissions` | `string[]` | Permission keys for fine-grained access control. |
| `roles` | `string[]` | Role names. |

### Bringing your own identity entirely

Skip `createAuth` and implement three adapters directly — the server then knows only what you tell it:

```ts
createServer({
  adapters: {
    getOfflineData,
    getSpaceDeployment,
    getUser: async req => /* … resolve the visitor, or undefined */,
    authenticate: async (credentials, req) => /* … a session, or undefined to refuse */,
    endSession: async req => /* … revoke it */
  },
  loginPath: '/api/login',   // or false to serve no endpoint
  logoutPath: false
});
```

`authenticate` returns identity and nothing else: the cookies, their lifetimes and the readable hint are the
server's, which is what keeps a session established on the API side visible to the renderer and the other way round.

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

createServer({
  middlewares: [corsMiddleware, rateLimitMiddleware],
  adapters: { ... }
});
```

Middlewares run after the built-in auth checks (Basic auth, `spaceDeployment` resolution, `getUser`) and before RSC and the SSR renderer.

## Extending the pipeline

A page server runs a fixed, ordered pipeline of stages. Order is an invariant — static assets first, then stages
that authenticate themselves, then the auth middleware chain, then the data services, then the renderer — so a
companion package does not hand over a list of stages. It hands them over by **slot**, and this package decides
where the slot lands:

```ts
import { createServer } from '@plitzi/sdk-server';
import { mcpExtensions } from '@plitzi/sdk-mcp';

const server = createServer({ adapters }, mcpExtensions());
```

| Slot | Runs | For |
|---|---|---|
| `preAuth` | after static assets, **before** the auth middleware chain | stages that gate themselves — on a shared secret, a bearer token, or nothing at all |
| `data` | after the auth chain, before the page render | stages serving data to an already-identified visitor |

Pass only the stages you want rather than the whole bundle:

```ts
import { previewStage } from '@plitzi/sdk-mcp';

// Draft-preview, but no MCP endpoint on this port.
const server = createServer({ adapters, preview: { enabled: true, secret } }, { preAuth: [previewStage] });
```

A stage receives the `SSRContext` — the request, the config, and the render singletons (`renderFn`,
`pluginManager`, `caches`) — and returns `true` when it has answered, `false` to fall through. Passing the stages
**is** the decision to mount them: there is no config flag mirroring it, and a server that never passes them
never loads them.

## Running it locally

The package ships a small harness in [`dev/`](./dev) — file-backed adapters over a sample space, three demo
plugins and a demo style document — so you can exercise SSR and RSC without standing up a platform:

```bash
yarn start        # pages + RSC on :3002 against dev/sample
yarn start:dev    # same, resolving every @plitzi/* workspace package from source
yarn start:watch  # same as start, restarting on change
```

`SSR_ENABLED=0` and `RSC_ENABLED=0` switch the surfaces off individually; `LOG_REQUESTS=0` quiets the request log.
Writes land back in `dev/sample`, so `git restore dev/sample` resets a session.

`dev/` is not part of the published package and nothing in `src/` imports it — it consumes this package's public
API exactly as a consumer would.

## SSR-only mode

Set `ssrOnly: true` to serve raw server-rendered HTML without any client-side scripts. Useful for inspecting SSR output or building purely static pages:

```ts
createServer({
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

createServer({
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

createServer({ templateFn, adapters: { ... } });
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
createServer({
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

## Examples

Runnable setups live in [`examples/`](../../examples): server-rendering a space, adding React Server Components,
and mounting the MCP endpoint and draft preview alongside pages. Each one starts with `yarn start` and is a real
package, not a snippet.

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
  JsonAdaptersConfig,
  AuthAdapters,
  AuthAdaptersConfig
} from '@plitzi/sdk-server';
```
