---
'@plitzi/cli': patch
---

Pages served faster and kept in step across replicas: the render cache keeps pages compressed and bounded by bytes,
renders a page once however many ask for it, serves it while it is rendered again, and — given a bus and a store —
shares pages and invalidations between every replica of a deployment. A component instance no longer copies the whole
space while it hydrates.

## To do when you upgrade

- **Several replicas of a page server** give it `cache: { bus, store }` — `createRedisPubSub` for the bus,
  `createRedisPageStore` for the store — or each serves what a write made untrue until its copy expires; the server
  says at boot which it has. A process that writes spaces without serving them says the invalidation with
  `createCacheInvalidator({ bus, store })`.
- **A custom template** (`templateFn`) or code reading the page's runtime `<style>` for the space's rules: they are in
  the linked `/_plitzi/style/<hash>.css` now (`style.cacheHref`).
- **`templatePaths`** answers a `readonly string[]` and **`pageElementTypes`** a `ReadonlySet`: they are shared now;
  copy one before changing it.
- **`X-Cache`** answers `STALE` too: a page served past its TTL while it is rendered again.
- **A `runtime: 'server'` provider with `credentials: 'include'`** is no longer refused by authoring: it is asked with
  the visitor's cookies where the server names that API (`rsc.visitorCredentials`), and is the provider's error, naming
  the setting, anywhere else. `ServerQuery`'s `url` kind carries `asVisitor`.
- **`ServerTemplateData`** carries `paintedKeys` and `state`, and `serverQueryProblem` takes the painted keys: a resolver
  that builds one passes both (`requestPaintedState`).
- **`usePlitzi().settings`** no longer carries `isHydrating` nor `theme`: read `useRenderSettings().isHydrating` and
  `useTheme().resolvedTheme`. Every element reads that context, so a value that changed there drew every element again.
- **The plugins' stylesheets** are in a context of their own: `use(PluginAssetsContext).assets`, not
  `use(PluginsContext).assets`.
- **A page's Google families** are asked of the page server's own origin (`/_plitzi/fonts/google/…`): a proxy or CDN in
  front of it passes that path through as it does `/_plitzi/style/`. `fonts: { google: false }` links Google itself.
  `fontsToHead` takes the mirror's address as a third argument, and `googleCss2Url` a base.
- **A link's analytics parameters** (`utm_*`, `fbclid`, `gclid`…) are no longer seen by a published page's server
  render, and a page is kept without them; the browser still reads them. `cache.ignoredQueryParams: []` keeps the old
  behaviour.

## The server (`@plitzi/sdk-server`)

- The render cache keeps a page in the encoding the server prefers — a 1 MB page as the ~90 KB a browser is sent — and
  is bounded by bytes. It dropped the page stored first, the site's home page among them, and held up to 500 pages of
  any size.
- The caches are a segmented LRU: a page starts on probation and is protected once it is served again, and probation
  gives way first. A page of a space barely visited, or every URL a crawler makes up, no longer pushes out the pages
  asked for all the time — on a server of many spaces, one that just got busy takes the room of the ones gone quiet.
- `cache.maxBytes` defaults to `SDK_SERVER_CACHE_MAX_BYTES`, else 128 MB a process; the Redis store to
  `SDK_SERVER_CACHE_STORE_MAX_BYTES`, else 128 MB, under its own budget — never Redis's eviction, which would reach the
  job queues beside it.
- A published space is kept as the object it was read as: kept as text, every render parsed it again, and serialised and
  hashed it again for the page's payload.
- The requests for a page that arrive while it renders wait for that render: a page a publish invalidated was rendered
  once per visitor who asked for it in the meantime.
- A page past its TTL is served for `cache.staleMs` (60 s) while one request renders it again behind it.
- `cache.bus` carries an invalidation to every replica; `cache.store` keeps the pages rendered for nobody in particular
  where every replica reads them, so a replica that never rendered a page — a new one, after a scale-up — serves it
  warm. A store that cannot answer is a miss, said in the log.
- The query string is keyed in one order, without the parameters `cache.ignoredQueryParams` names.
- The RSC answers and the schema data are bounded by bytes too.

## The space's stylesheet

- A server-rendered page links the space's compiled stylesheet as `/_plitzi/style/<hash>.css` instead of carrying it:
  the Plitzi dashboard's HTML went from 496 KB to 111 KB, and its render served ~60% more requests a second. The space
  document names it (`style.cacheHref`, an empty `cache`) and the template links it in the head (`styleSheetPath`); any
  replica answers it, kept for good under its name. A draft preview, a space named by `?access-token`, a deployment's
  own `templateFn` and a stylesheet with `{{ tokens }}` still carry it in the page; a client-side render receives it as
  before.
- `styleCacheInDocument`, `markStyleCache`, `styleCacheFromDocument` and `styleCacheTravelsInDocument` are gone: the
  page no longer carries the stylesheet for the bootstrap to read back.

## Rendering, per request

- A development server's `Server-Timing` names what a page spent before it was rendered — each middleware
  (`deployment`, `auth`, the deployment's own by name) and the metering (`meter`) — beside the render's own phases.
- The route a page is matched by is compiled once (`matchPath`), the paths a template reads are read once per template
  (`templatePaths`, now `readonly string[]`), and a page's element types once per schema and page
  (`pageElementTypes`, now a `ReadonlySet`); every render — the server's and the browser's — did all three again.
- The plugins a space's elements render are found once per version of the space, not on every render.

## What a page loads, sooner

- The SDK's module is preloaded from the head (`modulepreload`), and with the SDK's stylesheets is said in a
  `103 Early Hints` before the page is rendered and again as its `Link` header (`earlyHints: false` turns both off): the
  browser had to parse the whole HTML to find the script.
- **Server providers asked as the visitor** (`rsc.visitorCredentials`: the deployment's own API origins, where it
  reaches them, the cookies carried, the spaces trusted to ask). A signed-in page — an account's dashboard — arrives
  drawn with its visitor's data instead of empty until the browser has run and asked: the Plitzi dashboard's space page
  went from a dozen requests after hydration to two, and its largest paint on a 4G phone from 3.9 s to 1.3 s with the
  thumbnail below. A page or a `/_rsc` refresh read so is kept by no cache.
- **Google Fonts from the page's own server**: the stylesheet and its files ride the page's connection — no lookup,
  handshake and connection to two more origins before the text is drawn — kept in the process (32 MB,
  `fonts.google.maxBytes`), and the visitor's address is not handed to Google. A server that cannot reach Google sends
  the browser there, and says so.
- A page's uploaded fonts are addressed in the browser as the server addressed them (`Server.fontsBaseUrl` is set
  now): a deployment with `fonts.baseUrl` on a CDN had the SDK write them again under `/fonts`.
- `@plitzi/sdk-mcp`'s screenshots take `format: 'webp'` and `quality`: a thumbnail is an eighth of its PNG.
- **A `system` theme drawn as the machine asks** on the server: the page asks Chromium for `Sec-CH-Prefers-Color-Scheme`
  (`Accept-CH`), the SDK keeps the scheme in a `<theme cookie>-scheme` cookie, and `{{ theme.resolved }}` — a picture's
  address — is the same before and after hydration instead of the light one swapped for the dark. `ThemeProvider` and
  the SDK take `scheme`; the page cache is keyed by it where the theme defers to the machine.
- **A server provider reads the state the space paints**: `{{ state.workspace.id }}` in a `runtime: 'server'` provider's
  `query`, for a key of `settings.paintedState`, is the value the page starts from — and the provider asks `/_rsc` again
  when the browser comes to write its address differently. A signed-in dashboard's workspace parts arrive drawn.
- A painted key another account kept is dropped only while it still holds that account's value: what this account wrote
  before the check — a server provider's first answer — is its own.

## A page that answers sooner on a phone

- A server-rendered page is drawn once as it hydrates, not three times: the component registry and the plugin registry
  were new objects right after hydration — the host's `<PlitziSdk.Plugin>` children read again, an empty plugin list
  replacing an empty one — and every container redraws from them. On a published page a container now follows only
  whether its own items' types are registered, so a plugin that arrives later redraws the container that draws it. The
  website's landing page on a slow phone (CPU 4×, mobile): 1838 element renders once instead of three times, its Total
  Blocking Time from 1.1 s to 0.48 s; the signed-in dashboard from 0.57 s to 0.34 s.
- Hydration no longer draws every container again when it ends: only an element with a `runtime: 'client'` or
  `'server'` item follows the switch from the server's markup to the browser's.
- The page's context carries only what holds for the life of the page (see above), and the plugins' stylesheets their
  own context: an element registering its styles as it mounts drew every container again.

## Elements (`@plitzi/sdk-elements`)

- An element reads its items by their own paths. Inside a component instance, a read of the whole `schema.flat` merged
  the component's elements over every element of the space, once per instance: the home page of a two-thousand-element
  site hydrated in 16% less main-thread blocking time on a slow phone without it.
