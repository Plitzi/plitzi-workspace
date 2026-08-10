# My space with an agent

`@plitzi/sdk-mcp`: an [MCP](https://modelcontextprotocol.io) server an agent reads and edits the space through.

| | Example | What it is | Port |
|---|---|---|---|
| 01 | [mcp-server](./01-mcp-server) | A dedicated MCP server, owning its whole origin | 4005 |
| 02 | [ssr-preview](./02-ssr-preview) | MCP and pages on one port, plus draft preview | 4006 |

Both write to a **temp copy** of the sample space, so a session never dirties the fixture.

`01` is the shape a real MCP deployment has. `02` is the integration worth reading last: an agent proposes edits,
they render without being saved, and a normal page request serves that draft once.

## Next

Nothing — this is the end of the tour. The packages are documented in
[`@plitzi/sdk-server`](../../apps/server/README.md) and [`@plitzi/sdk-mcp`](../../apps/mcp/README.md).
