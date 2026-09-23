# MCP module (`modules/mcp`)

The Model Context Protocol server that lets an AI agent **read and edit a Plitzi space**. It exposes the space
to any MCP client — the standalone MCP role of this server, and the in-process co-worker bridge in
`modules/ai` — through a small set of tools and a browsable catalog of resources.

What it is for, how an agent connects and what it can rely on: [AI agents and the MCP server](../../../../../docs/en/mcp.md).
This README is how it is built.

## Mental model

A Plitzi space is **two independent schemas** edited together:

- **Element schema** — the tree of pages and elements (type, label, props, which style classes they attach).
- **Style schema** — reusable **definitions** (CSS classes), global/id styles, design tokens, theme.

They persist separately, but a single `plitzi_apply` batch may touch **both atomically**. Everything is
addressed by **`id`** — the ONE name an element answers to, which is also its key in the document and the runtime
wiring key (a data source is `<type>_<id>`, an interaction targets an element by its id).

The server is **stateless**: every request resolves its own `spaceId` (from the request JWT) and reads the
space fresh through SSR adapters. Public surface (handshake, tool/resource listing, the space-independent guide
and css-properties) works with no auth; a space-dependent tool/resource lazily demands a spaceId. See
[`server.ts`](server.ts).

## Layout

```
mcp/
├── index.ts                 # Public surface of the module (re-exports the entry points below)
├── handler.ts               # HTTP glue: read body, drive one stateless request through a built server
├── server.ts                # createMcpServer: registers tools + resources onto an McpServer
├── previewClient.ts         # HTTP client to the SSR renderer (plitzi_preview)
├── screenshotClient.ts      # HTTP client to the browser service (plitzi_screenshot)
├── localScreenshotClient.ts # The same, against a browser this process launches (dev / self-hosted)
│
├── catalogs/                # Reference VOCABULARIES the server validates + advertises against
├── helpers/                 # Space access, versioning, the agent's texts (guide, agentPrompt), URIs, logging
├── resources/               # The read side — the plitzi://… resource catalog
├── tools/                   # The tools — apply / validate / search / read / render / preview / screenshot
├── apps/                    # MCP Apps: one folder per app (definition + view) over a shared bundler/registrar
├── proxy/                   # Signed, per-connection proxy for what a rendered widget fetches (assets, API data)
├── tests/                   # The module suite, one file per domain, against in-memory spaces
├── e2e/                     # A real MCP client over HTTP, and the view rendered in a DOM
└── types/                   # AI-facing shapes (aiSchema), tool/preview/screenshot types
```

### `catalogs/` — reference data (not logic)

The **vocabularies** the server checks input against and advertises to the agent. The built-in ones — callbacks,
utilities, transformers, the CSS catalog, element semantics, the global sources — live in `@plitzi/sdk-authoring`,
the same catalogs the linter checks every save against, and `catalogs/index.ts` re-exports them. What stays here is
what only the MCP derives:

| File            | What it is                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------- |
| `observed`      | interaction actions / data-source paths observed in a space, beside the built-in catalogs    |
| `registry`      | the element-type registry: types the space uses, enriched with built-in and plugin metadata |
| `pluginCatalog` | a space's installed plugins, read from their manifests (a plugin that cannot be read still counts) |

> **Catalog vs. translator.** A _catalog_ is reference data. A _translator_ (in `tools/operations/{schema,style}/translator.ts`)
> is a **read projection** — it converts stored schema/style into the AI-facing shape. Translators stay beside
> their ops; they are not catalogs.

### `resources/` — the read side

The `plitzi://…` catalog the agent browses (`router.ts` dispatches a URI to `core` / `schema` / `style` /
`primer`; `register.ts` declares them on the server; `envelope.ts` wraps `{ stateVersion, data }`). Reads are
cheap by design — list to navigate, read one item for detail.

### `apps/` — the MCP Apps

An **MCP App** is a tool plus a `ui://` page: the tool is registered with `registerAppTool` from
[`@modelcontextprotocol/ext-apps`](https://modelcontextprotocol.io/extensions/apps/build) and linked to the page
through `_meta.ui.resourceUri`. A host that supports the extension fetches that HTML, renders it in a sandboxed
iframe on **its own origin**, and pushes the tool result in; text-only clients just read the tool's JSON summary.

```
apps/
├── index.ts         # The app registry: the `apps` list + registerApps (what server.ts calls)
├── apps.test.ts
├── shared/
│   ├── app.ts       # McpApp + registerApp: bundle the view, inline it in the shell, register the resource
│   └── shell.ejs    # The page shell every app shares (mounts the view on #app)
├── example/         # The reference app: the same shape stripped to the minimum (not in `apps`)
└── render/          # One folder per app
    ├── index.ts     # Its definition: uri, name, title, description, entry, styles — COMPILED
    └── view/        # Its browser side, SHIPPED AS SOURCE (dist gets it verbatim)
        ├── index.tsx    # The entry esbuild bundles at request time
        └── heldBatch.ts # …and every module that entry imports
```

Only `view/` travels as source: nothing in the compiled graph imports it, so a view-side module left outside that
folder builds and tests fine here and is simply **missing from the package** — the host meets it as
`Could not resolve ./x` inside `node_modules`. The rule lives in [`shared/assets.ts`](apps/shared/assets.ts)
(`shipsAsSource`), the build's copy step asks it, and `apps.test.ts` asks it of every real input of every view's
bundle.

[`shared/`](apps/shared/) is the whole machinery (`registerApp.ts`, `bundle.ts`, `page.ts`): it bundles a view with esbuild (dependencies
included), inlines it with its stylesheets into the shell, and registers the result with `registerAppResource`.
The page references nothing — no import map, no asset mounts, no cross-origin fetches — so the strictest host
sandbox can run it and no deployment has to serve anything extra. The cost is its size, and each page is built
once per process and memoized.

**Adding an app**: copy [`example/`](apps/example/) — a view and a definition (`uri`, `name`, `title`,
`description`, `entry`, optional `styles` / `csp`) — then add it to the `apps` list and point a tool at its `uri`
with `ui: { resourceUri }`. The example itself is intentionally not in that list: no tool opens it, so it costs a
deployment nothing, while the test suite builds it so it cannot rot. Its view is the whole client contract in ~60
lines: connect, take the tool result, call a tool back, inherit the host's theme.

The one app today is `plitzi_render`'s: [`render/view/index.tsx`](apps/render/view/index.tsx), a React component on the SDK's
`useApp` / `useHostStyles` hooks that takes the result, pulls `structuredContent.offlineData` out of it and
renders the widget with `<PlitziSdk>` in offline mode. It is a real `.tsx`, typechecked and linted with the rest
of the package, and it mounts on `#app` — the shell's root.

`yarn start` runs this package's dev harness on the sample space: point an MCP Apps host (Claude via a tunnel, or
the `basic-host` example from the ext-apps repo) at `http://localhost:3003/` and call plitzi_render. This server
owns its whole origin, so MCP answers at the root — no `/mcp` path.

### `tools/` — the write side

One file per top-level tool (`apply`, `validate`, `search`, `read`, `render`, `preview`, `screenshot`), registered
from `tools/index.ts` into the `tools` array. Every tool that takes operations runs them through
[`shared/draftBatch.ts`](tools/shared/draftBatch.ts) — expand, validate the input, apply to a copy, lint the copy —
so `plitzi_validate` answers exactly what `plitzi_apply` would, and `plitzi_render` holds a widget to the same rules. The edit vocabulary lives under `operations/`:

```
tools/
├── index.ts                 # The tool registry (single source both hosts register from)
├── apply/                   # validate → apply → persist atomically (dispatch + write result)
├── shared/
│   ├── tool.ts              # ToolDef descriptor
│   ├── draftBatch.ts        # The pipeline every operations-taking tool runs
│   ├── lintDraft.ts         # The result read by sdk-authoring's linter (see below)
│   └── validator/           # Per-op input validation, split by concern (see below)
└── operations/
    ├── index.ts             # The discriminated-union `operation` schema (element ∪ style ops)
    ├── schema/              # Element-schema ops, grouped by domain
    │   ├── shared.ts write.ts operations.ts translator.ts index.ts
    │   ├── elements/  pages/  folders/  variables/  bindings/  interactions/  settings/
    ├── style/               # Style-schema ops, grouped by domain
    │   ├── shared.ts write.ts operations.ts translator.ts index.ts
    │   └── definitions/  globalStyles/  idStyles/  variables/  fonts/
    ├── connectors/          # upsert/patch/deleteConnector — a third store, one row per connector
    └── actions/             # upsert/patch/deleteAction — a fourth, one row per server action
```

Each op file exports **its zod schema (`<name>Op`) and its handler (`<name>`)**. `operations.ts` bundles the
schemas into `elementOps` / `styleOps`; the domain `index.ts` re-exports every op file, so `apply/dispatch.ts`
imports the whole domain via the barrel and never needs to know the subfolders.

### `tools/shared/validator/` — split by concern

Input validation was one dense file; it is now a folder whose `index.ts` is the only public entry
(`validateOperations`). Consumers import the folder (`./shared/validator`), so the split is invisible to them.

| File          | Responsibility                                                                     |
| ------------- | ---------------------------------------------------------------------------------- |
| `index.ts`    | orchestrator: build the `ValidationCtx`, run the per-op switch, the pageRef guard  |
| `context.ts`  | `ValidationCtx`, `warnOnce`, `checkObservedName`, `{{name}}`/`var(--…)` ref checks |
| `refs.ts`     | `checkRef` / `checkIdRef` (charset + element-name rules)                           |
| `css.ts`      | `checkCss` / `checkSlotCss` (property keys + var refs)                             |
| `elements.ts` | element-input, type-prop and variant-application checks                            |
| `bindings.ts` | a binding target a plugin's manifest does not declare                               |
| `interactions.ts` | node type vs action, and each step's params against its callback's declaration |
| `connectors.ts` | a connector manifest, through the engine's own validator                          |
| `batch.ts`    | batch pre-scans (names an earlier op in the same batch declares)                   |

Two stages, two policies. The **validator** reads the operations and is lenient: a name that could still be valid
(a plugin type, action or source it has not seen) is a **warning**. **`lintDraft`** then reads the *result* with
`lintSpace` — the linter the builder, `authorSpace` and the server's save all run — and is not: a new structural
error anywhere blocks the batch, and so does any error in an element the batch touches, including one that was
already there (reported as `Pre-existing malformation in element …`, so the agent fixes it in the same batch).

## Conventions

- **Read-then-write.** Reads follow a filesystem model (list cheap, read one on demand). The guide in
  [`helpers/guide.ts`](helpers/guide.ts) is the agent's manual — keep it in sync with tool behavior.
- **Address by `id`.** Charset `[A-Za-z0-9_-]` starting with a letter, unique across the space; no dots (a dot
  splits the `<type>_<id>.<field>` grammar). Underscores are allowed — the FIRST `_` separates `<type>` from
  `<id>` and element types have none, so extra underscores are unambiguous. There is nothing to mint: an element
  cannot exist without the name you gave it.
- **`upsert` replaces, `patch` merges.** Upsert ops fully replace props/CSS; patch ops merge (a `null` value
  unsets a key). Mirror this in any new op pair.
- **Atomic + optimistic concurrency.** `plitzi_apply` persists nothing if any op fails; callers pass
  `expectedResourceVersions` and get a conflict if the live data drifted.
- **Catalogs are observed, not declared.** SSR has no plugin manifest, so unseen ≠ invalid → warn. The built-in
  catalogs (`builtinComponents`, `builtinCallbacks`) are the exception: hand-maintained mirrors of the SDK, so a
  change to the `sdk-interactions` sources or built-in types must be mirrored here.
- **Code style** follows the repo standard: TS strict, no `any`/casts without reason, `import type`, alphabetized
  import groups, blank line after `if` blocks and before `return`. Comments explain **why**, never what.

## How to add …

### … a new write operation

1. Create `tools/operations/<schema|style>/<domain>/<name>.ts` exporting `<name>Op` (zod schema, with
   `.describe()` on the op and its fields — the descriptions are the agent's API docs) and `<name>` (handler
   returning an `OpResult`).
2. Register it: add to `operations.ts` (`elementOps`/`styleOps`), the domain `index.ts` (`export *`), and the
   handler dispatch in `tools/apply/dispatch.ts` if it is not picked up by the `* as schema/style` barrel.
3. If it needs validation beyond parsing, add a `case` in `tools/shared/validator/index.ts`.
4. Document it in `helpers/guide.ts` — [`tests/guide.test.ts`](tests/guide.test.ts) fails until the guide names it.
5. Add a test in the `tests/` file for its domain.

### … a new resource

Add a resolver branch in the matching `resources/*.ts`, register the URI in `resources/register.ts` (a resource the
router serves but nobody registered is one no agent can discover), and describe it in `helpers/guide.ts` —
`tests/guide.test.ts` checks every registered URI is there.

### … a new catalog

A vocabulary the linter also needs belongs in `@plitzi/sdk-authoring` — re-export it from `catalogs/index.ts`. Only
what the MCP alone derives goes in `catalogs/`. If it feeds validation, surface it on the `ValidationCtx`; if the
agent should know it, generate that part of the guide from it rather than writing it out (see `GLOBALS` in
`helpers/guide.ts`).

## Testing

```bash
yarn vitest run src/modules/mcp   # the module suite
yarn typecheck                    # tsc --noEmit
yarn lint                         # eslint (must be clean)
```

`tests/` exercises the tools end-to-end against in-memory spaces (the helpers in `tests/helpers.ts`) — prefer
extending the file for the domain over unit-testing internals, so tests track the public contract. `e2e/` drives the
server through a real MCP client.
