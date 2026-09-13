---
'@plitzi/sdk-mcp': minor
---

Screenshots take a colour scheme, and a page that answers with an error is a failed capture rather than a picture.

- **`colorScheme` on `ScreenshotInput`** (`'light' | 'dark'`, optional). It is emulated as `prefers-color-scheme`
  before the page loads — the HTTP client forwards it to the browser service, the local client applies it through
  Playwright's `emulateMedia` or Puppeteer's `emulateMediaFeatures`. A space on the `system` theme follows it; a space
  that forces a theme keeps its own. Left out, captures stay in the browser's default, which is light.
- **`RENDER_FAILED`.** An error page paints as well as any other, so a capture of "Space not found" came back as a valid
  PNG and the thumbnail endpoint cached it for an hour. The browser service now refuses a page answering ≥ 400 with
  `502 { error: 'RENDER_FAILED', status }`, and the HTTP client reports that as `RENDER_FAILED` instead of
  `SCREENSHOT_FAILED`. The local client checks the navigation's status the same way.
