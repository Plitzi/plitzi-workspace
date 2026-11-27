---
'@plitzi/cli': patch
---

The builder's refused requests renew the session again, not only the SDK's.

## One auth failure channel per page

- **The builder** carries its own copy of `@plitzi/sdk-shared` beside the SDK's, and the channel a refused request is
  said to auth through was a module of each copy: the builder reported its 401s on its own, the SDK's auth listened on
  the other, nothing renewed and every refused query was still an "Authentication required" toast. The channel's
  listeners are now one set per page (`Symbol.for`, as `sharedContext`), so a refusal from any copy reaches the auth of
  any other.
