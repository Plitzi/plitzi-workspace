# @plitzi/sdk-server

The page server for Plitzi spaces: server-side rendering, React Server Components, plugins, connectors and signing
people in. Ships as an HTTP/2 server by default, with support for HTTP/1.1 and HTTP/3.

What it is built on — the HTTP server and its pipeline, health and shutdown, checking who a request is — is
[`@plitzi/sdk-kernel`](../../packages/sdk-kernel/README.md), which every Plitzi server process shares.

This package serves **pages**. The AI surface — the MCP server, its tool engine and the draft-preview
endpoint — lives in [`@plitzi/sdk-mcp`](../mcp/README.md), which runs on the kernel and depends on this one's narrow
entries alone (OAuth, and the renderer for draft preview), never the other way round. A deployment that only renders pages
never installs it, and never loads it.

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

```bash
yarn add @plitzi/sdk-authoring   # writing spaces is its own package, and it installs nothing else
```

```ts
// server.ts
import { authorSpace, container, heading, link, text } from '@plitzi/sdk-authoring';
import { consoleLogger } from '@plitzi/sdk-kernel/log';
import { createJsonAdapters, createServer } from '@plitzi/sdk-server';

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
node server.ts     # http://127.0.0.1:3001/ — Node 24 runs TypeScript itself
```

No transpiler in front of it: Node strips the types. A loader such as `tsx` costs a page server more memory than the
server itself — on a 128 MB host, the difference between starting and being killed on boot.

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
JSON from memory. It is `@plitzi/sdk-authoring`'s file, shipped here as well so a server has it without installing
anything else:

```bash
cp -R node_modules/@plitzi/sdk-server/skills/plitzi-authoring ~/.claude/skills/
```

It installs the same way into any agent that reads a `SKILL.md` (Claude Code, VS Code / Copilot, Codex, Gemini
CLI, Cline, Goose). Everything it defers to is in the package too: every factory, spec field and step builder
carries its documentation in the published `.d.ts`, so hovering a call or reading
`node_modules/@plitzi/sdk-authoring/dist/index.d.ts` answers what an attribute takes without leaving the project.

### Already have a space?

An export from the builder is a `{ schema, style }` JSON and goes in the same door:

```ts
adapters: createJsonAdapters({ offlineData: './space.json' })
```

`validateSpace({ schema, style })` from `@plitzi/sdk-authoring` answers whether one is servable before you
serve it — worth running over anything that arrives as a file.

A space on Plitzi comes out whole, as a project wired to this server: `npx @plitzi/cli create my-site --from <space>`
writes its pages as authoring code, its actions as `defineAction` code, its functions, the source of its plugins and
runtime, and its files into `public/` — a draft, or any published snapshot (`--environment`, `--revision`) — and
`plitzi space pull` keeps it in step, and `plitzi space push` puts what changed in it back on the space. See
`docs/en/projects-from-spaces.md` in the workspace.

## Projects

A project `npx @plitzi/cli create --mode server` writes runs this server through `serveProject`, from
`@plitzi/sdk-server/project` — its own entry, so a server that is not such a project never loads it. The project's
`src/main.ts` hands it what is the project's, and `serveProject` wires everything else from where the project keeps it
(the layout is `@plitzi/sdk-shared/project`'s):

```ts
import { serveProject } from '@plitzi/sdk-server/project';

import { authorProjectSpace } from '@plitzi/sdk-authoring/node';

import { actions, connectors } from './actions/index.ts';
import { serverOptions } from './config/serverOptions.ts';

await serveProject({ space: authorProjectSpace, actions, connectors, serverOptions });
```

`space` is called once the project's root and layout are checked: `authorProjectSpace` reads `src/space/index.ts`'s
`space` — `dist/space/index.js` when the server runs what `build` emitted (`projectModule` of
`@plitzi/sdk-shared/project`, the rule the runtime is found by too) — and authors it with `projectAuthoring()`. A
module that exports no `space` is refused saying what to export (`ProjectSpaceError`), and a space that does not author
with every problem (`SpaceRefusedError`): each printed as the report it is, and the process exits with 1. Started with
`PLITZI_PREVIEW_FILE` (`PREVIEW_FILE_ENV`) naming an element to draw alone — what `plitzi task look --alone` sets for
its own server — the space gets a page for it at `/plitzi-preview`; a name that is no component or element type is
refused saying which there are (`SpacePreviewError`).

Production runs the project bundled — `bundleProject` of `@plitzi/sdk-server/bundle`, which the project's `build` calls
(`.plitzi/build.ts`): `dist/main.js`, and the modules the server imports by their path as it runs — the space
(`dist/space/index.js`) and the runtime (`dist/runtime/index.js`), where `projectModule` looks for them in a built
project — with what they share in `dist/chunks/`, so the three are one copy of every package. React and the SDK stay in
`node_modules`: the plugins the server compiles when it starts import them from there, and a second React would draw
with other contexts. So does a native package, found by its manifest (`gypfile`, a binary, a loader of one), and one
named in `external` — a package that reads its own files by a path of its own. The plugins and the functions are built
from their source at boot, as always.

The project is the working directory — where every script of its `package.json` runs it, and where a deployment runs
`node dist/main.js` — never worked out from where a file is: `serveProject` and `authorProjectSpace` refuse to start
anywhere else, naming what is missing (`package.json`, `src/`; `projectRoot` of `@plitzi/sdk-shared/project`, one
check for both). Its settings are in `process.env` before any module loads: the scripts start Node with
`--env-file-if-exists=.env`, and no file of the project reads `.env`. `start:dev`, which Node watches, preloads it
instead — `node --import @plitzi/sdk-server/env --watch-path=… src/main.ts` — since Node, handed an env file under
`--watch-path`, watches the folder it is in and restarts on every write there: the server's own `tmp/`, from boot.

Both hold the project to its layout before anything else (`assertProjectLayout` of `@plitzi/sdk-shared/project`,
what `plitzi doctor` says too): a part where the server would read nothing — a plugin folder with no `index.ts` (or
`index.tsx`), code in `src/plugin/`, `.env` in `src/`, a built plugin with no manifest — stops the boot with every error
at once (`ProjectLayoutError`, each with its fix; `findings` holds them as data), and what works and should not stay —
a plugin with no `declaration.ts`, no `.env.example` — is printed while developing, `[layout] …`.

| Option | What it is |
|---|---|
| `space` | The space held in the project: a function that authors it — `authorProjectSpace` — called once the project's layout is checked (a save while developing is authored again by `.plitzi/author.ts`, in a process of its own). Served from memory; its `warnings` are printed at boot. |
| `cloud` | Instead of `space`: `{ name }` — the space stays in Plitzi and is read with `createCloudAdapters`, from `PLITZI_HOST_KEY` (required), `PLITZI_ENVIRONMENT` (`main` by default), `PLITZI_REVISION` and `PLITZI_SERVER_URL`. `name` is what `/health` answers with. |
| `actions`, `connectors` | The space's server actions, found by their id, and the connectors they call. Left out, the server runs no actions. |
| `serverOptions` | The project's `src/config/serverOptions.ts`, typed `ProjectServerOptions`: what `createServer` takes but for what `serveProject` wires, spread before it — `logLevel` and `logger` (`warn`, to the console; `--verbose` on the command line: `info`), `auth`, `images`, `rsc`, `action.limits`, `action.kv` are the project's to set. |

What it wires from the project:

- **The port.** `PORT`, or 8080 — while developing, the next free one from there (`freePort`). `HOST`, loopback by
  default (`0.0.0.0` in a container, or for a phone on the Wi-Fi — it prints every address to open, and while it
  listens on loopback alone, how to open it).
- **HTTPS.** `TLS_CERT` and `TLS_KEY` in `.env`, the paths of a PEM certificate and its key — what `plitzi cert` makes
  for this machine and its network addresses — unless `serverOptions.tls` gives one itself. Over plain http a phone's
  browser gives a page no microphone, camera or clipboard. A network address the certificate does not name (the
  router handed the machine a new one) is said at boot; this machine's mDNS name (`studio.local`), when the
  certificate names it, is printed among the addresses, and outlives them.
- **Where people reach it** — the runtime's `publicUrl`: `PUBLIC_URL` behind a proxy; with `HOST` open to the network,
  this machine's address there (what a tablet on the Wi-Fi opens, and an OAuth provider sends it back to); this
  machine's loopback otherwise — `https` whenever it serves a certificate. Serving TLS itself, its
  own requests to that address (a runtime calling its own MCP) connect to its listener here and take its certificate —
  exactly that one — however local it is (`reachOwnServer`).
- **Its plugins.** Every folder of `src/plugins` under its name in camelCase, built from its `index.ts` (or
  `index.tsx`, `pluginEntry`) and rendered
  on the server (`action: 'compile'`), with its server half (`functions/`); every plugin of `vendor/plugins`, run as it
  was built, beside its `plugin-manifest.json` — and the deployment's `pluginNames` naming them all.
- **Its code.** `src/functions/` (`loadFunctions`), and the space's runtime — `src/runtime/index.ts`, or
  `dist/runtime/index.js` when the process was started on what `build` emitted (`process.argv[1]` under `dist/`), or
  `vendor/runtime.bundle` — in this process, its endpoints answered before anything else.
- **Its files.** `public/` served as it is, `src/data/` read and never served (`dataDir`), the `kv` in `state/kv.json`
  (`createFileKv`) and the job queue beside it, `state/jobs.json` (`createFileJobQueue`: a `ctx.later` due while the
  server was down runs once it is back), `PLITZI_SIGNING_SECRET` what `ctx.sign` signs with.
- **Where it is.** `/health` answers with the space's permanent URL (or the cloud `name`), and `tmp/dev-server.json`
  records the name, the port, the URL this machine reaches it at (`https` with a certificate), its network addresses
  and its `publicUrl` — for `plitzi page check`, `shot`, `verify` and `visual`. A signal closes it (`closeOnSignals`).

While developing — `NODE_ENV` other than `production` — `devMode` and `livePages` are on, and:

- **A save to the space is authored again** by the project's `.plitzi/author.ts`, in a process of its own (an import is
  never read twice in one process), run with `--ipc`: it hands the documents back over the IPC channel, the server
  swaps them in memory and hands them to every open page, which swaps the space where it stands — its state, scroll and
  focus kept (`updatePages`); a page with elements the server draws loads again instead. What the script refuses it
  prints, and the page keeps the last space that authored. A save to the server's own code — `main.ts`, `src/config/`,
  `src/actions/`, `src/connectors/`, `src/functions/`, `src/runtime/` — is `start:dev`'s to restart on; of a plugin,
  only its `declaration.ts` is the space's.
- **A plugin folder added** is registered and the open pages load again; one removed is turned off; a plugin's
  `functions/` changed is loaded again in place. A plugin's component changed is swapped where it is drawn (`livePages`
  with `devMode`). A folder
  it cannot build — no entry yet, a name that is no type — or a `functions/` with no `index.ts` is said in the
  terminal as the layout check says it (`[plugins] …`, once until it changes), and the server goes on; the folder is
  registered once it is whole.

It answers `{ server, url, close }`: the `SSRServer`, where it listens, and what stops it — watching, the server and the
runtime — for a caller that stops it itself.

## Configuration

`createServer` takes a `ServerConfig` (exported, as a type, from `@plitzi/sdk-server`) — what a project types its own
options with: a `plitzi create` project keeps them in `src/config/serverOptions.ts`, typed `ProjectServerOptions` — it less
what `serveProject` wires itself (see [Projects](#projects)).

| Option | Type | Default | Description |
|---|---|---|---|
| `httpVersion` | `1 \| 2 \| 3` | `2` with `tls`, else `1` | HTTP protocol version. Falls back to the nearest available lower version. |
| `tls` | `{ key, cert, minVersion? }` | — | TLS key and certificate. Required for versions 2 and 3; optional for version 1. |
| `devMode` | `boolean` | `false` | Enables development mode: appends `?dev` to esm.sh CDN URLs for React, and activates per-request timing metrics (see [Dev metrics](#dev-metrics)). Off, the process must run with `NODE_ENV=production` or React renders with its development build; the server says so once, at `error`. |
| `livePages` | `boolean` | `false` | Every page this server renders listens for what changes under it: new documents for the space it shows, swapped where it stands with its state, scroll and focus kept (`server.updatePages(documents, { draft? })` — a draft's pages hear their own alone), or everything loaded again (`server.reloadPages()`); and it loads again when it reconnects to a server that restarted (a new process), so a change to the server's code reaches the open page. What `serveProject` uses while developing, and `createAuthoringHost` always. With `devMode` too, a plugin whose source changes is built again and swapped where it is drawn on every open page; a plugin whose declaration changed loads the page again. Not turned on by `devMode`: each open page holds a connection for it. |
| `assetVersion` | `string` | — | Cache-buster appended as `?v=<assetVersion>` to all default SDK asset URLs. Compute from file mtime or package version at startup. |
| `cacheTtlMs` | `number` | `300000` | TTL in milliseconds for the SSR render cache. Set to `0` to disable. |
| `renderLimit` | `{ perSpace?: number; waitMs?: number }` | — | How many pages of ONE space this process renders at once, so one space's burst waits behind its own renders instead of taking every render from the others. A kept page takes no turn: what is held back is what costs — a visitor's own page, a draft drawn with its providers' answers, an address no kept page answers (a `?x=<random>` per request). `perSpace` is every space's unless its deployment says its own (`SSRSpaceDeployment.renderLimit`, its plan's); without either a space has no limit. A page past it waits `waitMs` (2000) for a turn, then is answered 503 with `Retry-After: 2` and "This site is busy right now"; the refusals are said once a minute per space, with how many. Per process: four workers render up to four times as many. |
| `cache` | `SSRCacheConfig` | — | What is kept of rendered pages (`maxBytes`, `staleMs`, `ignoredQueryParams`) and how several replicas keep them in step (`bus`, `store`). See [Render cache](#render-cache). |
| `earlyHints` | `boolean` | `true` | Says what every page paints with — the SDK's stylesheets — in a `103 Early Hints` before a page is rendered (not before a kept page, answered at once), and as every page's `Link` header (for a CDN that turns it into one). Not the SDK's module: it is asked once the page has painted. `false` sends neither. |
| `flags` | `Record<string, boolean> \| ({ spaceId, environment }) => Record<string, boolean>` | — | This deployment's say over the spaces' feature flags: above what a space declares, below the SDK's `flags` prop and a tester's dev tools, and only for flags the space declares. A function answers per space. Server actions and RSC resolve with it too. See `docs/en/feature-flags.md` in the workspace. |
| `loginPath` | `string \| false` | `'/auth/login'` | Path for the built-in login endpoint. Set to `false` to disable it entirely. |
| `logoutPath` | `string \| false` | `'/auth/logout'` | Path for the built-in logout endpoint. Set to `false` to disable it entirely. |
| `signIn` | `SSRSignInConfig` | — | Sign visitors in by redirect through an OAuth 2.1 authorization server: `GET /auth/sign-in?return=/x` registers this host as a client, sends the browser out with PKCE (state in a `__Host-` cookie), and `/auth/sign-in/callback` redeems the code server to server and hands the token to `exchangeCredential`, which makes the session here. Needs the `exchangeCredential` adapter. |
| `templateFn` | `SSRTemplateFn` | built-in EJS template | Custom render function. Receives all template params and returns an HTML string. |
| `plugins` | `Record<string, PluginSource>` | — | Named plugin definitions. Compiled or copied on first use and cached for `pluginsTtlMs`. |
| `pluginsCacheDir` | `string` | `tmp/.sdk-plugins` | Directory where compiled plugin files are stored — under `tmp/`, with everything else the server writes for itself. |
| `pluginsTtlMs` | `number` | `604800000` | TTL in milliseconds for compiled plugins (default: 1 week). |
| `autoLoadSchemaPlugins` | `boolean` | `true` | Auto-download and cache plugins declared in the schema's `offlineData.plugins` list. A type the deployment registers itself (`plugins`, named in `pluginNames`) is never looked for there: its own build is the one rendered. Set to `false` to manage plugin loading manually. |
| `outbound` | `{ privateOrigins?: string[] }` | — | What the requests a space's documents write may reach from inside this server — a server provider's `query`, `http.request`, a connector, a function's `fetch`, a plugin's address. None reaches a private address (`localhost`, this server's network, the cloud's metadata) but the origins named in `privateOrigins` — the deployment's own storage, CDN or API on its network (`http://localhost:9000` for a local S3), each `scheme://host:port`, no path. |
| `publicDir` | `string` | — | Absolute path to a directory served at the root URL level (e.g. `favicon.png`, a verification file). Files are checked before `static` prefix routes. **Everything in it is public:** served to anyone who asks, with no check. A `robots.txt` or `sitemap.xml` there shadows the space's own — see [Search engines](#search-engines). |
| `dataDir` | `string` | — | The project's own data, never served: a provider resolved on the server (`runtime: 'server'`) whose `query` is `/data/<file>` reads `<dataDir>/<file>`, and a function reads it with `ctx.data(file)` — the space's `getData` when the deployment gives none. See [Project data](#project-data). |
| `static` | `Record<string, string>` | — | URL prefix → filesystem path mappings for static file serving. |
| `images` | `{ domains, cacheDir? }` | — | Pictures from other sites resized at `/_plitzi/img`, for an `image` to offer as a `srcset` (see [Images](#images)). |
| `ssrOnly` | `boolean` | `false` | Omit client-side JS from the rendered page. Useful for verifying SSR HTML without hydration. |
| `streaming` | `boolean` | `false` | Stream HTML to the browser incrementally to reduce TTFB. See [Streaming](#streaming). |
| `middlewares` | `SSRMiddleware[]` | — | Array of custom middleware functions executed before the SSR renderer on every request (see [Custom middlewares](#custom-middlewares)). |
| `rsc` | `SSRRscConfig` | — | React Server Components endpoint configuration — and `visitorCredentials`, the deployment's own APIs a server provider may ask as the visitor (see [RSC](#react-server-components-rsc) and [Asked as the visitor](#asked-as-the-visitor)). |
| `realtime` | `{ pubsub?, path?, transport?, allowedOrigins? } \| false` | in memory, at `/_realtime`, `sse` | Realtime channels the space declares. `transport` is what pages connect with: `sse` (a stream, publishes over `POST`) or `websocket` (one socket both ways, HTTP/1.1 only; pages fall back to the stream where a socket cannot open). `allowedOrigins` lists the other origins whose pages may open a socket. `pubsub` is how messages reach other processes — `createMemoryPubSub()` (the default, across workers) or `createRedisPubSub({ publisher, subscriber })` for several replicas. `false` serves no endpoint. See [`docs/en/realtime.md`](../../docs/en/realtime.md). |
| `compression` | `SSRCompressionConfig \| false` | Brotli, then gzip | Response compression (see [Compression](#compression)). `false` never compresses. |
| `health` | `SSRHealthConfig` | identity payload | The `/health` endpoint. `check` adds live state per probe and turns it into a readiness probe (see [Health](#health)). |
| `stats` | `StatsConfig` | none | `GET /_stats` behind `secret`: the process's pool, load, outcomes and health, read by `readPools` (see [Stats](#stats-and-every-process-at-once)). |
| `adapters` | `SSRAdapters` | — | Required. Adapter callbacks for data fetching. |
| `logLevel` | `'silent' \| 'error' \| 'warn' \| 'info' \| 'debug'` | `info` with `devMode`, else `error` | How much the server says, for the whole process (see [Logging](#logging)). |
| `logger` | `ServerLogger` | the console | Where it says it: one structured `ServerLogEvent` stream. `consoleLogger` prints each as one line. |
| `onListenError` | `(error, { port, host, label }) => void` | exits non-zero | What to do when the server cannot take its port. By default it prints what went wrong and what to do about it, then exits — a process whose server never bound is not running. Supply this to keep it alive and decide yourself. |
| `workers` | `boolean \| number \| 'auto'` | `'auto'` under `NODE_ENV=production`, else `false` | How many processes serve the port: one per core, a number (lowered to the cores there are), or one. `SDK_SERVER_WORKERS` sets it when the config does not. See [Using every core](#using-every-core). |
| `action` | `SSRActionConfig` | — | The space's server actions: the write endpoint (`path`, default `/_action`), `lookups` (`ActionLookupsConfig`: `getAction`, `getFunctions`, `getPluginFunctions`, `getData`…), `kv`, `jobs`, `limits`, `email`, `signingSecret`, `onRun` / `onReject`. Absent, the server serves reads only. See `docs/en/server-actions.md` § 13 in the workspace. |
| `functions` | `{ native?, measureNative?, plugins?, runner?, limits? }` | — | The server's code (`FunctionsConfig` in `@plitzi/sdk-actions/functions`, checked as the server starts): its own tasks and routes (`native`, from `loadFunctions`), the server halves of the plugins it ships (`plugins`, by plugin type — see [A plugin's server half](#a-plugins-server-half)), the `runner` the spaces' functions run on, and the per-invocation `limits`. `measureNative` says, once per task and limit, an invocation of `native` that spends more than a sandbox would let it — calls to `ctx`, CPU, time, the bytes it answers — never stopping it: `serveProject` turns it on, since a project's functions are a hosted space's. See `docs/en/functions.md` § 8 in the workspace. |
| `connectors` | `ConnectorLookupsConfig` | — | `getConnector` and `getCredential` for the space's connectors, read by the RSC read path and the `/_action` write endpoint alike. See `docs/en/connectors.md` in the workspace. |
| `auth` | `Auth` | — | A `createAuth(...)` result: fills the three auth adapters in and brings the cookie naming. See [User authentication](#user-authentication). |
| `pageAuth` | `Omit<ServerAuth, 'sessionHintCookie'>` | from `auth` | What the rendered pages are told about signing in (`server.auth`): the provider and its endpoints, the hint cookie added per host. Name it when `/auth` is served by another host. |
| `sessionRenewal` | `{ url } \| false` | on with `auth` | Where a page request whose access cookie died, its refresh cookie alive, renews before it is rendered. |
| `authCookie` | `SSRAuthCookie` | — | Name, domain, `sameSite`, `secure`, `refreshPath` (`/auth`) and `hintSuffix` (`_hint`) of the session cookies. `auth` brings its own; set here, a piece wins over it. |
| `exchangePath` | `string \| false` | `'/auth/exchange'` | Where a browser-obtained credential is handed over; served only with the `exchangeCredential` adapter. |
| `debugMode` | `boolean` | `devMode`, or the space's `devTools` | Authorizes debugging on the pages this server renders. Set, it decides for every space: `false` is a refusal no space turns around. A page loads React's development build only while its visitor has the dev tools on. |
| `frameOptions` | `'DENY' \| 'SAMEORIGIN' \| string[] \| false` | `'DENY'` | Who may embed the pages in a frame (CSP `frame-ancestors`, and `X-Frame-Options`); `false` omits both headers. A space adapter's `frameAncestors` derives it per space — see [Space adapters](#space-adapters-a-space-per-domain). |
| `hsts` | `false \| { maxAge?, includeSubDomains?, preload? }` | a year, `includeSubDomains` | `Strict-Transport-Security` on every response over https. Never on this machine nor on a domain no public CA certifies (`.local`, `.test`, `.localhost`, `.internal`), where it would lock a development certificate out; `preload` only once the domain is submitted to the browsers' list. |
| `crossOriginOpenerPolicy` | `'same-origin' \| 'same-origin-allow-popups' \| 'unsafe-none' \| false` | `'same-origin-allow-popups'` | `Cross-Origin-Opener-Policy`: a window of another site cannot reach the page through `window.opener`; what the page opens (a payment, another provider's sign-in) still answers it. |
| `scriptPolicy` | `'report-only' \| 'enforce' \| false` | `'report-only'` | A script policy against cross-site scripting: the template's own scripts carry the render's nonce, and what they load runs (`'strict-dynamic'`); no plugin objects, no `<base>`. `'report-only'` sends it as `Content-Security-Policy-Report-Only` — the browser reports what it would refuse to `/_plitzi/csp-report`, and the server says it in its log (`CSP`), so a space's own scripts (a raw HTML block's) are seen before anything is refused; `'enforce'` refuses them, in the `Content-Security-Policy` that carries `frame-ancestors` too. A domain says its own (`SSRDeploymentSecurity.scriptPolicy`, below). A cached page keeps its render's nonce while it is kept. A page held to either never asks for `eval`: the SDK's store writes without its compiled writers. |
| `trustedTypes` | `'report-only' \| false` | `'report-only'` | Trusted Types, beside the script policy and always reported: markup reaches the page only through the SDK's named policies (`TRUSTED_TYPES_POLICIES`, `@plitzi/sdk-shared/security`) — what an author wrote (a raw HTML block, rich text, an SVG) through `plitzi-author-html`, cleaned with DOMPurify where the script policy is enforced; text, JSON and a worker of the page's own origin (a `blob:` it made, a file it serves) through `default`. Anything else is reported, which is how a sink nobody named is found. The policy is said on `<html data-plitzi-script-policy>` too, so a copy of the SDK's shared code the SDK does not start (the builder's, a plugin's own) holds itself to it — no `eval` from its store or zod, its author markup cleaned. |
| `fonts` | `{ baseUrl?, dir?, google? }` | `baseUrl: '/fonts'`, `google` on | Where the font files a space uploaded are addressed, and with `dir` served from this server under `/fonts/*`. `google`: a page's Google families served from this server's own origin (`/_plitzi/fonts/google/…`, asked of Google once and kept within `maxBytes`, 32 MB) — `false` links Google itself. See `docs/en/fonts.md` in the workspace. |
| `environment` | `'production' \| 'staging' \| 'development' \| 'local'` | `'production'` | The Plitzi tier whose endpoints the rendered pages are handed. |
| `services` | `{ ssr?, rsc? }` | `ssr` on, `rsc` with `getRscData` | Which request-handling services are mounted. |
| `preview` / `draftStore` | `SSRPreviewConfig` / `DraftStore` | off / in memory | The draft-preview endpoint (`enabled`, `path` `/__preview`, `secret`, `ttlMs`) and the store behind its tokens — share one across replicas. The rest of draft preview is `@plitzi/sdk-mcp`'s: see its [Draft preview](../mcp/README.md#draft-preview). |
| `port` / `host` | `number` / `string` | — | Not read: `server.listen(port, host?)` takes where it binds (`host` defaults to `0.0.0.0`). |

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
  recordScriptPolicyReport?: (report: SSRScriptPolicyReport) => Promise<void>;
};
```

- **`getOfflineData`** — returns the space snapshot (schema, plugins, styles, collections) for SSR.
- **`getSpaceDeployment`** — resolves which space and environment to render for a given inbound request. Return `{ error: { code, message } }` to abort with an HTTP error. Optionally include `templateProps` to override template variables, or `pluginNames` to activate plugins for the space (see [Plugins](#plugins) and [Template props](#template-props)).
- **`getUser`** *(optional)* — resolves the authenticated user from the inbound request (e.g. via a session cookie or `Authorization` header). Called in parallel with `getOfflineData` on every cache miss. Return `undefined` for unauthenticated requests. Its second argument is the response: a session cookie it finds over for good — revoked, ended, never a token at all, not one the refresh may still renew — it clears there (`createSessionCookies(config).clear(req, res)`), the readable hint with it, or the browser keeps believing it holds a session and a sign-in for signed-out visitors sends it round for ever. `createAuth`'s does. What it returns is inlined into the page — `authenticated`, `user.details`, the access token and its expiry — and that does two things: it decides page-level access for guest vs. registered users during the render, and it **saves the browser its first auth request**. The SDK adopts the inlined session on boot, stores it and schedules the renewal, rather than asking the same authority the same question a few milliseconds later. Implement this one adapter and every server-rendered page starts signed in with no round trip; `createAuth` answers it for you.
- **`authenticate`** *(optional)* — called when `POST {loginPath}` is received, with the credentials already parsed from the body (a posted form or JSON), whatever fields they are. Return a session to grant one, `undefined` to refuse — and never throw for a wrong password. **Identity only**: the cookies, their lifetimes and the readable hint are the server's, which is what keeps a session established here visible to the API side and the other way round. For a navigation (full-page form submit, `Sec-Fetch-Mode: navigate`) the server answers a `303` so the view re-renders via a GET; for a fetch it answers `200` with `{ success, access_token, expire_at }` or `401` with `{ error, reason }` — never a bodyless status, which leaves a caller holding nothing. This route knows a session and not the account behind it; `createServer({ auth })` serves the same path from the auth kernel instead, which answers the full grant.
- **`endSession`** *(optional)* — called when `POST {logoutPath}` is received. Revoke the session at the source; the server clears the cookies. Clearing them alone would leave the credential itself working for anyone who had already copied it. A navigation receives a `303` redirect; a fetch receives `204 No Content`.
- **`recordScriptPolicyReport`** *(optional)* — what a page's script policy refused, or would refuse while it reports (`scriptPolicy`, `trustedTypes`): for the space the report's HOST serves, never one the report names — anyone may post one — and once per space and violation every ten minutes per process, not on every page a visitor opens. Keep them (bounded) to show the space's owner what turning the policy on would stop; without it, the log alone says them.
- **`getRscData`** *(optional)* — called by the RSC endpoint (`/_rsc`), and once per page render, to fetch server-side data for schema elements with `runtime: 'server'`. Takes one `SSRRscContext`: the request, the space context, the resolved user so authenticated operations are safe, `ids` on a partial refresh (absent means every element), and `loadOfflineData`. That last one is the space itself, shared with the page render happening alongside — await it instead of fetching the schema again, and it is read once per request however many callers ask. Return `{}` when there is no server data for the current request (see [RSC](#react-server-components-rsc)).

## Space adapters (a space per domain)

`getSpaceDeployment` looks like glue and is not: the same handful of rules turn up in every deployment that serves
more than one space, and getting any of them wrong is a real failure. `createSpaceAdapters` states them once and
asks you only for the lookups.

```ts
import { authoringPreview, createSpaceAdapters, renderGrant, verifiedDomain, wildcardSubdomain } from '@plitzi/sdk-server';

const spaces = createSpaceAdapters({
  resolvers: [
    renderGrant({ resolveGrant: auth.identity.resolveGrant, find: findSpace }),
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
are built in and a fourth is `(req) => …` of your own, which is how a deployment that identifies tenants by a header
its proxy sets or by a table nobody else has still gets everything below.

**A space is chosen by host or credential, never by the page's path or query.** `getSpaceDeployment` is asked on every
request, and what a page fetches after it — `/_plitzi/space/<hash>.json`, `/_plitzi/style/<hash>.css`, `/_action`,
`/fn/…`, `/_realtime` — carries
nothing of the page's address but its host: a space chosen by `?space=` or `/s/<id>/` renders its first page and then
loses everything it asks for. Many spaces on one server are a sub-domain each (`wildcardSubdomain`).

| Built in | What it is |
|---|---|
| `renderGrant` | A page that renders the space itself — a site published as files, an embed, a desktop app — asking with the space's public `render` key in `Authorization`, from an origin the key allows. The key names the space; `?environment=` and `?revision=` the version (the live one when none). A visit: metered. Only the header — a key in the address (`?access-token`) is a tool's page and goes on. Put it first. |
| `authoringPreview` | A credential presented on a host you own: a builder's preview, a tool's page (a thumbnail, a journey). A secret one (`agent`, `host`) is an author's, and the render `authoring` — metering skips it; the space's public key is an author's only when `isAuthor(req, grant)` says so (a session with a role on the space), and otherwise a visit, metered as one — it is in every published page. After `renderGrant`. |
| `wildcardSubdomain` | `<slug>.example.app`, with no per-space row to configure. Refuses to read a deeper sub-domain as a slug. |
| `verifiedDomain` | A custom domain, through a row that says it was proven — and what its owner holds its pages to (`security`, below). |
| `fixedSpace` | Always this one — a single-space deployment, or a catch-all last in the chain. |

What it decides for you:

- **A credentialed request is never served from, nor written to, the shared cache.** It is keyed by host, and a
  credential resolves the same host to a different space — so a hit would serve one author's preview to the next.
- **`frame-ancestors` is derived on every resolution**, from the domains the space declared plus your floor.
  Deriving it per branch is how a deployment ends up with one branch that forgets, and that branch serves a space
  framable by anyone.
- **What a domain's pages are held to is kept with its resolution** — the `security` a row returns
  (`SSRDeploymentSecurity`): `hsts` (`'host'`, `'subdomains'` — every host under it, which on a domain of the owner's
  own reaches hosts you do not serve, so theirs to ask for — or `'off'`), `scriptPolicy` over the server's, and
  `frameAncestors`, the sites that may frame its pages beside the space's own. A domain with any writes its session
  cookies `SameSite=None`, there alone, so a visitor signed in on it is signed in inside those sites' pages too.
  `wildcardSubdomain`'s `find` may return the space's own `scriptPolicy`; the rest of a sub-domain of yours is yours.
- **Refusals are not cached**, so fixing a row fixes the site rather than fixing it in five minutes.
- **A resolver that throws is a 404 for that request**, reported through `onError`, not a dead server.

`cache` is any `get`/`set`/`delete` of strings — Redis, Memcached, whatever you have — or `createMemoryCache()` for
a single-process deployment. `invalidate.resolution(host)` and `invalidate.domains(spaceId)` drop what a change made
untrue, which matters the moment an owner edits a domain list: until then the old framing policy stands, and a TTL
is not a security boundary.

## Pages an agent writes (`createAuthoringHost`)

A product where an agent designs the screen — a dashboard's panel, a page a visitor asks for — authors a space module
per page and needs it served with the quality of a project's, without trusting what the module does. Two pieces:

```ts
import { authorIsolated } from '@plitzi/sdk-authoring/node';
import { createAuthoringHost } from '@plitzi/sdk-server';

// The app is at https://localhost:8080; the pages at https://127.0.0.1:8091 — another HOST, not only another port.
const host = createAuthoringHost({ dir: 'state/pages', port: 8091, tls, frameAncestors: ['https://localhost:8080'] });
await host.server.listen(8091, '127.0.0.1');

const result = await authorIsolated('tmp/pages/weather.ts');   // its own process: reads the module and its packages, nothing else
if (result.ok) {
  const { path } = host.put(result.space, { id: 'weather' });   // `/?__pt=weather`, kept in state/pages/weather.json
} else {
  reply(result.message);                                         // a refusal reads as authorSpace's: every problem, located
}
```

- **`authorIsolated`** authors the module in a process Node's permission model holds to reading the module's folder and
  the packages it imports: no file written, no process or worker started, no variable of the caller's environment. A
  module that runs too long is killed (`timeoutMs`), and what it answers is validated again in the caller, so one that
  forges its answer gains nothing. Before Node 25 the permission model leaves the network open: serve the result on a
  host of its own, never the app's.
- **`createAuthoringHost`** serves each page as a draft of its one space, at the address `put` answers — the way a page
  server tells many spaces apart on one host (a space is chosen by host or credential, never by path). The page
  arrives with its whole space, navigation is the browser's, and a reload that lost the address finds it in the draft's
  cookie. So a page here is data and its look: no server provider, action, function or channel of its own. Anything
  but a page it holds answers `404`, saying where they are.
- **Seen to grow:** `put` again under an id and the pages open at it take the new version where they stand — scroll,
  focus and what the person was doing kept, no reload (`livePages`, on for the host) — and `updated` says how many did.
  An agent that improves a page in steps shows each one as it is ready.
- **On a host of its own, never another port of the app's.** A cookie belongs to a host whatever its port, so a page
  at `localhost:8091` reads the app's readable cookies at `localhost:8080` and its requests carry the app's session;
  and another port, or a sibling sub-domain, is the same SITE, which the app's page server refuses writes from (it
  trusts its own origin and the ones it names, never the site). Locally, `127.0.0.1` beside `localhost`; in production,
  a domain of its own (`pages-example.net` beside `example.com`), as user content is served everywhere.
- **Checked like a project's page:** `plitzi page check "/?__pt=weather" --url https://127.0.0.1:8091 --space
  tmp/pages/weather.ts` — the CLI's whole check (elements on screen, hydration, console, contrast) against that module.

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

Beside the page adapters it offers `getSchema` and `getStyle`, read from the same file, and — when `offlineData` is a
path, or a function that may answer one — `saveSchema` and `saveStyle`, each writing its document back into the file. So an MCP server
([`@plitzi/sdk-mcp`](../mcp/README.md#adapters)) can run over it, with a `getGrant` of yours beside it.

In a test, listen on `await unusedPort()`: a free port below the system's ephemeral range, never a fixed number nor
one the system hands out (`listen(0)`) — a port of that range can be taken by any outgoing connection of a test running
beside it between the moment it is chosen and the listen, which fails with `EADDRINUSE` on a run with nothing wrong.
(`freePort(8080)` is the development server's: the next free one from a port people expect.)

### `JsonAdaptersConfig`

| Option | Type | Description |
|---|---|---|
| `offlineData` | `string` | Path to a single JSON file used for every request. |
| `offlineData` | `(spaceId, environment, revision?) => string \| OfflineDataRaw` | Function answering per request: the path for the requested space, or the documents themselves — a process that replaces them while it runs (`serveProject` re-authoring a space). A save to documents it answered is refused: there is no file. |
| `offlineData` | `OfflineDataRaw` | The space itself, for a consumer that already holds it. Read-only: `saveSchema` and `saveStyle` are offered only for a path. |
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

What it used to make every deployment declare, each of which it can answer itself:

| | |
|---|---|
| **The SDK bundle** | The rendered page is told to fetch `/sdk-assets/plitzi-sdk.js`, so the server serves it, from its own copy of `@plitzi/plitzi-sdk`. Declaring `static: { '/sdk-assets': … }` still wins — a pinned build, a CDN mirror |
| **The transport** | `httpVersion` defaults to HTTP/2 with `tls` and HTTP/1.1 without. No browser speaks cleartext h2, so the old default of `2` meant every local run had to say otherwise |
| **The audience** | `tokens.audience` defaults to the issuer, which is right for a deployment that is its own audience |
| **The space** | `createJsonAdapters({ offlineData })` alone resolves to space 1, `main`, revision 0 |
| **The visitor's scheme** | A `system` theme is drawn as the machine asks — `{{ theme.resolved }}` in a picture's address, a label — from the `Sec-CH-Prefers-Color-Scheme` client hint the page asks Chromium for (`Accept-CH`), or the `theme-scheme` cookie the SDK keeps it in; `light` on a first visit without either. The page cache is keyed by it where the theme defers to the machine |
| **What a page paints with, first** | The SDK's stylesheets are said in a `103 Early Hints` while the page is still being rendered — the browser has them by the time the HTML arrives — and the head asks for nothing else; the SDK, the plugins and the space's document are asked once the page has painted, so they do not share a phone's network with what the paint waits for. `earlyHints: false` turns the hints off |

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

### Stats, and every process at once

`/health` answers whether a process can serve; **`/_stats`** says how it is doing. Given `stats`, a page server, a worker
or an MCP server answers `GET /_stats` behind its secret (`Authorization: Bearer <secret>`, 32 characters or more —
refused at start otherwise): its pool and instance, its version, its load (runs in flight against its slots — `calls`,
`renders` — CPU, memory, the event loop's p99 delay), how its runs went over the last minute, quarter and hour (failures
and refusals by reason, p50 and p95), and `healthy` or `degraded` with why. A functions runner answers the same behind
its protocol's secret, with its `isolates` and the protocol it speaks. Kept in memory, in one-minute buckets.

```ts
createServer({ adapters, stats: { secret: process.env.STATS_SECRET, pool: 'pages' } });
```

`readPools(source)` (`@plitzi/sdk-kernel/stats`) reads every instance's `/_stats` at once and answers one document per
pool: each instance `healthy`, `degraded` or `down` — one that did not answer, with what its orchestrator knows of why —
and every version they answered with, so a rolling deploy shows. The pools come from a **pool source**:
`createLocalPoolSource([{ pool, id, url, secret }])` for processes started where they are known, or a deployment's own
over its orchestrator. Changing a pool's size is a `PoolScaler`, a contract the kernel defines and ships none of: a
deployment without one shows its pools read-only.

```ts
import { createLocalPoolSource, readPools } from '@plitzi/sdk-kernel/stats';

const health = await readPools(
  createLocalPoolSource([
    { pool: 'pages', id: 'pages-1', url: 'http://10.0.0.4:8080', secret },
    { pool: 'worker', id: 'worker-1', url: 'http://10.0.0.5:8892', secret }
  ])
);
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

Static responses include `ETag`, `Last-Modified`, and `Cache-Control` headers. Subsequent requests with `If-None-Match` receive `304 Not Modified` when the file has not changed. Under a versioned URL — the SDK bundle, the plugins, `static` mounts, fonts — JS, CSS and font files are served `immutable` and everything else with a 1-hour max-age. `publicDir` is the project's files by name, which it may rewrite while it runs: `no-cache`, asked about every time and answered `304` while unchanged.

### Images

```ts
createServer({ images: { domains: ['images.example.com', '*.cdn.example.com'] }, adapters: { ... } });
```

An `image` whose `src` is another site's then offers the browser a `srcset` of widths this server makes (320 to 1920
px) at `/_plitzi/img?url=…&w=…`, in AVIF or WebP when the browser takes them. Everything is kept on disk (`cacheDir`,
default `tmp/images`): each original is downloaded once, and each size is made once from it. A week on, the kept
files keep answering while the original is asked for with its `ETag` / `Last-Modified` — unchanged, nothing is resized
again; changed, its sizes are made anew. A picture that could not be fetched is not asked for again for five minutes.
Only the listed hosts are fetched, every redirect is held to the same
list and to the rule every outbound request follows (no private network). An SVG is never resized nor served from
this origin: the proxy answers it with a redirect to its own address (`307`), so the picture still shows. An `image`
with `resize: false` keeps its `src` as written. Resizing needs `sharp`
(an optional peer): without it pictures are passed through and kept, and the server says so once.

### Public directory

Use `publicDir` to serve your own root-level files (e.g. `favicon.png`, a search console's verification file) without
prefixes:

```ts
createServer({
  publicDir: path.resolve(process.cwd(), 'src/services/ssr/public'),
  adapters: { ... }
});
```

The lookup order for a request is: `publicDir` → `static` prefix routes → SSR renderer.

**Everything in `publicDir` is on the internet.** A file there is served to anyone who asks for it, as it is — no
session, no permission, no check. Never put a secret, a key, an `.env`, a private document, a database dump or data only
some visitors may read in it: that is served by a server action whose `access` checks who is asking.

`/.well-known/` paths follow the same lookup order: served from `publicDir` if a matching file exists, otherwise `404 Not Found`. They are never handled by the SSR renderer.

### Search engines

Every space answers its own `/robots.txt` and `/sitemap.xml`, at the address it is asked on — its own domain or another:

- `/robots.txt` is the space's `settings.robotsTxt` (`User-agent: *` / `Allow: /` when it says none), then — with
  `settings.blockAiCrawlers: true` — a `Disallow: /` for each crawler that trains AI models (`AI_CRAWLERS`), then
  `Sitemap: <origin>/sitemap.xml` unless its own text names a sitemap.
- `/sitemap.xml` lists every page a search engine may read (`sitemapPaths` in `@plitzi/sdk-shared/navigation`): not a
  page only signed-in visitors or a role may open, one whose slug takes a parameter or is `*`, one that says `noindex` or
  one behind a feature flag.

Both are read off the space, so they follow it as it changes. A `robots.txt` or `sitemap.xml` in `publicDir` is answered
first and shadows them for every space this server serves: put none there unless that is the point.

### Project data

A project with no backend keeps its data as JSON files, and `dataDir` is where they stay off the internet: nothing
serves the folder. A provider resolved on the server whose `query` is `/data/<file>` reads `<dataDir>/<file>` before the
page is answered — in the shape a browser request publishes (`{ status, data }`), so a binding reads `<source>.data.…`
in either runtime — and the page arrives with it. A browser asking for the same path gets a page, never the file.

```ts
createServer({ dataDir: path.join(PROJECT_ROOT, 'src/data'), adapters: { ... } });
```

The data is read through one lookup, `action.lookups.getData(spaceId, at)` — the space's own data as its files' text by
path, as of the version being rendered or run: what a cloud deployment keeps for a space (`plitzi space push`). Given none,
`createServer` derives it from `dataDir` (its `.json` files, read again once they change), so the folder and the
platform are read the same way.

`/data/…` is the data folder's first; a server provider reading another path is answered from `publicDir`, as the
browser would be. What a provider reads goes into the page it renders, whole: data a page must not carry — a price
list's costs, another visitor's rows — is a server action's to read, answering only what is shown. A function reads
it with `ctx.data('products.json')` (parsed, read-only, as of the run's version); importing it from `functions/` is
refused when they are built.

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
| `brotliQuality` | `number` | `5` | Brotli quality, 0–11, for a body compressed on every request (a page rendered for that request alone). The first quality under gzip's size for the CPU gzip spends: at 2 a 220 KB page came out larger than gzip (36 KB against 31; 29 at 5). On half a core it costs ~0.1 ms a page — 5–8% of the pages a second of a 6 KB page. |
| `keptBrotliQuality` | `number` | `6` | Brotli quality for a body compressed once and kept: a cached page, a static file such as the SDK bundle. Paid once; the bundle comes out 10% smaller than at 4, for the same memory. 9 needs ~40 MB more to compress the bundle, which a 128 MB server does not have. |
| `gzipLevel` | `number` | `6` | Gzip level, 0–9. |

A response that sets `Cache-Control: no-transform` is never compressed, whatever the settings say — that header is
how a handler declares its body must reach the client byte for byte. The OAuth token endpoint in
[`@plitzi/sdk-mcp`](../mcp/README.md) relies on it: a credential travelling beside a caller-chosen value is the
shape a BREACH-style attack needs.

## Render cache

A published page is kept once rendered, per `(spaceId, environment, revision, hostname, path, query)` and what of the
visitor changes the document (their session, theme, painted state, forced flags). The `main` environment is never
kept — it is the development environment and its schema changes all the time — nor a draft preview.

```ts
createServer({
  cacheTtlMs: 60_000, // how long a page is kept: 5 minutes by default, `0` keeps none
  cache: {
    maxBytes: 256 * 1024 * 1024, // what one process keeps of pages: SDK_SERVER_CACHE_MAX_BYTES, else 128 MB
    staleMs: 30_000, // served this long past its TTL while it is rendered again: 60 s by default
    ignoredQueryParams: ['utm_*', 'ref'] // rendered and kept without these: the analytics ones by default
  },
  adapters: { ... }
});
```

- **Kept compressed, by bytes, by use.** A page is kept in the encoding the server prefers (`compression`), a 1 MB page
  as the ~90 KB a browser is sent, and the cache is bounded by `cache.maxBytes` — else `SDK_SERVER_CACHE_MAX_BYTES`
  (`512MB`, `2GB`), else 128 MB a process. It is a segmented LRU: a page starts on probation and is protected once it
  is served again, and when room is needed probation gives way first. What was asked for once — a page of a space
  barely visited, every URL a crawler made up — never pushes out what is asked for all the time, whichever space it is
  of: on a server that renders many spaces by host, one that just got busy earns its room from the ones that went
  quiet. The schema data and the RSC answers are kept the same way.
- **Rendered once.** The requests for a page that arrive while it renders wait for that render instead of starting
  their own — a page a publish invalidated is not rendered once per visitor who asked for it in the meantime.
- **Served while rendered again.** A page past its TTL is still served for `cache.staleMs`, and rendered again behind
  that request for whoever asks next. An invalidation drops a page outright: a page a write made untrue is never served.
- **One page whatever the link carried.** The parameters a link carries for analytics (`utm_*`, `fbclid`, `gclid`…,
  `DEFAULT_IGNORED_QUERY_PARAMS`) are left out of the key and of what the page is rendered with — the browser still has
  them — and the others are keyed in one order, so `?b=2&a=1` is the page `?a=1&b=2` is. `[]` keys every parameter.

Schema data (`getOfflineData`) is also cached under the same TTL, keyed by `(spaceId, environment, revision)`. This avoids repeated adapter calls on consecutive HTML cache misses for the same space version.

Responses say `X-Cache: HIT`, `STALE` (served past its TTL while rendered again) or `MISS`. The cache is cleared and its
sweep timer is stopped when `server.close()` is called.

### The space's stylesheet, linked

A space's compiled stylesheet (`style.cache`) holds every page's rules — on a large space most of the page: the
Plitzi dashboard's was 429 KB of a 496 KB document, compressed again on every response. A server-rendered page links it
instead, as `/_plitzi/style/<hash>.css`, and carries only what is this request's — the variables, the custom CSS — in
the page. The file is compressed once, kept by the browser for good under its name, and answered by any replica from
the space as the request resolves it, as the space document is: a name that is no longer the stylesheet's (the space
changed since the page was drawn) answers the current one, `no-store`. Taking it out of the page made the dashboard's
render ~60% cheaper in requests a second.

The template links it in the head (`styleSheetPath`), so the page is painted with it from its first frame — linked
from the body, the content before the link and the styles after it were painted without it, and a theme flashed. The
document the page reads names it (`style.cacheHref`) with an empty `cache`, and the SDK draws only the rest. It stays
in the page where no other request could answer for it — a draft preview, a space named by `?access-token` — under a
deployment's own `templateFn`, which does not know to link it, and when a `{{ token }}` in it is replaced by the
variables as each request resolves them. A client-side render (no SSR) receives the stylesheet as it always did, and
draws it; a page whose stylesheet the browser comes to draw itself (new documents in place) drops the linked copy.

### A page that renders the space itself

`GET /_plitzi/space.json` answers the space as it is now to a page the server did not draw — a site published as
files, an embed, a desktop app, a page of the space's own host: `{ space, visit }`, the same document a drawn page
fetches and the decision about this visit (`overQuota`, `quotaNear`, `badge`) that a drawn page is handed in its
bootstrap. The SDK asks it when it is given no `offlineData`. The space is the one the request resolves to — the host
(a custom domain, the space's address: no key needed, and no other environment than the host's, which is a `400`
naming the fix) or the space's `render` key (`renderGrant`), which names the environment and revision with it. Chosen
by the key, it is answered to the page's origin (CORS, with credentials; the preflight is answered to any origin, the
request that follows is what is checked) and carries its stylesheet — linked, it would be asked for of the host and
answered with the host's own space; so does one asked with `?style=carried`, for a space drawn where the page's
stylesheet does not reach. Every load is a visit, metered as a drawn page is (`adapters.meter`, `page_view`; the cheaper
one when the space came from the server's copy) and held back as one is (`503`). Kept by the browser and asked again:
`private, no-cache` with an `ETag`, `304` when nothing changed.

### Several replicas

A process keeps its own pages, and its workers hear what it is told (`workers`). Replicas share nothing unless the
server is given what they share — and says at boot which it has:

```ts
import { createRedisPageStore } from '@plitzi/sdk-server';
import { createRedisPubSub } from '@plitzi/sdk-kernel/pubsub';

createServer({
  cache: {
    // How an invalidation reaches every replica: each subscribes, `server.cache.invalidate` publishes.
    bus: createRedisPubSub({ publisher: redis, subscriber: redis.duplicate(), prefix: 'myapp:cache:' }),
    // The pages they share: one a replica never rendered — a new one, after a scale-up or a restart — is served warm.
    store: createRedisPageStore(redis)
  },
  adapters: { ... }
});
```

Only a page rendered for nobody in particular goes to the store, under a digest of its key — a signed-in visitor's
stays in the process that drew it. The store keeps itself under its own budget — `createRedisPageStore(client,
{ maxBytes })`, else `SDK_SERVER_CACHE_STORE_MAX_BYTES`, else 128 MB — by the same rule as the process's, rather than
leave it to Redis's eviction: the Redis a deployment runs holds job queues and sessions beside it. A store that cannot answer is a miss, said in the log: the page is rendered, not
refused. Without a bus, an invalidation reaches the host it was made on, and a deployment of several replicas serves a
page a write made untrue until each copy expires.

A process that writes a space without serving its pages (an API beside the page servers) says the invalidation with
`createCacheInvalidator({ bus, store }).invalidate({ spaceId, environment })`.

`createRedisPageStore(client, { prefix })` takes ioredis's `getBuffer` and `eval`. Its default prefix carries a hash tag
(`plitzi:{pages}:`), so on a Redis Cluster the store's keys share a node; give a client without a `keyPrefix` of its
own, and put any prefix in `prefix` instead.

### Cache manager

`server.cache` exposes programmatic cache control, useful when content changes and you need to invalidate entries without restarting the server. It reaches every cache a render is kept in — the pages, the RSC answers and the schema data they are rendered from — so a page invalidated is rendered again from the space as it is now, never from the copy it was cached with.

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

`server.cache` is `null` when nothing is cached (`cacheTtlMs: 0` and `rsc.cacheTtlMs: 0`). `size` counts the entries of all three caches. Given `cache.bus` or `cache.store`, an invalidation reaches every replica and the store they share.

#### The draft

The draft (`main`) is the space being developed right then — in the builder, by an agent, with `plitzi space push` — and
a page of it is kept only under what it is at: `SSRSpaceDeployment.draftVersion`, which the deployment returns from
`getSpaceDeployment` (usually its resolvers' `decorate`) and changes with every write that changes what a page of the
draft draws — its schema, its style, its data, its server code. A new version is a new key: an edit is the next request
drawn again, on every replica, with nothing to invalidate. Without one — a deployment that cannot say it, a self-hosted
server, a project of the CLI developing its space — the draft is never kept, and each request draws it. Neither is a
draft's page drawn with what its server providers answered: the draft's data is never kept (its RSC refresh neither).
The space read for a render is kept by the same rule, so a page served from the cache reads nothing.

#### `CacheFilter`

| Field | Type | Description |
|---|---|---|
| `spaceId` | `number` | Match entries for this space. |
| `environment` | `string` | Match entries for this environment. |
| `hostname` | `string` | Match entries for this hostname. |

All fields are optional and combined with AND logic. Calling `invalidate()` with no filter (or an empty object) clears the entire cache. The schema data belongs to no one host, so a filter on `hostname` drops it too — the host's pages are rendered from it — and it is read again on the next miss.

## Plugins

Plugins are React component bundles that extend the Plitzi schema renderer. They are defined globally at server config level, compiled or copied on first use, and cached on disk for one week. The `getSpaceDeployment` adapter controls which plugins each space gets access to via `pluginNames`.

A compiled plugin is one module and its stylesheet, built as `plitzi plugin pack` builds it: React and the SDK kept out, and everything else inside — images and fonts as data URIs, and a file imported whole the way Vite imports it (`worker.js?raw` for its text, `engine.wasm?inline` for a data URI).

Whatever stylesheet the server writes for a plugin — compiled, copied or downloaded — goes into the `plitzi-sdk-plugin` cascade layer (`inPluginLayer` from `@plitzi/sdk-shared/style`), below the space's own: a space's classes and `customCss` win over what the plugin shipped, whatever the specificity. A `css` given as a web path (`/builder-assets/…`) is linked as it is.

```ts
import type { SSRSpaceDeployment } from '@plitzi/sdk-kernel/types';

const server = createPlatform({
  plugins: {
    // From a source file — compiled to ESM with esbuild
    'my-chart': {
      js: '/abs/path/to/MyChart.tsx',
      css: '/abs/path/to/MyChart.css',  // filesystem path — copied to tmp/.sdk-plugins
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

Plugins listed in `pluginSources` — and the external plugins a space's schema lists — are registered into the plugin manager on-the-fly using `ensure()`, under a key that carries the source's identity as well as its name and version (`name@1.0.0+<digest>` of its `js`, `css`, `action` and `props`). A plugin published again under the same version, or another space's plugin with the same name and version, is therefore a source of its own rather than whichever this process met first, and is built only once. Both `pluginNames` and `pluginSources` entries are resolved in parallel before the HTML is rendered.

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

esbuild runs as a child process of its own (16–26 MiB resident). The server stops it once nothing has built for a
minute (`ESBUILD_REST_MS`), and the next build starts it again. A server built on this package that builds with esbuild
in the same process calls `esbuildBuild` from `@plitzi/sdk-kernel/build` instead of esbuild's `build`: a build that
went to esbuild directly is not counted, and stopping the child would kill it.

### Plugin serving

Compiled and copied plugin files are served under `/sdk-plugins/{name}/`:

```
/sdk-plugins/my-chart/index.js
/sdk-plugins/my-chart/index.css   (if CSS was generated or provided)
```

Plugin responses are compressed with Brotli or gzip like all other responses.

A page imports only the plugins it draws: its own elements, its layouts', and those of the components and references it
holds (`pageElementTypes`). The rest reach the page as their declaration (`PluginEntry.deferred`) and are imported when
a page that draws them is opened, client-side navigation included.

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

### A plugin's server half

A plugin can bring server code — its `functions/`, written as a space's functions are — whose routes answer under
`/fn/plugins/<type>/` and whose tasks are steps named `<type>.<action>`, run with a plugin's narrower `ctx` (its own
corner of `kv`, none of the space's credentials, channels or data). This server's own plugins hand theirs over by type:

```ts
import { loadFunctions } from '@plitzi/sdk-actions/functions';
import { createPlatform } from '@plitzi/sdk-server/platform';

const [board] = await loadFunctions(new URL('./plugins/Board/functions/', import.meta.url));

const server = createPlatform({ adapters, functions: { native, plugins: { board } } });

// While it runs: a server half loaded again — or, with none, taken away — without a restart.
server.functions.setPlugin('board', board);
```

`loadFunctionsSource(files)` loads one from its files rather than a folder: what a packed plugin carries as
`functions.source.json`. The plugins a space uploaded reach a run through `action.lookups.getPluginFunctions`. The
whole of it — `ctx`, routes, how a packed plugin carries it — is in
[functions § a plugin's server half](../../docs/en/functions.md#11-a-plugins-server-half).

## React Server Components (RSC)

The SSR server includes a lightweight RSC endpoint that delivers server-side data to schema elements with `runtime: 'server'`. This is not the React RSC wire protocol — it uses a simple JSON transport that any element can consume via `useRscData()`.

### Schema setup

Server data is on unless the schema turns it off with `"rsc": { "enabled": false }` — the page render and the
default `getRscData` (`connectorRscData`) read a missing `rsc` alike. `authorSpace` writes it out for a space with a
server provider:

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

**`loadStrategy`** — controls when an element's items are mounted, relative to its `visibility` state. The element itself always renders (it is what registers the callbacks that show it again); only what is inside it is deferred. The builder canvas ignores it and keeps everything mounted.

| Value | Behaviour |
|---|---|
| `'eager'` | Items always mounted, hidden or not (default behaviour). |
| `'lazy'` | Items mounted the first time the element is shown, and kept from then on. `modalContainer` and `dialogContainer` declare it by default. |
| `'visible'` | Items mounted only while the element is shown; their state is dropped on every hide. |

### `getRscData` adapter

Implement `getRscData` in your adapters to serve data from the `/_rsc` endpoint. `serverData` is a map keyed by schema element ID — each element reads only its own slice, so multiple `runtime:'server'` elements in the same schema can have independent data.

When `ids` is provided the client is performing a **partial refresh** — only return data for those element IDs. When `ids` is absent, return data for all elements (full fetch):

```ts
import type { SSRAdapters, SSRRscContext } from '@plitzi/sdk-kernel/types';
import type { SSRRscData } from '@plitzi/sdk-shared';

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

**One request per question, the newest winning.** The client (`refreshRsc`) joins a refresh already in flight for the same URL, and aborts one a newer refresh would overwrite — a whole payload asked again, an element asked again — so answers never land out of order. `cancelRsc(store, ids)` (an `apiContainer`'s `cancelQuery`) aborts on purpose. The server hears it: `SSRRscContext.signal` aborts when the browser hangs up, and the default `getRscData` stops every element still resolving — an action's render run included, unless another visitor's identical render is still waiting on the same run. A custom adapter does the same with the signal it is handed.

What a refresh asks for besides the location (`/_rsc?location=…&country=fr`) is `req.ctx.rscParams`; the action resolver hands it to the action over the `input` the element was saved with.

### Asked as the visitor

Providers of one render that ask the same address — with the same headers, the same way — share one request to it:
a page whose header and body both read the account is one call, and each provider still gives up on its own timeout
(the request stops once none of them waits).

A server provider whose `query` is an API's address is asked without the visitor's cookies. One that says
`credentials: 'include'` is asked WITH them — its page arrives with that visitor's own data (an account's dashboard)
instead of drawing empty until the browser has run and asked — where the deployment says so, and nowhere else:

```ts
createServer({
  rsc: {
    visitorCredentials: {
      origins: ['https://api.example.com'], // as the provider's template comes to them
      via: { 'https://api.example.com': 'http://api.internal:8888' }, // where this server reaches it
      cookies: ['session'], // the ones carried; every cookie of the page request without it
      spaces: ({ spaceId }) => ownSpaces.has(spaceId) // a server serving its customers' spaces too: its own alone
    }
  }
});
```

The browser sends cookies to an API only when that API's CORS allows the page's site; the page server would send them
wherever a document said — so the API and the spaces trusted to ask it are named by whoever runs the server. A provider
asking an origin not named, or from a space not trusted, is its error, naming the setting — never asked as a stranger,
whose answer is not the one the page was written for. A redirect away from the origin drops the cookies, as the Fetch
standard does. A page or a `/_rsc` refresh read so is kept by no cache — not even the same visitor's next visit, which
would show what a write a moment ago made untrue (`req.ctx.readAsVisitor`, `Cache-Control: no-store`).

### `/_rsc` endpoint

The server automatically registers `GET /_rsc` when `adapters.getRscData` is provided. The endpoint:

1. Reads `spaceId`, `environment`, and `revision` from the resolved `spaceDeployment` context.
2. Reads the authenticated user from `ctx.user`.
3. Reads optional `?ids=elem1,elem2` for partial refresh.
4. Calls `adapters.getRscData({ req, spaceId, environment, revision, user, ids, loadOfflineData, signal })`.
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

**Cache-Control**: `no-store` for the `main` environment; `private, max-age=30` for other environments when `rsc.cacheTtlMs > 0`. Responses also include `X-Cache: HIT` or `X-Cache: MISS` for observability. A request sent with `Cache-Control: no-cache` is resolved again rather than read from the cache, and its answer replaces the cached one — the SDK sends it for a refresh that exists because something changed (a write, `invalidateQueries`, `performQuery`); a `refreshSeconds` timer goes through the cache.

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
| `elementTimeoutMs` | `number` | `5000` | How long one server element may take before the page is answered without it — and what it was resolving is cancelled. The page's ceiling, winning over the producer's own (`action.limits.timeoutMs`). A section cut by it says to raise this. |

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

Sessions, in one call. `createAuth` takes what only your deployment knows — its signing key, what you call your
cookies, and the store your accounts live in — and returns the whole cycle wired together.

```ts
import { createServer } from '@plitzi/sdk-server';
import { createAuth } from '@plitzi/sdk-server/auth';

const auth = createAuth({
  tokens: { keys, issuer: 'https://acme.com', audience: ['https://acme.com'] },
  secret: process.env.AUTH_SECRET, // signs the CSRF token: 32 characters or more
  cookie: { name: 'acme_session' },
  adapters: accounts
});
```

Credentials are signed with ES256. `keys` is `{ signing: { kid, privateKey }, verifying: [{ kid, publicKey }] }`, PEM;
`generateTokenKeys()` (`@plitzi/sdk-kernel/tokens`) makes a pair, once, for the deployment to keep (its private key as a secret). A process that only
checks who a request is — a worker on another machine — is given `verifying` alone, and cannot mint a session even if
it is compromised; asked to, it refuses and names the missing key. To rotate, sign with the new key and keep the old
one's public key in `verifying` until what it signed has expired.

```ts
createServer({ port: 443, adapters: { getOfflineData, getSpaceDeployment }, auth });
```

There is no third argument for the security-relevant parts, on purpose: password hashing defaults to scrypt, sign-in
is rate-limited in memory, mailed links expire, and CSRF is on. Each of those used to be an option with no default —
which meant the ordinary deployment went without, because nobody configures what they have not read about. Supply
`api.hashPassword`/`verifyPassword` to keep an existing algorithm (a store of bcrypt hashes needs bcrypt), and
`api.rateLimit` to put one counter behind a fleet. Name the terms accounts are opened under — `api.terms: { version }`
— and `/auth/signup` refuses a sign-up without `acceptedTerms: true` (400, `field: 'acceptedTerms'`) and hands
`createAccount` the version accepted and when (`termsAccepted`), for the account store to keep; named none, sign-up asks
for nothing more.

`auth` on the server is the whole of the wiring: it mounts the `/auth` flows, answers the identity adapters a page
server asks for, and carries the cookie naming with it — so there is no second place to keep in step. It also tells
every page it renders where it signs in (`server.auth`: `userProvider: 'basic'`, `loginUrl`, `userUrl`, `logoutUrl`,
`refreshUrl` and `mfaUrl` where offered, and `sessionHintCookie` named for the host), so the space declares nothing. A
setting the space does declare wins, and a space that names another provider ignores the server's altogether. Everything is
still exported separately for a deployment that wants to assemble or replace one piece: signing in (`createAuthApi`,
`authRoutes`, …) here, checking who a request is in the kernel — `createTokens` in `@plitzi/sdk-kernel/tokens`,
`createIdentity`, `createCsrf` and the session cookies in `@plitzi/sdk-kernel/identity`.

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
import { parseRequest } from '@plitzi/sdk-kernel/http';

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
| `findByRefreshToken(token)` | renewal — the row is its revocation switch. `refreshExpiresAt` overrides the token's own expiry |
| `findMembership(userId, spaceId)` | space-level permission checks (`auth.can`) |
| `createAccount`, `findByEmail`, `setResetToken`, `sendMail`, … | signup, password reset, verification |
| `passwordSignInRefused(account)` | an organization's own sign-in required: asked once the password is proved, its words a 401 `sso-required` |

**What is absent decides what the deployment offers.** No `createAccount`, no signup — and the route answers 404
rather than failing at runtime. Declining a flow is one act: do not implement it. `GET /auth/capabilities` publishes
the result, so a sign-in page renders what the backend actually answers instead of a button that dead-ends.

### Signing in through a provider

`createSocialAuth` (`@plitzi/sdk-server/auth`) is the authorization-code grant with PKCE, its state in a signed cookie,
and `mountSocialAuthRoutes` (`@plitzi/sdk-server/handlers`) its routes: `/providers`, `/<provider>/login`,
`/<provider>/callback`, `/continue`, `/sso`. Google and GitHub are built in — credentials alone register one — and
`createOidcProvider({ id, label, issuer, clientId, clientSecret, redirectUri })` is any OpenID Connect issuer: its
discovery document read and checked to be the issuer's, the profile read from the ID token verified against its
published keys (asymmetric only), for this client, with the flow's `nonce`. What stays yours is `linkAccount(provider,
profile)` — who comes back — and, for an organization's own sign-in set up by its administrators rather than by the
deployment (single sign-on), `resolveProvider(id, redirectUri)`, a provider resolved per request, with
`providerForEmail(email)`: which one signs an address in, what `GET /sso?email=` answers. A refusal of yours is an
`OAuthFailure(reason, message, detail?)`: the browser lands on its target with `?error=<reason>&detail=<detail>`.

### …or don't: `@plitzi/sdk-kernel/mysql`

If you are standing a user store up rather than adapting one you have, the table above is ceremony. Import the
store instead — it is every adapter in it, already written, over tables it creates:

```ts
import { createMysqlStore } from '@plitzi/sdk-kernel/mysql';

const store = await createMysqlStore({ url: process.env.DATABASE_URL });

const auth = createAuth({
  tokens: { keys, issuer },
  secret,
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

Signing out everywhere takes a scope: `POST /auth/sessions/revoke { "scope": "site" }` ends the account's sessions
signed in on the host asked (each session records it, `SessionClient.host`), `"all"` (or none) every one; a page server
answers the same at `/auth/logout-everywhere` (`endSessions`, `logoutEverywherePath`) for its own host — a space's visitor
signing out of that space on their phone too.

A write a page makes with the session cookie — `/auth/sessions/revoke`, `/auth/profile`,
`/auth/password` — carries the CSRF token in the header `GET /auth/csrf` names (`{ token, headerName }`); one sent with
`Authorization: Bearer` needs none. A sign-up refused because the account exists says which field to change:
`400 { error, field: 'username' | 'email' }`.

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
the session carrying nothing but expiry timestamps, so a page can tell that nobody is signed in without a request —
and a page server that finds the session over (revoked, signed out everywhere) clears it with the cookie, while the
browser asks before restoring a token its page's server found nobody for;
and every refusal names a machine-readable `reason`, so a client can tell "renew me" from "you are gone".

### Beyond the defaults

| Config | Effect |
|---|---|
| `cookie` | Name, domain, `SameSite`, `Secure`, the refresh path, the hint suffix. Defaults derive from the request host: this machine — loopback, a `.localhost` name, a private network address, its mDNS name (`studio.local`), as a phone on the Wi-Fi opens it over http — gets `SameSite=Lax` with no `Secure` and no `Domain`; any other host `SameSite=Lax; Secure`, shared across its sub-domains — which are one site, so `Lax` reaches them all. `sameSite: 'none'` for a deployment whose pages need the session inside another site's page (a space in an iframe there); a domain that lets other sites frame it (`security.frameAncestors` of its deployment) gets it on that host alone, over https. A deployment that serves spaces of different people on sub-domains of one domain (`*.plitzi.app`) answers `domain` per host — its own hosts `registrableDomain(hostname)`, a space's host `undefined` — or one space's visitor session reaches every other's |
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

Working examples are in [`examples/self-hosting`](../../examples/self-hosting): `03-sessions` over a store you
write, `04-mysql` over one you do not.

### Cross-site request forgery

**On by default.** The session cookie defaults to `SameSite=Lax`, which keeps it off the writes another site causes;
a deployment that sets `sameSite: 'none'` — a space embedded in an iframe on somebody else's domain — has the browser
attach it to them. That is the attack, and the token answers it whichever the deployment chose.

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

**"A site this deployment recognises"** is an ORIGIN — host and port, not just the site — decided by two headers a page cannot
set: `Sec-Fetch-Site` — the browser's own account of where the request came from, where only `same-origin` (or `none`,
a typed URL) is this server's own — and, where that is absent, `Origin`, matched exactly against this host or
`identity.platformOrigins`, the hosts you already declared. **`same-site` is not trusted**: another port of this host,
or a sibling sub-domain, is the same site, and is exactly where somebody else's code is served by design — an
authoring host, every space of a platform on sub-domains of one domain. A sibling that is yours is named. **Neither header present means the caller
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

#### The page server's own writes

Everything a page server answers past its self-gating flows — server actions (`/_action`), realtime publishes, a
space's `/fn/` routes, its runtime's endpoints, your own `data` stages, and the adapter-only `loginPath`, `logoutPath`
and `exchangePath` — refuses a write that a browser says **a page of another origin caused**, with `403` and `reason: 'foreign'`.
**Whether or not a session cookie came with it**: a server holding credentials of its own (a token for somebody's
calendar, an API key) or a tool nobody signs in to acts for whoever reaches it, and a plain `text/plain` POST from any
page open in the same browser reaches it without a preflight.

The same two headers decide, under the same rules: what passes is a safe method, anything with `Authorization`, a
caller that is not a browser (a webhook, `curl`), a page of this origin (`same-origin`, never merely `same-site`),
and what you name:

```ts
createServer({
  adapters,
  crossSiteWrites: {
    // Exactly as a browser sends them. With `auth`, `identity.platformOrigins` are added for you.
    origins: ['https://app.example.com'],
    // A form other sites post to by design.
    paths: path => path === '/fn/newsletter'
  }
});
```

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
import type { SSRMiddleware } from '@plitzi/sdk-kernel/types';

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

## Using every core

Node runs JavaScript on one thread, so one process renders on one core however many the machine has. With
`workers`, the server runs one process per core and the connections are spread between them: more requests a second,
and less time waiting behind another page's render.

```ts
createServer({ adapters, workers: 'auto' }); // one per core — the default under NODE_ENV=production
createServer({ adapters, workers: 4 });      // at most four, and never more than the cores there are
createServer({ adapters, workers: false });  // one process, exactly as before
```

`SDK_SERVER_WORKERS=auto|false|<n>` sets it from the environment. The cores are the ones the process may use: a
container's CPU quota counts, so a pod limited to one CPU runs one process whatever the node has.

**One process is the server as it always was.** Workers off, one asked for, or one core to run on: nothing is forked,
nothing is wrapped, and every in-memory default is this process's own.

**Several are still one server.** The process you started serves nothing itself; it starts the workers, restarts them
and keeps what they must share:

- The in-memory defaults — an action's `kv`, the job queue, draft previews, the sign-in rate limit — are kept once, by
  that process, and every worker reaches the same copy. A counter counts every request once; a draft written through
  one worker is read through another. A store you supply (Redis, a table) is used as it is.
- The scheduler and the job consumers run in one worker only: a schedule fires once, and `jobs.workers` is the whole
  server's concurrency.
- `server.cache.invalidate()`, `server.plugins.register()` and `server.plugins.invalidate()` reach every worker,
  whichever process calls them — a publish webhook lands on one of them.
- Plugins are built once, before the workers start.

Per worker: the rendered-page cache (each renders a page once), the plugin components, and the action caps
(`action.concurrency`). A plugin registered with a `component` stays in the process that registered it — register
those where the server is created.

**When a worker dies** — a crash, an uncaught error, the OOM killer — it is replaced, and its replacement takes over the
jobs it carried (a claimed job goes back to the queue when its lease lapses). Past one death per worker a minute the
replacements wait, doubling from half a second up to thirty, so a request that crashes every worker it reaches cannot
turn the server into a fork loop. A replacement that fails to start is retried the same way while the rest keep
serving. Two exceptions: a worker that dies before any has served stops the server with a non-zero exit (a port in use
would fail the same way every time), and a server that is killed outright takes its workers with it.

`closeOnSignals(server)` stops them all on SIGTERM, each finishing what it is serving. The workers of one machine are
one replica; several machines are several replicas, and what must hold across those still needs a shared store — see
below.

A process that starts servers of its own beside this one (an Express app on another port) should say `workers:
false`: each worker runs the whole entry file again.

## Scheduled jobs across replicas

Server actions with a `schedule` trigger, and jobs queued for later, run with no configuration — over an in-process
queue, which is right for one replica and wrong for two: each keeps its own schedules, and the jobs a replica holds
leave with it. More than one replica needs a queue and a key/value store they share. They are adapters, so the jobs
live in your database; for Mongo and MySQL they are already written, over the connection you already have:

```ts
import { closeOnSignals } from '@plitzi/sdk-kernel/http';
import { createPlatform } from '@plitzi/sdk-server/platform';
import { createMongoJobQueue, createMongoKv } from '@plitzi/sdk-actions/mongo';

const db = mongoClient.db('app');
const server = createPlatform({
  adapters,
  action: { lookups, kv: createMongoKv({ db }), jobs: { queue: createMongoJobQueue({ db }) } }
});

server.listen(3000);
// On SIGTERM: finish the jobs this replica is running, leave the waiting ones for the next, then exit.
closeOnSignals(server, { afterClose: () => mongoClient.close() });
```

`close()` does not wait for what never ends on its own: it stops taking connections, tells every realtime socket and
stream to go (a WebSocket is closed with 1001, "going away", which the pages reconnect from once the server is back),
ends any other event stream, lets what is being answered finish, and cuts whatever is still open after ten seconds
(`SHUTDOWN_GRACE_MS`). A page left open on a board, or an agent's app listening, no longer holds a Ctrl+C or a
SIGTERM until something kills the process.

`@plitzi/sdk-actions/mysql` has the same pair over a `mysql2` pool (`createMysqlJobQueue`, `createMysqlKv`). With no
database at all, `kv` survives a restart in a file: `createFileKv` (`@plitzi/sdk-actions`, one process, JSON) or
`createSqliteKv` (`@plitzi/sdk-actions/sqlite`, any number of processes on the file). Anything
else is the `JobQueue` contract written against your store — see
[server actions § self-hosted](https://github.com/plitzi/plitzi-workspace/blob/main/docs/en/server-actions.md#13-for-a-self-hosted-deployment).

## Actions apart from pages (a worker)

`createServer` serves pages and nothing of the actions engine: `createPlatform` (`@plitzi/sdk-server/platform`) builds
the engine — `action`, `functions`, `connectors`, `realtime` — and hands it to the page server, which is what one process
serving both runs. Once visitors' calls, webhooks or jobs start to weigh, run them on a worker of their own:
`createWorker` (`@plitzi/sdk-actions/worker`), the engine on `@plitzi/sdk-kernel` alone — no page, no RSC, no sign-in. A
call is cheap in CPU, but one that reads a large answer holds the event loop every render in flight shares — parsing
20 MB takes ~100 ms — and jobs run beside pages.

```ts
import { createWorker } from '@plitzi/sdk-actions/worker';
import { createPlatform } from '@plitzi/sdk-server/platform';

const engine = { action: { lookups, kv, jobs: { queue } }, realtime: { pubsub } };

// The page server: renders, and runs the actions a page renders with. It sweeps schedules into the queue, but takes
// no job from it.
const pages = createPlatform({ adapters, auth, ...engine, action: { ...engine.action, jobs: { queue, workers: 0 } } });

// The worker: `/_action` (calls, webhooks, cancels), `/fn` routes, `/_realtime`, and the jobs. Who a request is comes
// from the same identity the page server has.
const worker = createWorker({ adapters, identity: auth.ssrIdentityAdapters, ...engine });
```

In front of both, route a space's host by path: `/_action`, `/fn` and `/_realtime` (and what is under them) to the
worker, everything else to the page server. The browser sees one origin, so the visitor's session and its CSRF token
work unchanged. Give both the same `realtime.pubsub` and the same stores.

A page server whose pages render no server element naming an action needs no engine at all. It is told where its pages
call theirs, and runs nothing of it:

```ts
import { engineOnWorker } from '@plitzi/sdk-actions/worker';
import { createServer } from '@plitzi/sdk-server';

const pages = createServer({ adapters, auth, engine: engineOnWorker(engine) });
```

A page that renders a server element naming an action or a connector can have it resolved on the worker too, so the
page server runs no action at all: give the worker a `render.secret` (32 characters or more) and the page server where
the worker is and that secret. Each element is asked at the worker's `POST /_render`, with the visitor this server signed
in, and comes back with its data — or its error state, a refusal in the action's own words — and the runs that fed it,
for a page that debugs. Keep `/_render` off the path a browser reaches: the gateway sends it nothing.

```ts
const worker = createWorker({ adapters, identity, ...engine, render: { secret: RENDER_SECRET } });
const pages = createServer({
  adapters,
  auth,
  engine: engineOnWorker({ ...engine, render: { url: 'http://worker:8892', secret: RENDER_SECRET } })
});
```

The worker may also be on an origin of its own (`https://actions.example.com`): give both `action.origin`, and the
worker the origins of the pages that call it (`action.pageOrigins`). The pages are told the address there and call it
with the visitor's cookies; the worker answers those origins with CORS and credentials, takes them as its own in its
cross-site check, and refuses any other site — and refuses to start with `origin` and no `pageOrigins`. The session must
be readable there (a cookie scoped to a parent domain both share, `authCookie.domain`), and its `getSpaceDeployment`
sees the worker's host, not the page's. Only the actions move: a page's `/fn` routes and channels stay on its own origin.

```ts
const engine = { action: { lookups, origin: 'https://actions.example.com' } };

const pages = createServer({ adapters, auth, engine: engineOnWorker(engine) });
const worker = createWorker({
  adapters,
  identity: auth.ssrIdentityAdapters,
  action: { ...engine.action, pageOrigins: ['https://www.example.com'] }
});
```

Both ways, as three processes and as two: [`examples/self-hosting/11-actions-on-a-worker`](../../examples/self-hosting/11-actions-on-a-worker).

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

What the built-in template does that a custom one has to decide for itself:

- **The space travels beside the page.** The built-in template leaves it out of the payload, names it with
  `spaceDocumentPath` and its bootstrap fetches it before it hydrates. A custom template is handed the space inline in
  `offlineData`, as before.
- **The page paints before anything it does not need to paint.** The head asks for the stylesheets alone, and the
  `Link` header and the `103 Early Hints` for the SDK's; the bootstrap asks for the SDK, the plugins the page draws,
  React and the space's document once the page has painted (a frame, and the task after it — at once in a tab nobody
  sees). On a phone's network they shared the line with the stylesheets and the page painted when all had arrived: the
  dashboard's space page painted at 1.06 s instead of 1.58 s, and hydrated when it did.
- **What a visitor does before React listens is kept.** Until the SDK's `render` call nothing answers on the page, which
  has painted: a tap is made again once the page has hydrated (unless the browser acted on it itself — a link, a
  field, a box), a form sent is held and sent through the page (by the browser it posted the fields, passwords
  included, to the page's own address), and what was typed or ticked is put back over what React set the fields to.
- **Only the plugins the page draws are imported up front.** An entry with `deferred` is handed to `render()` as
  `{ load: () => import(js), css, declaration }`: the SDK registers it at once and loads its code and stylesheet the
  first time one of its elements is drawn. A template that imports every entry statically still works; it only loads
  more than the page draws.

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
| `iconsCssPath` | `string` | URL for Font Awesome's stylesheet, linked after `cssPath`; its fonts are files beside it. Defaults to `/sdk-assets/plitzi-sdk-icons.css`. |
| `spaceDocumentPath` | `string` | Where the page fetches the space from (`/_plitzi/space/<hash>.json`), read by the bootstrap — once the page has painted — before it hydrates. Set by the built-in template's render; absent for a draft preview and for a custom `templateFn`, which receive the space inline in `offlineData`. |
| `builderJsPath` | `string` | URL for the builder JS module. Omitted by default. |
| `builderCssPath` | `string` | URL for the builder stylesheet. Omitted by default. |
| `plugins` | `PluginEntry[]` | Plugin entries to inject. Normally set automatically via `pluginNames`. An entry with `deferred` is one the page draws none of: its declaration, for the browser to load its code when a page that draws it is opened. |
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

## Logging

One stream and one threshold, the usual hierarchy: `silent` < `error` < `warn` < `info` < `debug`. In production the
server says only what went wrong — a failed request, a failed run, a server that could not start — and everything
below it is one `logLevel` away:

| Level | What it adds |
|---|---|
| `error` | Requests answered 5xx or that threw, runs that did not complete, anything the server could not do. |
| `warn` | Refused actions (a bad webhook signature, a missing session), plugin manifests it could not fetch, HTTP/3 falling back. |
| `info` | Every request line, every run, plugin builds, `listening on`. |
| `debug` | The per-render phase breakdown of [Dev metrics](#dev-metrics). |

```ts
createServer({ adapters, logLevel: process.env.LOG_LEVEL === 'info' ? 'info' : 'error', logger: consoleLogger });
```

A request below the threshold is not even turned into an event, so a quiet server pays nothing per request. Everything goes to the `logger` —
requests, MCP tool calls, runs, and the server's own messages as `kind: 'message'` events — and `logLevelOf(event)`
tells a sink how severe each one is. The run and refusal loggers a deployment wires itself (`createRunLogger`,
`createRejectLogger`) are held to the same threshold, and so is `serverLog`, the server's own voice, which a
deployment's adapters can speak through too:

```ts
import { serverLog } from '@plitzi/sdk-kernel/log';

serverLog.warn('Adapters', 'space 12 has no deployment, serving main');
```

## Dev metrics

When `devMode: true`, per-phase timing is instrumented on every render and reported in two ways:

- A `Server-Timing` header is set on the response, visible in the browser's DevTools under **Network → Timing**.
- A one-line summary is logged at `debug` (see [Logging](#logging)):

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

What this package's own code defines is exported from it:

```ts
import type {
  ServerConfig,
  SSRContext,
  PipelineExtensions,
  JsonAdaptersConfig,
  AuthAdapters,
  AuthAdaptersConfig,
  CloudAdaptersConfig,
  SpaceAdaptersConfig
} from '@plitzi/sdk-server';
```

`ServerConfig` is what `createServer` takes — `SSRServerConfig` with the page adapters required, plus `auth` and
`sessionRenewal` — and what a project types its own options with. `SSRContext` here is the request context a pipeline
stage sees.

Each type is the package's that owns it. The page server's own configuration and what it answers are this package's;
what every server process is built on — the request pipeline, the adapters a deployment answers and what they are
asked with — the kernel's; what the browser reads too, `@plitzi/sdk-shared`'s:

```ts
import type {
  SSRServerConfig,
  SSRPageServerConfig,
  SSRServer,
  SSRTemplateFn,
  PluginRegistry,
  CacheFilter,
  CacheManager
} from '@plitzi/sdk-server';
import type {
  SSRAdapters,
  SSRPageAdapters,
  SSRRequest,
  SSRResponseHelpers,
  SSRMiddleware,
  SSRMiddlewareNext,
  SSRSpaceDeployment,
  SSRTemplateProps,
  SSRCredential,
  SSRHeaders,
  SSRRscContext,
  ServerBaseConfig
} from '@plitzi/sdk-kernel/types';
import type {
  SSRUser,
  SSRRscData,
  PluginSource,
  PluginSourceFile,
  PluginSourceComponent,
  PluginAction,
  PluginEntry
} from '@plitzi/sdk-shared';
```

The engine's — the job queue, `EngineOptions` — are `@plitzi/sdk-actions/types`.
