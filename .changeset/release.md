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
- **`X-Cache`** answers `STALE` too: a page served past its TTL while it is rendered again.
- **A link's analytics parameters** (`utm_*`, `fbclid`, `gclid`…) are no longer seen by a published page's server
  render, and a page is kept without them; the browser still reads them. `cache.ignoredQueryParams: []` keeps the old
  behaviour.

## The server (`@plitzi/sdk-server`)

- The render cache keeps a page in the encoding the server prefers — a 1 MB page as the ~90 KB a browser is sent — and
  is bounded by `cache.maxBytes` (64 MB a process), the page served least recently dropped first. It dropped the one
  stored first, the site's home page among them, and held up to 500 pages of any size.
- The requests for a page that arrive while it renders wait for that render: a page a publish invalidated was rendered
  once per visitor who asked for it in the meantime.
- A page past its TTL is served for `cache.staleMs` (60 s) while one request renders it again behind it.
- `cache.bus` carries an invalidation to every replica; `cache.store` keeps the pages rendered for nobody in particular
  where every replica reads them, so a replica that never rendered a page — a new one, after a scale-up — serves it
  warm. A store that cannot answer is a miss, said in the log.
- The query string is keyed in one order, without the parameters `cache.ignoredQueryParams` names.
- The RSC answers and the schema data are bounded by bytes too.

## Elements (`@plitzi/sdk-elements`)

- An element reads its items by their own paths. Inside a component instance, a read of the whole `schema.flat` merged
  the component's elements over every element of the space, once per instance: the home page of a two-thousand-element
  site hydrated in 16% less main-thread blocking time on a slow phone without it.
