---
'@plitzi/cli': patch
---

A dedicated MCP server says what it is told to, where it is told to.

## Server

- **The MCP server applies its `logLevel` and `logger`.** `createServer` of `@plitzi/sdk-mcp/server` never did: it kept
  the process's default — errors alone, on the console, in production — whatever it was given. Its log showed nothing
  as it started, and no refusal after. It now says what a page server and a worker say, at the level and to the sink
  of its config (`slowRunMs` too).
