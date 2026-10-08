---
'@plitzi/sdk-server': patch
---

- **`server.cache.invalidate` drops what a page is rendered from** (`@plitzi/sdk-server`): the pages, the RSC answers
  and the schema data they are rendered from go together. It dropped the pages alone, and the next request rendered
  the same page again from the schema still cached under the same key — a publish that invalidated the space changed
  nothing until the schema's TTL ran out. `clear()` and `size` cover the three. A filter on `hostname` drops the schema
  data too, which belongs to no one host. `server.cache` is `null` only when nothing is cached (`cacheTtlMs: 0` and
  `rsc.cacheTtlMs: 0`).
