---
'@plitzi/cli': patch
---

A counter's lifetime is written in the same step as the counter: none is left without one.

## Server actions

- **`ActionKvAdapter.increment(key, amount, ttlSeconds?)` gives the counter it creates its lifetime in that same atomic
  step**, and `expire` is gone from the adapter. A live counter keeps its own lifetime (a window never stretches on a
  hit), and one holding none takes the one it is given. An increment and an `expire` after it left the counter for good
  when the store failed the second — a Redis timing out between `INCRBY` and `EXPIRE` kept rate-limit windows and
  per-day counters with no lifetime. `createRedisKv` increments with one script; the SQLite, MySQL, Mongo, memory and
  file adapters in the upsert they already were. Held to by the adapters' shared contract.

## To do when you upgrade

- **A `kv` adapter of your own** (`createPlatform({ action: { kv } })`): `increment` takes `ttlSeconds` and writes it in
  the same atomic step as the counter — to a counter it creates, or to a live one holding none — and `expire` is no
  longer called; remove it. The ones `@plitzi/sdk-actions` ships need nothing.
