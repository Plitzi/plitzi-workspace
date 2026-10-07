---
'@plitzi/sdk-server': patch
---

- **`unusedPort()`** (`@plitzi/sdk-server`): a port the system has just handed out, for a test to listen on. The
  package's own tests and `@plitzi/sdk-mcp`'s listened on fixed ports in the ephemeral range (393xx), which any
  outgoing connection of a test running beside them could take: CI failed with `EADDRINUSE` on runs with nothing
  wrong. Every one now listens on a port the system gives it.
