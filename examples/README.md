# Examples

Runnable Plitzi setups, smallest first. Each one is a real workspace package you can start and hit — no
pseudo-code, no snippets that assume a step not shown.

| | Example | What it shows | Port |
|---|---|---|---|
| 00 | [render-no-build](./00-render-no-build) | A space rendered from plain HTML — no bundler, no build step | 4000 |
| 01 | [render-offline](./01-render-offline) | The same call from a bundled app, with `render()` owning the page | 4001 |
| 02 | [react-component](./02-react-component) | `<PlitziSdk>` inside your own React tree, beside your components | 4002 |
| 03 | [ssr-pages](./03-ssr-pages) | Server-rendering that space over HTTP | 4003 |
| 04 | [ssr-rsc](./04-ssr-rsc) | Per-element server data via React Server Components | 4004 |
| 05 | [mcp-server](./05-mcp-server) | An MCP server an agent reads and edits the space through | 4005 |
| 06 | [ssr-mcp-preview](./06-ssr-mcp-preview) | Pages + MCP + draft preview on one port | 4006 |

They all render [`shared-space`](./shared-space), so the difference between any two examples is the wiring
alone.

## Running one

Examples consume the workspace packages as **built output**, so build once from the repo root:

```bash
yarn install
yarn build:dev
yarn workspace @plitzi/plitzi-sdk build-vendor:prod   # only example 00 needs this
```

Then start whichever you want:

```bash
yarn workspace @plitzi/example-ssr-pages start
# or
cd examples/03-ssr-pages && yarn start
```

Every example takes `PORT` if the default collides. `yarn start` at the repo root does **not** boot the
examples — it is the package dev loop, and seven extra servers fighting for ports would only get in the way.

## Where to go next

Read them in order. 00 → 02 are three ways to put a space on a page, from a bare HTML file to a component in
your own tree. 03 → 04 move the render to the server and give elements server-resolved data. 05 → 06 cover the
AI surface, ending with the topology where an agent's unsaved edits render behind a one-shot preview token.

The packages themselves are documented in [`@plitzi/sdk-server`](../apps/server/README.md) and
[`@plitzi/sdk-mcp`](../apps/mcp/README.md).
