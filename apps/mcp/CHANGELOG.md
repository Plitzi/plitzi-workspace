# @plitzi/sdk-mcp

## 0.35.3

### Patch Changes

- 0211dc4: A form speaks the site's language when it refuses a value.

  - **Every rule of a `formControl` can say what it wants to say.** `requiredMessage`, `minLengthMessage`,
    `maxLengthMessage` and `formatMessage` join `patternMessage` and `matchesMessage`; left empty, each falls back to
    the English sentence it said before. `formatMessage` is said when the value does not have the shape the control's
    type asks for — an address, for an `email` — one attribute for every type that has a shape. Offered in the builder under the rule they belong to.
  - **A `form` can turn the browser's own checks off (`noValidate`, "Skip Browser Validation" in the builder).** Left on
    — the default, as before — the browser answers first for a blank required field and a malformed address, in a
    bubble no style reaches and in the browser's language, while every other rule answers under the control. Turned
    on, the form's rules are the only ones, and all of them answer under the control.
  - **An `email` control checks the address itself,** by the same definition the browser uses, so the format is still
    asked for when the browser's checks are off.

- Updated dependencies [0211dc4]
  - @plitzi/plitzi-sdk@0.35.3
  - @plitzi/sdk-elements@0.35.3
  - @plitzi/sdk-interactions@0.35.3
  - @plitzi/sdk-schema@0.35.3
  - @plitzi/sdk-server@0.35.3
  - @plitzi/sdk-shared@0.35.3
  - @plitzi/sdk-style@0.35.3

## 0.35.2

### Patch Changes

- v0.35.2
- Updated dependencies [470aaf8]
- Updated dependencies
- Updated dependencies [470aaf8]
  - @plitzi/sdk-elements@0.35.2
  - @plitzi/plitzi-sdk@0.35.2
  - @plitzi/sdk-interactions@0.35.2
  - @plitzi/sdk-schema@0.35.2
  - @plitzi/sdk-server@0.35.2
  - @plitzi/sdk-shared@0.35.2
  - @plitzi/sdk-style@0.35.2

## 0.35.1

### Patch Changes

- v0.35.1
- Updated dependencies
  - @plitzi/plitzi-sdk@0.35.1
  - @plitzi/sdk-elements@0.35.1
  - @plitzi/sdk-interactions@0.35.1
  - @plitzi/sdk-schema@0.35.1
  - @plitzi/sdk-server@0.35.1
  - @plitzi/sdk-shared@0.35.1
  - @plitzi/sdk-style@0.35.1

## 0.35.0

### Minor Changes

- v0.35.0
- f5f6a97: Screenshots take a colour scheme, and a page that answers with an error is a failed capture rather than a picture.

  - **`colorScheme` on `ScreenshotInput`** (`'light' | 'dark'`, optional). It is emulated as `prefers-color-scheme`
    before the page loads — the HTTP client forwards it to the browser service, the local client applies it through
    Playwright's `emulateMedia` or Puppeteer's `emulateMediaFeatures`. A space on the `system` theme follows it; a space
    that forces a theme keeps its own. Left out, captures stay in the browser's default, which is light.
  - **`RENDER_FAILED`.** An error page paints as well as any other, so a capture of "Space not found" came back as a valid
    PNG and the thumbnail endpoint cached it for an hour. The browser service now refuses a page answering ≥ 400 with
    `502 { error: 'RENDER_FAILED', status }`, and the HTTP client reports that as `RENDER_FAILED` instead of
    `SCREENSHOT_FAILED`. The local client checks the navigation's status the same way.

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.35.0
  - @plitzi/sdk-elements@0.35.0
  - @plitzi/sdk-interactions@0.35.0
  - @plitzi/sdk-schema@0.35.0
  - @plitzi/sdk-server@0.35.0
  - @plitzi/sdk-shared@0.35.0
  - @plitzi/sdk-style@0.35.0

## 0.34.1

### Patch Changes

- v0.34.1
- Updated dependencies [cba7b8b]
- Updated dependencies
  - @plitzi/plitzi-sdk@0.34.1
  - @plitzi/sdk-elements@0.34.1
  - @plitzi/sdk-interactions@0.34.1
  - @plitzi/sdk-schema@0.34.1
  - @plitzi/sdk-server@0.34.1
  - @plitzi/sdk-shared@0.34.1
  - @plitzi/sdk-style@0.34.1

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

- 5aceda0: Capture a page without standing up a browser service.

  `createHttpScreenshotClient` talks to a dedicated browser pod, which is the right answer in a cluster and the
  wrong one everywhere else: somebody self-hosting had to deploy a second service before they could look at
  anything. `createLocalScreenshotClient` resolves a browser at run time from whatever the host already has —
  Playwright, then Puppeteer — and returns `undefined` when it has neither, so a caller can decide once not to
  offer the tool rather than fail on every call.

  Nothing is added to this package's dependency tree and nothing is imported until the client is asked for. It
  implements the same `ScreenshotClient` interface as the HTTP one, so the two are interchangeable at the call
  site, and it grows the window to the SDK's inner scroller before it shoots — which is the difference between a
  whole page and one viewport of it.

### Patch Changes

- Updated dependencies [5aceda0]
- Updated dependencies
- Updated dependencies [5aceda0]
- Updated dependencies [9c3292c]
  - @plitzi/sdk-shared@0.34.0
  - @plitzi/sdk-elements@0.34.0
  - @plitzi/plitzi-sdk@0.34.0
  - @plitzi/sdk-interactions@0.34.0
  - @plitzi/sdk-schema@0.34.0
  - @plitzi/sdk-server@0.34.0
  - @plitzi/sdk-style@0.34.0

## 0.33.2

### Patch Changes

- v0.33.2
- Updated dependencies
  - @plitzi/plitzi-sdk@0.33.2
  - @plitzi/sdk-schema@0.33.2
  - @plitzi/sdk-server@0.33.2
  - @plitzi/sdk-shared@0.33.2

## 0.33.1

### Patch Changes

- v0.33.1
- Updated dependencies
  - @plitzi/plitzi-sdk@0.33.1
  - @plitzi/sdk-schema@0.33.1
  - @plitzi/sdk-server@0.33.1
  - @plitzi/sdk-shared@0.33.1

## 0.33.0

### Minor Changes

- v0.33.0

### Patch Changes

- Updated dependencies
  - @plitzi/plitzi-sdk@0.33.0
  - @plitzi/sdk-schema@0.33.0
  - @plitzi/sdk-server@0.33.0
  - @plitzi/sdk-shared@0.33.0
