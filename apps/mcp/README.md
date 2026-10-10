# @plitzi/sdk-mcp

The AI surface for Plitzi spaces: an [MCP](https://modelcontextprotocol.io) server that lets an agent read and
edit a space, the tool engine behind it, the widget renderer, and the draft-preview endpoint.

Connecting an agent and what it can do once connected: [AI agents and the MCP server](../../docs/en/mcp.md).

It depends on [`@plitzi/sdk-server`](../server/README.md), never the other way round: that package serves pages,
this one serves agents. It imports only that package's narrow entries — the HTTP kernel (`/kernel`, the dispatcher
and the transports), OAuth (`/oauth`) and, for draft preview alone, the renderer (`/ssr`) — so a page-only
deployment installs none of this and a dedicated MCP server loads no page renderer.

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
  adapters: { getGrant, getSchema, getStyle, saveSchema, saveStyle }
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
| `getGrant(req)` | yes | The space this request operates on **and whether the caller may change it** (`{ spaceId, scope, userId?, canWrite }`), decoded from the verified `Authorization` bearer. You own the JWT secret and the authorization model, so both are decided on your side. Return `undefined` for a missing or invalid token. |
| `getSchema(spaceId, env)` | yes | The element schema the tools read and mutate. |
| `getStyle(spaceId, env)` | yes | The full style document, including `platform`/`mode`. |
| `saveSchema(spaceId, env, schema)` | for writes | Persist a mutated schema. Without it, `plitzi_apply` reports `persisted: false` and leads its warnings with what was NOT saved. |
| `saveStyle(spaceId, env, style)` | for writes | Persist a mutated style document. |
| `getChanges(spaceId, env, query)` | no | The space's change history, for the `plitzi://changes` resources. Writes arrive with an `SSRWriteContext` (`userId`, one `batch` per tool call) so a consumer can record them. |
| `getOfflineData(spaceId, env, rev)` | for preview | Read side of draft-preview. Only the preview endpoint calls it. |
| `getComponentCatalog(spaceId, env)` | no | The element types the space's plugins add, for the catalog resources. |
| `getConnectors` / `saveConnector` / `deleteConnector` | for connectors | The space's connector manifests, read and written by the connector operations. |
| `getActions` / `getActionTasks` / `saveAction` / `deleteAction` | for actions | The space's server actions, and the catalog of tasks a step may run — the deployment's, the space's own functions and its plugins' server halves, each with its `origin` (`deployment`, `space` or `plugin`). |
| `getFunctions` / `saveFunctions` / `tryFunction` | for functions | The space's functions: read for `plitzi://functions/{env}`, saved (built and checked, refused from an older copy) by `upsertFunctionFile` / `deleteFunctionFile`, and run by `plitzi_try_function`. |
| `getData` / `saveData` | for data | The space's data — JSON its server providers read as `/data/<file>`: read for `plitzi://data/{env}`, saved whole (each file checked, refused from an older copy) by `upsertDataFile` / `deleteDataFile`. |

Schema and style are read as **separate documents** on purpose: `getOfflineData` is SSR-shaped and strips
`style.platform`, which the style resources need.

`createJsonAdapters({ offlineData })` from `@plitzi/sdk-server` offers `getSchema` and `getStyle` over a
`{ schema, style }` JSON and — when given a path — `saveSchema` and `saveStyle`, each writing its document back into
the file, so an MCP can run over it with a `getGrant` of yours beside it. It comes from the package root, which loads
the page server too; a dedicated MCP that keeps its weight down writes those four itself, as
[self-hosting/06](../../examples/self-hosting/06-mcp-server) does.

Without a `getGrant` that resolves, the server still answers its public surface — the handshake, the tool list,
the guide, the CSS-property catalog — and asks for a space only when a tool or resource needs one. A grant that
resolves with `canWrite: false` reads everything and is refused at every write tool.

## Options

What MCP itself serves is `McpOptions` (`src/options.ts`), the **second** argument — to `createServer` here, and to
`mcpExtensions(options)` for a page server — never a section of the server config, which a page-only deployment
types its renderer with.

| Option | Default | Purpose |
|---|---|---|
| `path` | `/mcp` | Where MCP answers inside a server that also serves pages. A dedicated MCP server owns its whole origin and ignores it. |
| `renderStreaming` | `true` | Whether the `plitzi_render` view paints from the tool arguments while the host still streams them. `false` keeps the view blank until the finished widget arrives. |
| `proxy` | off | `McpProxyOptions`: with a `secret`, every external URL a render authored is rewritten to this server's signed endpoint (`path`, default `/__proxy`) and fetched here — the origins a widget needs cannot be declared ahead. `baseUrl`, `maxBytes` (8 MiB), `ttl` (7 days), `tools` (`['plitzi_render']`), `enabled`. |
| `previewClient` | off | `{ url, secret? }`: the SSR `/preview` endpoint, for an MCP server that runs apart from the renderer. Without it `plitzi_look` and `plitzi_apply`'s `look` report `PREVIEW_UNAVAILABLE`. |
| `screenshot` | off | `{ serviceUrl, renderBaseUrl }`: the browser service a look renders an image or an accessibility outline through, and the SSR base it navigates to. Without it a look answers the HTML, and says so. |
| `oauth` | off | OAuth 2.1 for remote connectors — see [OAuth](#oauth). |

```ts
createServer({ adapters }, { screenshot: { serviceUrl, renderBaseUrl }, proxy: { secret } });
```

## Tools

| Tool | Access | What it does |
|---|---|---|
| `plitzi_search` | read | Find elements, pages, styles and bindings; returns ready-made URIs |
| `plitzi_read` | read | Read one or more resources in detail by URI |
| `plitzi_apply` | write | Apply a batch of operations and persist; answers with its `effects` — every change it made, read off the space before and after — and its suggestions. `dryRun` checks it without saving, and `look` renders the page as the batch leaves it (HTML, a PNG or the accessibility outline) |
| `plitzi_set_attributes`, `plitzi_set_classes`, `plitzi_bind_attribute`, `plitzi_place_component`, `plitzi_add_page` | write | One change by its intention — an element's attributes, classes added or removed, a binding, a component placed, a page — by the element's ref alone, saved as `plitzi_apply` saves it, answered with its `effects`, whether it was `saved`, and what was already so |
| `plitzi_describe_operation` | read | One operation's schema by its type, or the list of every type |
| `plitzi_look` | read | See a saved page: its accessibility outline (default), its HTML, or a PNG (desktop, mobile or both) |
| `plitzi_render` | read | Render a self-contained UI widget, offline, with no space |
| `plitzi_try_function` | write | Run one task of the space's functions against the draft, in the sandbox: its value, logs and error |

The server advertises each tool's access as its `readOnlyHint` annotation, so a host can run a read without asking
and ask before a write.

Reads follow a filesystem model: list cheap, read one item in detail on demand. Agents are told never to
hand-build a URI — every write and search response hands back the URI to use next.

The tool functions are exported directly (`apply`, `search`, `read`, `validate`, `tools`), so a consumer can run
them in-process instead of speaking MCP over HTTP.

### A project's own agent drawing widgets

`plitzi_render` hands its widget to a host that draws `ui://` resources — claude.ai, Desktop. An agent working for a
project (a voice assistant, a terminal session) draws in the project's own page instead, so the render comes apart:

```ts
import { render, renderGuideText, renderWidgetShape } from '@plitzi/sdk-mcp/render';

// A tool of the project's own MCP server, its input `renderWidgetShape`, its guide `renderGuideText`.
const answer = render({ operations }, { base: space.style }); // the project's authored space
if (answer.rendered) {
  publish(answer.offlineData); // what a `plitziSdk` element is bound to (`offlineData`)
}
```

`base` is the style of the space that shows the widget: its tokens in both themes, its classes and its fonts come
with it, so the widget looks like the page around it. Left out, the widget starts from nothing, as one in a chat does.

## Draft preview

The two halves live in different packages, joined by a one-shot token:

1. `previewStage` (this package) runs **inside an SSR server**, because rendering needs that server's singletons.
   It applies unsaved operations to a clone, renders the result, and stashes the draft under a token.
2. A normal render carrying `?__pt=<token>` (handled by `@plitzi/sdk-server`) serves that draft instead of the
   persisted state, exactly once.

That is why applying operations lives here and the render lives there: interpreting an operation is the tool
engine's job, not the renderer's.

## OAuth

Opt-in and inert unless configured. With `oauth` set (an [option](#options), not part of the server config), an unauthenticated JSON-RPC call gets a `401` plus a
`WWW-Authenticate` challenge pointing at the discovery document — which is what makes a host such as Claude
Desktop start the flow. Without it, the server stays anonymous, discovery answers `404`, and every caller reaches
the public surface.

```ts
createServer({ adapters }, { oauth: { adapters: oauthAdapters, issuer, guest: { target: widgetsOnlyTarget } } });
```

Publish the connector URL **with a path** (`https://host/mcp`), not the bare origin.

## Agent skill

This package ships an [Agent Skill](https://agentskills.io/) for `plitzi_render`. It teaches an agent when to show
a widget instead of writing prose, the shape of a good call, the layout and theme traps that make a widget look
wrong in a chat panel, and how to iterate on one it already rendered.

It lives in [`skills/plitzi-render`](./skills/plitzi-render/SKILL.md): a short `SKILL.md` an agent reads every time,
and a `reference/` it opens when the task names one. It installs by copying that folder into your agent's skills directory (Claude Code, VS Code / Copilot, Codex, Gemini CLI, Cline,
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

Runnable setups live in [`examples/`](../../examples) — [self-hosting/06](../../examples/self-hosting/06-mcp-server) is a dedicated
MCP server, [self-hosting/07](../../examples/self-hosting/07-ssr-preview) is the combined topology with draft preview. Each starts with
`yarn start`.

## Entry points

| Import | Carries |
|---|---|
| `@plitzi/sdk-mcp/server` | The dedicated MCP server and its clients. What an MCP deployment wires. |
| `@plitzi/sdk-mcp` | Everything above plus the pipeline stages, `createPreview` and the tool engine. |
| `@plitzi/sdk-mcp/render` | `plitzi_render`'s widget render alone — no MCP server, no SSR, no OAuth — for a project's own agent. |

The split is about weight, not taste: ESM re-exports load eagerly, so the barrel pulls the draft-preview path and
the renderer it reaches into. A `no-restricted-imports` rule and a test in `src/packageBoundary.test.ts` keep this
package off the `@plitzi/sdk-server` root barrel for the same reason.
