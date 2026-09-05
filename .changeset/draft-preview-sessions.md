---
'@plitzi/sdk-shared': minor
'@plitzi/sdk-server': minor
'@plitzi/sdk-mcp': minor
---

Draft previews you can iterate against, and a `DraftStore` contract that says so.

A preview token was one-shot: spent by the render that used it. That is right for a capture and wrong for a
person — reloading showed the saved space again, so "look at the change, adjust it, look again" meant minting a
new token for every look. `POST /__preview` now takes `mode: 'session'`, which mints a token that stays
resolvable until it expires (`preview.sessionTtlMs`, 15 minutes by default) or until `POST /__preview/end` ends
it. The token is remembered in an `HttpOnly` cookie on the first render, so the draft follows a navigation —
the page after a link carries no query parameter.

A draft render, either mode, is never cached, never metered and answers `Cache-Control: no-store` plus
`X-Robots-Tag: noindex`. Data refreshes (`/_rsc`) made from inside a session are excluded from metering and
caching too — without that, an open preview tab would be billed as live traffic.

**Breaking, for anyone who implements `DraftStore`** (a shared store for a multi-replica deployment). The
default in-memory store is unaffected; a custom one needs three changes:

```ts
// before
put(token, data, ttlMs)
take(token): OfflineDataRaw | undefined

// after
put(token, data, { ttlMs, reusable })      // `reusable` is a session; absent is one-shot
take(token): { data, reusable } | undefined // consume unless reusable — and say which it was
drop(token)                                 // end a session before its TTL
```

`take` reports which kind it resolved because the render that resolves a session is the one that has to remember
it for the rest of the visit, and only the store knows whether the token survived the read.
