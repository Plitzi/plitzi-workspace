---
'@plitzi/sdk-server': patch
'@plitzi/cli': patch
'@plitzi/sdk-shared': patch
---

- **`unusedPort()`** (`@plitzi/sdk-server`): a port the system has just handed out, for a test to listen on. The
  package's own tests and `@plitzi/sdk-mcp`'s listened on fixed ports in the ephemeral range (393xx), which any
  outgoing connection of a test running beside them could take: CI failed with `EADDRINUSE` on runs with nothing
  wrong. Every one now listens on a port the system gives it.
- **Brotli at quality 5** (`@plitzi/sdk-server`): `compression.brotliQuality`, for a page rendered for one request, is
  5 (was 2). At 2 a 220 KB page came out larger than gzip — 36 KB against 31 — and at 5 it is 29 KB, for the CPU gzip
  spends; on half a core ~0.1 ms a page.
- **`verify` checks the pages for signed-in visitors** (`@plitzi/cli`): a page that sends the browser to sign in is
  checked again signed in as the account `.env` names — `PLITZI_CHECK_USER`, `PLITZI_CHECK_PASSWORD` (the environment
  wins over `.env`). With none named, `verify` says how. `page check --as` reads the password from `.env` too, and
  `page check` takes several pages, in one browser.
