---
'@plitzi/sdk-mcp': minor
---

Capture a page without standing up a browser service.

`createHttpScreenshotClient` talks to a dedicated browser pod, which is the right answer in a cluster and the
wrong one everywhere else: somebody self-hosting had to deploy a second service before they could look at
anything. `createLocalScreenshotClient` resolves a browser at run time from whatever the host already has —
Playwright, then Puppeteer — and returns `undefined` when it has neither, so a caller can decide once not to
offer the tool rather than fail on every call.

Nothing is added to this package's dependency tree and nothing is imported until the client is asked for. It
implements the same `ScreenshotClient` interface as the HTTP one, so the two are interchangeable at the call
site, and it grows the window to the SDK's inner scroller before it shoots — which is the difference between a
whole page and one viewport of it.
