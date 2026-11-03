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
- **`X-Cache`** answers `STALE` too: a page served past its TTL while it is rendered again.
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

## Elements (`@plitzi/sdk-elements`)

- An element reads its items by their own paths. Inside a component instance, a read of the whole `schema.flat` merged
  the component's elements over every element of the space, once per instance: the home page of a two-thousand-element
  site hydrated in 16% less main-thread blocking time on a slow phone without it.
