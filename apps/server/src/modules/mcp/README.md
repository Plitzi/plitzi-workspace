# MCP module (`modules/mcp`)

The Model Context Protocol server that lets an AI agent **read and edit a Plitzi space**. It exposes the space
to any MCP client — the standalone MCP role of this server, and the in-process co-worker bridge in
`modules/ai` — through a small set of tools and a browsable catalog of resources.

Genesis and design rationale live in [`docs/rfc/0002-ai-schema-comprehension-and-improvement.md`](../../../../../docs/rfc/0002-ai-schema-comprehension-and-improvement.md).

## Mental model

A Plitzi space is **two independent schemas** edited together:

- **Element schema** — the tree of pages and elements (type, label, props, which style classes they attach).
- **Style schema** — reusable **definitions** (CSS classes), global/id styles, design tokens, theme.

They persist separately, but a single `plitzi_apply` batch may touch **both atomically**. Everything is
addressed by **`idRef`** — the semantic id that is *also* the runtime wiring key (a data source is
`<type>_<idRef>`, an interaction targets an element by its idRef).

The server is **stateless**: every request resolves its own `spaceId` (from the request JWT) and reads the
space fresh through SSR adapters. Public surface (handshake, tool/resource listing, the space-independent guide
and css-properties) works with no auth; a space-dependent tool/resource lazily demands a spaceId. See
[`server.ts`](server.ts).

## Layout

```
mcp/
├── index.ts            # Public surface of the module (re-exports the entry points below)
├── handler.ts          # HTTP glue: read body, drive one stateless request through a built server
├── server.ts           # createMcpServer: registers tools + resources onto an McpServer
├── constants.ts        # Module-wide constants
├── previewClient.ts    # HTTP client to the SSR renderer (plitzi_preview)
├── screenshotClient.ts # HTTP client to the browser service (plitzi_screenshot)
├── mcp.test.ts         # The module's test suite (read/write/validate end-to-end)
│
├── catalogs/           # Reference VOCABULARIES the server validates + advertises against
├── helpers/            # Space access, versioning, the usage guide, interaction (de)serialization
├── resources/          # The read side — the plitzi://… resource catalog
├── tools/              # The write side — validate / apply / search / read / preview / screenshot
└── types/              # AI-facing shapes (aiSchema), tool/preview/screenshot types
```

### `catalogs/` — reference data (not logic)

Static or observed **vocabularies** the server checks input against and advertises to the agent. Grouped here so
it is obvious which files are reference data rather than behavior:

| File | What it is |
|---|---|
| `builtinCallbacks` | built-in `globalCallback` actions → source module + param defaults (mirror of `sdk-interactions` sources) |
| `builtinComponents` | curated metadata for built-in element types |
| `cssCatalog` | valid CSS property keys + shorthand expansion |
| `observed` | interaction actions / data-source paths observed in a space (+ the built-in globalCallbacks) |
| `registry` | the element-type registry (observed types enriched with builtin/plugin metadata) |

> **Catalog vs. translator.** A *catalog* is reference data. A *translator* (in `tools/operations/{schema,style}/translator.ts`)
> is a **read projection** — it converts stored schema/style into the AI-facing shape. Translators stay beside
> their ops; they are not catalogs.

### `resources/` — the read side

The `plitzi://…` catalog the agent browses (`router.ts` dispatches a URI to `core` / `schema` / `style` /
`primer`; `register.ts` declares them on the server; `envelope.ts` wraps `{ stateVersion, data }`). Reads are
cheap by design — list to navigate, read one item for detail.

### `tools/` — the write side

One file per top-level tool (`validate`, `apply`, `search`, `read`, `preview`, `screenshot`), registered from
`tools/index.ts` into the `tools` array. The edit vocabulary lives under `operations/`:

```
tools/
├── index.ts                 # The tool registry (single source both hosts register from)
├── apply/                   # validate → apply → persist atomically (dispatch + write result)
├── shared/
│   ├── tool.ts              # ToolDef descriptor
│   └── validator/           # Batch validation, split by concern (see below)
└── operations/
    ├── index.ts             # The discriminated-union `operation` schema (element ∪ style ops)
    ├── schema/              # Element-schema ops, grouped by domain
    │   ├── shared.ts write.ts operations.ts translator.ts index.ts
    │   ├── elements/  pages/  folders/  variables/  bindings/  interactions/  settings/
    └── style/               # Style-schema ops, grouped by domain
        ├── shared.ts write.ts operations.ts translator.ts index.ts
        └── definitions/  globalStyles/  idStyles/  variables/
```

Each op file exports **its zod schema (`<name>Op`) and its handler (`<name>`)**. `operations.ts` bundles the
schemas into `elementOps` / `styleOps`; the domain `index.ts` re-exports every op file, so `apply/dispatch.ts`
imports the whole domain via the barrel and never needs to know the subfolders.

### `tools/shared/validator/` — split by concern

Input validation was one dense file; it is now a folder whose `index.ts` is the only public entry
(`validateOperations`). Consumers import the folder (`./shared/validator`), so the split is invisible to them.

| File | Responsibility |
|---|---|
| `index.ts` | orchestrator: build the `ValidationCtx`, run the per-op switch, the pageRef guard |
| `context.ts` | `ValidationCtx`, `warnOnce`, `checkObservedName`, `{{name}}`/`var(--…)` ref checks |
| `refs.ts` | `checkRef` / `checkIdRef` (charset + idRef rules) |
| `css.ts` | `checkCss` / `checkSlotCss` (property keys + var refs) |
| `elements.ts` | element-input, type-prop and variant-application checks |
| `batch.ts` | batch pre-scans (names an earlier op in the same batch declares) |

Validation is **lenient by design**: an unrecognized name that could still be valid (a plugin type/action/source)
is a **warning**, never a hard error. Only structurally-wrong input fails the batch.

## Conventions

- **Read-then-write.** Reads follow a filesystem model (list cheap, read one on demand). The guide in
  [`helpers/guide.ts`](helpers/guide.ts) is the agent's manual — keep it in sync with tool behavior.
- **Address by `idRef`.** Charset `[A-Za-z0-9-]`, unique across the space; no dots/underscores (they break the
  `<type>_<idRef>.<field>` grammar). Writing an interaction/binding mints an idRef when one is missing.
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
4. Document it in `helpers/guide.ts` and, for the co-worker, in `modules/ai` system-prompt guidance.
5. Add a test in `mcp.test.ts`.

### … a new resource

Add a resolver branch in the matching `resources/*.ts`, register the URI in `resources/register.ts`, and describe
it in `helpers/guide.ts`.

### … a new catalog

Put it in `catalogs/`, export it from `catalogs/index.ts`, and consume it via `../catalogs` (or `../../catalogs`
from within tools). If it feeds validation, surface it on the `ValidationCtx`.

## Testing

```bash
yarn vitest run src/modules/mcp/mcp.test.ts   # the module suite
yarn typecheck                                 # tsc --noEmit
yarn lint                                      # eslint (must be clean)
```

`mcp.test.ts` exercises the tools end-to-end against in-memory spaces (`buildSpace`, `capturing`, `readResource`,
`apply`, `validate`) — prefer extending it over unit-testing internals, so tests track the public contract.
