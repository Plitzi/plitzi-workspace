---
'@plitzi/cli': patch
---

A renewed session reaches what the page publishes from it — the builder's credential among them.

## A renewal is published

- **`auth.accessToken`** kept the token a renewal had replaced: a renewal stays `authenticated`, so no state event
  carried it, and nothing rendered the page again to read it. The builder, which takes its credential from it
  (`userKey`), asked with the replaced token, was refused, and said "Authentication required" over a session that had
  just been renewed — what 0.39.19's own warning ("no new credential reached the builder") showed. The auth provider
  now emits a `session` event when the token or the person changes under the same state (another tab's renewal too),
  and the page renders again with them.
