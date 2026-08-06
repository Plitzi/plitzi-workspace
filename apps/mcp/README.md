# @plitzi/sdk-mcp

The AI surface for Plitzi spaces: an [MCP](https://modelcontextprotocol.io) server that lets an agent read and
edit a space, the tool engine behind it, the widget renderer, and the draft-preview endpoint.

It is a sibling of [`@plitzi/sdk-server`](../server/README.md), not a layer on top of it. That package serves
pages; this one serves agents. They share only the HTTP kernel, which this package imports from
`@plitzi/sdk-server/kernel` — a narrow entry that carries the dispatcher and the transports and nothing else, so
a page-only deployment installs none of this and an MCP deployment loads no page renderer.

## Installation

```bash
yarn add @plitzi/sdk-mcp
```

## Two topologies

### Dedicated MCP server

The shape a real MCP deployment has: it owns its whole sub-domain and answers JSON-RPC on **every** path, not
under `/mcp`.

```ts
import { createServer } from '@plitzi/sdk-mcp/server';

const server = createServer({
  httpVersion: 1,
  adapters: { getSpaceId, getSchema, getStyle, saveSchema, saveStyle }
});

server.listen(8891);
```

Import from `@plitzi/sdk-mcp/server`, not the package root. The root barrel also carries the draft-preview
endpoint, which reaches into the SSR renderer; a dedicated MCP process constructs none of that.

### Alongside pages, on one port

Hand the stages to a page server. Order is the page pipeline's invariant, so they travel by slot rather than as a
list — see [Extending the pipeline](../server/README.md#extending-the-pipeline):

```ts
import { createServer } from '@plitzi/sdk-server';
import { mcpExtensions } from '@plitzi/sdk-mcp';

const server = createServer({ adapters }, mcpExtensions());
```

`mcpExtensions()` contributes three stages, all in the `preAuth` slot because each gates itself: the MCP endpoint
under `/mcp` (self-authenticating), the widget proxy (must stay reachable without a credential), and
draft-preview (off unless `preview.enabled`, then guarded by a shared secret). Import them individually when you
want only some:

```ts
import { previewStage } from '@plitzi/sdk-mcp';

const server = createServer({ adapters, preview: { enabled: true, secret } }, { preAuth: [previewStage] });
```

## Adapters

The server is stateless: it resolves the space per request and reads and writes through adapters you supply.

| Adapter | Required | Purpose |
|---|---|---|
| `getSpaceId(req)` | yes | The space this request operates on, decoded from the verified `Authorization` bearer. You own the JWT secret, so it is decoded on your side. |
| `getSchema(spaceId, env)` | yes | The element schema the tools read and mutate. |
| `getStyle(spaceId, env)` | yes | The full style document, including `platform`/`mode`. |
| `saveSchema(spaceId, env, schema)` | for writes | Persist a mutated schema. Without it, `plitzi_apply` reports `persisted: false`. |
| `saveStyle(spaceId, env, style)` | for writes | Persist a mutated style document. |
| `getOfflineData(spaceId, env, rev)` | for preview | Read side of draft-preview. Only the preview endpoint calls it. |

Schema and style are read as **separate documents** on purpose: `getOfflineData` is SSR-shaped and strips
`style.platform`, which the style resources need.

Without a `getSpaceId` that resolves, the server still answers its public surface — the handshake, the tool list,
the guide, the CSS-property catalog — and asks for a space only when a tool or resource needs one.

## Tools

| Tool | Access | What it does |
|---|---|---|
| `plitzi_search` | read | Find elements, pages, styles and bindings; returns ready-made URIs |
| `plitzi_read` | read | Read one or more resources in detail by URI |
| `plitzi_validate` | read | Dry-run a batch of operations and report what would fail |
| `plitzi_apply` | write | Apply a batch of operations and persist |
| `plitzi_preview` | read | Render a draft to HTML through an SSR server |
| `plitzi_render` | read | Render a self-contained UI widget, offline, with no space |

Reads follow a filesystem model: list cheap, read one item in detail on demand. Agents are told never to
hand-build a URI — every write and search response hands back the URI to use next.

The tool functions are exported directly (`apply`, `search`, `read`, `validate`, `tools`), so a consumer can run
them in-process and wrap them as its own agent's tools instead of speaking MCP over HTTP.

## Draft preview

The two halves live in different packages, joined by a one-shot token:

1. `previewStage` (this package) runs **inside an SSR server**, because rendering needs that server's singletons.
   It applies unsaved operations to a clone, renders the result, and stashes the draft under a token.
2. A normal render carrying `?__pt=<token>` (handled by `@plitzi/sdk-server`) serves that draft instead of the
   persisted state, exactly once.

That is why applying operations lives here and the render lives there: interpreting an operation is the tool
engine's job, not the renderer's.

## OAuth

Opt-in and inert unless configured. With `oauth` set, an unauthenticated JSON-RPC call gets a `401` plus a
`WWW-Authenticate` challenge pointing at the discovery document — which is what makes a host such as Claude
Desktop start the flow. Without it, the server stays anonymous, discovery answers `404`, and every caller reaches
the public surface.

```ts
createServer({
  adapters,
  oauth: { adapters: oauthAdapters, issuer, guest: { target: widgetsOnlyTarget } }
});
```

Publish the connector URL **with a path** (`https://host/mcp`), not the bare origin.

## Agent skill

This package ships an [Agent Skill](https://agentskills.io/) for `plitzi_render`. It teaches an agent when to show
a widget instead of writing prose, the shape of a good call, the layout and theme traps that make a widget look
wrong in a chat panel, and how to iterate on one it already rendered.

It lives in [`skills/plitzi-render`](./skills/plitzi-render/SKILL.md) as a plain `SKILL.md`, so it installs by
copying that folder into your agent's skills directory (Claude Code, VS Code / Copilot, Codex, Gemini CLI, Cline,
Goose…):

```bash
cp -R node_modules/@plitzi/sdk-mcp/skills/plitzi-render ~/.claude/skills/
```

It only pays off with this server connected: it defers every detail to the `plitzi://render/guide` resource the
server publishes, so the two never drift apart.

## Running it locally

The package ships a small harness in [`dev/`](./dev) — file-backed adapters over a sample space — so you can
drive the tools without standing up a platform:

```bash
yarn start        # MCP on :3003 against dev/sample
yarn start:dev    # same, restarting on change
yarn inspector    # the official MCP Inspector, to point at it
```

`MCP_PORT` and `MCP_HOST` move it; `LOG_REQUESTS=0` quiets the request log. Writes land back in `dev/sample`, so
`git restore dev/sample` resets a session.

`dev/` is not part of the published package and nothing in `src/` imports it — it consumes this package's public
API exactly as a consumer would.

## Examples

Runnable setups live in [`examples/`](../../examples) — [03-ai/01](../../examples/03-ai/01-mcp-server) is a dedicated MCP
server, [03-ai/02](../../examples/03-ai/02-ssr-preview) is the combined topology with draft preview. Each starts with
`yarn start`.

## Entry points

| Import | Carries |
|---|---|
| `@plitzi/sdk-mcp/server` | The dedicated MCP server and its clients. What an MCP deployment wires. |
| `@plitzi/sdk-mcp` | Everything above plus the pipeline stages, `createPreview`, the tool engine and the AI engine. |

The split is about weight, not taste: ESM re-exports load eagerly, so the barrel pulls the draft-preview path and
the renderer it reaches into. A `no-restricted-imports` rule and a test in `src/packageBoundary.test.ts` keep this
package off the `@plitzi/sdk-server` root barrel for the same reason.
