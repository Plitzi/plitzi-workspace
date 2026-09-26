# AI agents and the MCP server

A practical guide to letting an AI agent — Claude, or any client that speaks the
[Model Context Protocol](https://modelcontextprotocol.io) — **read and edit a Plitzi space**, and to what it can and
cannot do once it is connected.

The server is [`@plitzi/sdk-mcp`](../../apps/mcp/README.md). Embedding it (adapters, topologies, OAuth wiring) is in
that README; how it is built inside is in [its module README](../../apps/mcp/src/modules/mcp/README.md). This page is
about using it.

---

## 1. What an agent gets

Two things, depending on what the connection was granted:

- **A space.** The agent reads the space — pages, elements, styles, bindings, interactions, connectors, server
  actions — finds what it is asked about, and edits it in batches the server validates and saves. It sees the result
  as HTML or as a screenshot before or after committing.
- **Widgets only.** No space at all: the agent can still **show** the user a real rendered UI — a card, a pricing
  table, a checklist — built offline with `plitzi_render`. Nothing is read or stored anywhere.

A connection with a space can do both.

## 2. Connecting an agent

### Claude (desktop or claude.ai)

Add a custom connector pointing at the MCP host **with a path**, e.g. `https://mcp.example.com/mcp`. The server
answers on every path, but Claude only completes its sign-in against a URL that has one.

Claude then opens the sign-in page. After logging in, the consent screen lists the spaces the account can reach;
picking one grants that space, and picking **Widgets only** grants none. **Continue without an account** (when the
deployment enables guests) is a widgets-only connection too.

What the agent may change follows the account: a member who can only view a space gets a connection that reads it
and is refused at every write.

### Other MCP clients

A client that can send headers skips OAuth: pass a space token as `Authorization: Bearer <token>` (or
`x-access-token`). Without one, the server still answers the handshake, the tool list, the guide and the CSS
catalog, and asks for a space only when a tool needs it.

### Locally

`yarn start` in `apps/mcp` serves the tools on `http://localhost:3003/` against a sample space on disk — point the
MCP Inspector (`yarn inspector`) or any client at it. Writes land in `apps/mcp/dev/sample`; `git restore` resets it.

## 3. How an agent works a space

The server is designed so the agent pays only for what it touches. A 5 000-element space is worked in the same few
calls as a small one:

1. **`plitzi://primer/{env}`** — one read that carries a quickstart of the guide, the element types, the CSS
   vocabulary and summaries of pages, styles and variables. On a large space a section may arrive as a pointer to its
   own resource instead of its contents.
2. **`plitzi_search`** — finds elements by label, type or attribute, and each hit already carries what an edit needs
   (its URI, its version, and with `include: "detail"` its props and resolved CSS).
3. **`plitzi_validate`** or **`plitzi_apply` with `dryRun`** — checks a batch without saving.
4. **`plitzi_screenshot`** — renders the page with the unsaved batch applied, desktop and mobile.
5. **`plitzi_apply`** — saves.

| Tool | What it is for |
|---|---|
| `plitzi_search` | Find elements, pages and style classes; returns the names every edit takes |
| `plitzi_read` | Read several resources at once by URI |
| `plitzi_validate` | Check a batch of operations without saving |
| `plitzi_apply` | Apply and save a batch — all of it or none of it |
| `plitzi_preview` | Render a page to HTML, optionally with an unsaved batch |
| `plitzi_screenshot` | Render a page to an image, optionally with an unsaved batch |
| `plitzi_render` | Show the user an offline widget; never touches the space |

The resources (`plitzi://…`) are the catalog the agent browses: pages and layouts, element types, style classes,
tokens, fonts, variables, settings, the interaction and data-source vocabularies, connectors and server actions. The
full list, with what each one answers, is the agent's manual at `plitzi://guide`.

`plitzi_preview` and `plitzi_screenshot` need the deployment's SSR render service (and the screenshot service for
images); where they are missing, the tools say so instead of failing silently.

## 4. What the server guarantees

- **Every batch is atomic.** If any operation in it fails, nothing is saved.
- **Concurrent edits are not lost.** Every read hands back a version; a batch that names the versions it read is
  refused if someone — a person in the builder, or another agent — changed those resources in between.
- **An agent is held to the same rules as the builder.** A save runs the same linter every writer of a space runs.
  Anything an edit would break is refused, and so is a problem already present in an element the batch touches, so an
  agent cannot build on top of it. It fixes the problem in the same batch; the refusal says exactly what to change.
- **Secrets never reach the agent.** It writes [connector](./connectors.md) manifests and
  [server actions](./server-actions.md) that *name* a credential; the space owner attaches the secret in the builder.
  An integration an agent builds saves without one and works once the owner adds it.
- **Names are ids.** The agent names every element it creates, and that name is the element's id and its wiring key.
  Renaming one repoints every binding and interaction that referred to it.

## 5. What the agent is told

Everything an agent knows about Plitzi comes from text this package serves, so that text is part of the product:

| Text | Where | When the agent reads it |
|---|---|---|
| Server instructions | `helpers/guide.ts` → `serverInstructions` | In the handshake, before anything else |
| Quickstart | `helpers/guide.ts` → `guideQuickstart` | Inside the primer, on cold start |
| The guide | `helpers/guide.ts` → `guideText` (`plitzi://guide`) | On demand, the full reference |
| Operation and field descriptions | the `.describe()` on each op's zod schema | In every tool's input schema |
| Co-worker prompt block | `helpers/agentPrompt.ts` | Concatenated into the builder co-worker's system prompt |
| Widget guide | `resources/renderGuide.ts` (`plitzi://render/guide`) and `skills/plitzi-render` | Before a `plitzi_render` call |

Whatever can be generated is: the interaction callbacks and their params, the global binding sources and the
transformer names all come from `@plitzi/sdk-authoring`, the same catalogs the linter checks a save against.
`tests/guide.test.ts` fails when an operation, a registered resource or a global source is missing from the guide —
so a new operation or resource is not finished until the guide explains it.

## 6. Deliberately left open

- **Quality beyond validity.** The linter guarantees a space is well-formed and wired; it does not judge it. There is
  no check yet for accessibility (image `alt`, heading order, contrast) or for hardcoded values where a design token
  exists, so "make this page better" rests on the agent's judgement and the screenshot.
- **Intent.** Nothing tells the agent what a page is *for* — its audience or goal — beyond what the user says in the
  conversation.
- **Evals.** There is no golden corpus of spaces and edits that measures whether an agent's change improves a page
  without regressing it. Tests pin the contract of every tool, not the quality of what an agent does with them.
- **Built-in types a space has not used yet.** `plitzi://types` describes the types a space already uses plus those
  its plugins declare. The full built-in catalog is in `plitzi://render/types`.
