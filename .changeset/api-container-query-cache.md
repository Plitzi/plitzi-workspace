---
'@plitzi/sdk-shared': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/plitzi-builder': patch
---

- **An `apiContainer` can keep its browser requests in a query cache, the way react-query does.** Moving between
  sections or pages used to ask the API again every time a provider was shown: a provider in a hidden section is
  mounted but disabled, so showing it fired a fresh request, and a page navigation remounted it and did the same.
  With the new `cache: true` an answer is kept for `staleTime` seconds (30 by default) and shared by every cached
  provider asking the same thing — same method, URL, credentials and headers, the token included, so two visitors
  never share one. Past its time the answer is still drawn at once and a fresh one is fetched behind it; an answer
  nobody shows is forgotten after `gcTime` seconds (300 by default). A refused request (`4xx`/`5xx`) is shown but
  never kept. **The cache is off unless an element asks for it**: an uncached provider behaves as before, asking on
  every mount and sharing nothing.

  The cache is `@plitzi/sdk-shared/queries` (`queryCache`, `useQuery`, `invalidateQueries`,
  `invalidateQueriesForWrite`), a nexus store written with the per-path `ttl` of `@plitzi/nexus` 1.2.0, which every
  consumer now requires. It reacts to the store's own freshness events, so anything that expires a query's path
  makes the providers on screen ask again.

  An answer stops counting as current before its time when the element's `performQuery` runs (it always asks
  again), when a flow runs the new global `invalidateQueries` step (source `queries`: `elements`, api container ids
  — a container's requests are tagged with its own id — and/or a `url` prefix), and after a write. Both write steps
  gained `invalidateQueries` / `invalidateElements`: a `webHook` sent with anything but `GET`/`HEAD` refreshes the
  requests to its own site by default, a completed `runServerAction` refreshes all of them by default, and either
  can name containers instead or refresh nothing. A `writeRecord` refreshes all. Providers on screen ask again at
  once; the rest when they are next shown. A sign-in, sign-out or change of account drops everything held. Server-driven
  providers and RSC are untouched.

- **A `webHook` that reads can be cached** (`cache`, `staleTime`), in the same cache and under the same key as an api
  container asking the same thing. Its declaration now lives beside it (`utility/webHookSpec`) and the authoring
  catalog gathers it instead of keeping a copy. A `HEAD` is no longer sent with a body, which `fetch` refused.

- The dev-tools' Store tab lists the paths a store holds with a TTL — how long ago each was written, what is left
  of it, and a button to expire one or all of them. The query cache appears there as "Queries".

- `useApi` no longer takes `params`: nothing passed them, and a GET cannot carry a body anyway. A mock now answers
  synchronously, without a loading frame, and a provider whose URL has not resolved asks for nothing.
