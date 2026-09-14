# @plitzi/sdk-server

## 0.35.2

### Patch Changes

- v0.35.2
- Updated dependencies [470aaf8]
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/plitzi-sdk@0.35.2
  - @plitzi/sdk-shared@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/plitzi-sdk@0.35.1
  - @plitzi/sdk-shared@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.35.0
  - @plitzi/sdk-shared@0.35.0

## 0.34.1

### Patch Changes

- v0.34.1
- Updated dependencies [cba7b8b]
- Updated dependencies
  - @plitzi/plitzi-sdk@0.34.1
  - @plitzi/sdk-shared@0.34.1

## 0.34.0

### Minor Changes

- v0.34.0
- 5aceda0: Draft previews you can iterate against, and a `DraftStore` contract that says so.

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

### Patch Changes

- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [5aceda0]
- Updated dependencies [9c3292c]
  - @plitzi/sdk-shared@0.34.0
  - @plitzi/plitzi-sdk@0.34.0

## 0.33.2

### Patch Changes

- v0.33.2
- Updated dependencies
  - @plitzi/plitzi-sdk@0.33.2
  - @plitzi/sdk-shared@0.33.2

## 0.33.1

### Patch Changes

- v0.33.1
- Updated dependencies
  - @plitzi/plitzi-sdk@0.33.1
  - @plitzi/sdk-shared@0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.33.0
  - @plitzi/sdk-shared@0.33.0

## 0.32.25

### Patch Changes

- v0.32.25
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.25
  - @plitzi/sdk-schema@0.32.25
  - @plitzi/sdk-shared@0.32.25

## 0.32.24

### Patch Changes

- v0.32.24
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.24
  - @plitzi/sdk-schema@0.32.24
  - @plitzi/sdk-shared@0.32.24

## 0.32.23

### Patch Changes

- v0.32.23
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.23
  - @plitzi/sdk-schema@0.32.23
  - @plitzi/sdk-shared@0.32.23

## 0.32.22

### Patch Changes

- v0.32.22
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.22
  - @plitzi/sdk-schema@0.32.22
  - @plitzi/sdk-shared@0.32.22

## 0.32.21

### Patch Changes

- v0.32.21
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.21
  - @plitzi/sdk-schema@0.32.21
  - @plitzi/sdk-shared@0.32.21

## 0.32.20

### Patch Changes

- v0.32.20
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.20
  - @plitzi/sdk-schema@0.32.20
  - @plitzi/sdk-shared@0.32.20

## 0.32.19

### Patch Changes

- v0.32.19
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.19
  - @plitzi/sdk-schema@0.32.19
  - @plitzi/sdk-shared@0.32.19

## 0.32.18

### Patch Changes

- v0.32.18
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.18
  - @plitzi/sdk-schema@0.32.18
  - @plitzi/sdk-shared@0.32.18

## 0.32.17

### Patch Changes

- v0.32.17
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.17
  - @plitzi/sdk-schema@0.32.17
  - @plitzi/sdk-shared@0.32.17

## 0.32.16

### Patch Changes

- v0.32.16
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.16
  - @plitzi/sdk-schema@0.32.16
  - @plitzi/sdk-shared@0.32.16

## 0.32.15

### Patch Changes

- v0.32.15
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.15
  - @plitzi/sdk-schema@0.32.15
  - @plitzi/sdk-shared@0.32.15

## 0.32.14

### Patch Changes

- v0.32.14
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.14
  - @plitzi/sdk-schema@0.32.14
  - @plitzi/sdk-shared@0.32.14

## 0.32.13

### Patch Changes

- v0.32.13
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.13
  - @plitzi/sdk-schema@0.32.13
  - @plitzi/sdk-shared@0.32.13

## 0.32.12

### Patch Changes

- v0.32.12
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.12
  - @plitzi/sdk-schema@0.32.12
  - @plitzi/sdk-shared@0.32.12

## 0.32.11

### Patch Changes

- v0.32.11
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.11
  - @plitzi/sdk-schema@0.32.11
  - @plitzi/sdk-shared@0.32.11

## 0.32.10

### Patch Changes

- v0.32.10
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.10
  - @plitzi/sdk-schema@0.32.10
  - @plitzi/sdk-shared@0.32.10

## 0.32.9

### Patch Changes

- v0.32.9
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.9
  - @plitzi/sdk-schema@0.32.9
  - @plitzi/sdk-shared@0.32.9

## 0.32.8

### Patch Changes

- v0.32.8
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.8
  - @plitzi/sdk-schema@0.32.8
  - @plitzi/sdk-shared@0.32.8

## 0.32.7

### Patch Changes

- v0.32.7
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.7
  - @plitzi/sdk-schema@0.32.7
  - @plitzi/sdk-shared@0.32.7

## 0.32.6

### Patch Changes

- v0.32.6
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.6
  - @plitzi/sdk-schema@0.32.6
  - @plitzi/sdk-shared@0.32.6

## 0.32.5

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.5
  - @plitzi/sdk-shared@0.32.5

## 0.32.4

### Patch Changes

- v0.32.4
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.4
  - @plitzi/sdk-shared@0.32.4

## 0.32.3

### Patch Changes

- v0.32.3
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.3
  - @plitzi/sdk-shared@0.32.3

## 0.32.2

### Patch Changes

- v0.32.2
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.2
  - @plitzi/sdk-shared@0.32.2

## 0.32.1

### Patch Changes

- v0.32.1
- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.1
  - @plitzi/sdk-shared@0.32.1

## 0.32.0

### Minor Changes

- v0.32.0

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.32.0
  - @plitzi/sdk-shared@0.32.0

## 0.31.2

### Patch Changes

- v0.31.2
- Updated dependencies
  - @plitzi/plitzi-sdk@0.31.2
  - @plitzi/sdk-shared@0.31.2

## 0.31.1

### Patch Changes

- v0.31.1
- Updated dependencies
  - @plitzi/plitzi-sdk@0.31.1
  - @plitzi/sdk-shared@0.31.1

## 0.31.0

### Minor Changes

- v0.31.0

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.31.0
  - @plitzi/sdk-shared@0.31.0

## 0.30.19

### Patch Changes

- v0.30.19
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.19
  - @plitzi/sdk-shared@0.30.19

## 0.30.18

### Patch Changes

- v0.30.18
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.18
  - @plitzi/sdk-shared@0.30.18

## 0.30.17

### Patch Changes

- v0.31.0
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.17
  - @plitzi/sdk-shared@0.30.17

## 0.30.16

### Patch Changes

- v0.30.16
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.16
  - @plitzi/sdk-shared@0.30.16

## 0.30.15

### Patch Changes

- v0.30.15
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.15
  - @plitzi/sdk-shared@0.30.15

## 0.30.14

### Patch Changes

- v0.30.14
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.14
  - @plitzi/sdk-shared@0.30.14

## 0.30.13

### Patch Changes

- v0.30.13
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.13
  - @plitzi/sdk-shared@0.30.13

## 0.30.12

### Patch Changes

- v0.30.12
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.12
  - @plitzi/sdk-shared@0.30.12

## 0.30.11

### Patch Changes

- v0.30.11
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.11
  - @plitzi/sdk-shared@0.30.11

## 0.30.10

### Patch Changes

- v0.30.10
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.10
  - @plitzi/sdk-shared@0.30.10

## 0.30.9

### Patch Changes

- v0.30.9
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.9
  - @plitzi/sdk-shared@0.30.9

## 0.30.8

### Patch Changes

- v0.30.8
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.8
  - @plitzi/sdk-shared@0.30.8

## 0.30.7

### Patch Changes

- v0.30.7
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.7
  - @plitzi/sdk-shared@0.30.7

## 0.30.6

### Patch Changes

- v0.30.6
- Updated dependencies
  - @plitzi/sdk-shared@0.30.6
  - @plitzi/plitzi-sdk@0.30.6

## 0.30.5

### Patch Changes

- v0.30.5
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.5
  - @plitzi/sdk-shared@0.30.5

## 0.30.4

### Patch Changes

- v0.30.4
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.4
  - @plitzi/sdk-shared@0.30.4

## 0.30.3

### Patch Changes

- v0.30.3
- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.3
  - @plitzi/sdk-shared@0.30.3

## 0.30.2

### Patch Changes

- v0.30.2
- Updated dependencies
  - @plitzi/sdk-shared@0.30.2
  - @plitzi/plitzi-sdk@0.30.2

## 0.30.1

### Patch Changes

- v0.30.1
- Updated dependencies
  - @plitzi/sdk-shared@0.30.1
  - @plitzi/plitzi-sdk@0.30.1

## 0.30.0

### Minor Changes

- v0.30.0

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.30.0
  - @plitzi/sdk-shared@0.30.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.29.0
  - @plitzi/sdk-shared@0.29.0
