# MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server an agent uses to read and edit the space.

```bash
yarn start        # http://127.0.0.1:4005
yarn inspector    # the official MCP Inspector, point it at the URL above
```

```bash
curl -s -X POST http://127.0.0.1:4005/ \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

A dedicated MCP server **owns its whole origin**: it answers JSON-RPC on every path, not under `/mcp`.

## What matters

The adapters in [`src/main.ts`](./src/main.ts), which differ from a page server's in two ways:

- **Schema and style are separate documents.** The tools edit them independently, so they are read and written
  apart rather than as one `offlineData` blob.
- **`getSpaceId` is the authorization boundary.** It normally decodes a verified bearer token, which is why the
  JWT secret stays on your side and the server can be stateless. This example returns `1` for every caller —
  that is the one line you must not ship.

Writes land in a temp copy of the space, so a session never dirties the shared fixture. Delete it to reset.

## Next

Both surfaces at once, plus preview: [ssr-preview](../02-ssr-preview).
