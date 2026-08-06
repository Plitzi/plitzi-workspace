# Examples

Runnable Plitzi setups, grouped by what does the rendering. Each one is a real workspace package you can start
and hit — no pseudo-code, no snippets that assume a step not shown.

## [`01-client`](./01-client) — the browser, with `@plitzi/plitzi-sdk` alone

No server, no account, no API key.

| | Example | Difference | Port |
|---|---|---|---|
| 01 | [no-build](./01-client/01-no-build) | A plain HTML file: no bundler, no build step | 4000 |
| 02 | [render](./01-client/02-render) | The same `render()` call from a bundled app | 4001 |
| 03 | [react-component](./01-client/03-react-component) | `<PlitziSdk>` inside your own React tree | 4002 |

## [`02-ssr`](./02-ssr) — the server, with `@plitzi/sdk-server`

| | Example | Difference | Port |
|---|---|---|---|
| 01 | [pages](./02-ssr/01-pages) | Server-render a space over HTTP | 4003 |
| 02 | [rsc](./02-ssr/02-rsc) | Per-element server data via React Server Components | 4004 |

## [`03-ai`](./03-ai) — agents, with `@plitzi/sdk-mcp`

| | Example | Difference | Port |
|---|---|---|---|
| 01 | [mcp-server](./03-ai/01-mcp-server) | A dedicated MCP server an agent edits the space through | 4005 |
| 02 | [ssr-preview](./03-ai/02-ssr-preview) | MCP and pages on one port, plus draft preview | 4006 |

Every example renders [`shared-space`](./shared-space), so the difference between any two is the wiring alone.

## Running one

Examples consume the workspace packages as **built output**, so build once from the repo root:

```bash
yarn install
yarn build:dev
yarn workspace @plitzi/plitzi-sdk build-vendor:prod   # only 01-client/01-no-build needs this
```

Then start whichever you want:

```bash
yarn workspace @plitzi/example-ssr-pages start
# or
cd examples/02-ssr/01-pages && yarn start
```

Every example takes `PORT` if the default collides. `yarn start` at the repo root does **not** boot the
examples — it is the package dev loop, and seven extra servers fighting for ports would only get in the way.

## Where to go next

Read the categories in order. `01-client` is three ways to put a space on a page; `02-ssr` moves the render to
the server and gives elements server-resolved data; `03-ai` ends with the topology where an agent\'s unsaved
edits render behind a one-shot preview token.

The packages themselves are documented in [`@plitzi/sdk-server`](../apps/server/README.md) and
[`@plitzi/sdk-mcp`](../apps/mcp/README.md).
