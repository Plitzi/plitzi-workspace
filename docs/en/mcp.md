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

- **A space.** The agent reads the space — pages, elements, styles, bindings, interactions, feature flags,
  connectors, server actions — finds what it is asked about, and edits it in batches the server validates and saves. It sees the result
  as HTML or as a screenshot before or after committing.
- **Widgets only.** No space at all: the agent can still **show** the user a real rendered UI — a card, a pricing
  table, a checklist — built offline with `plitzi_render`. Nothing is read or stored anywhere.

A connection with a space can do both.

**The MCP or the CLI.** The MCP edits a space that lives on Plitzi — the one the builder, collaborators and publishing
work on — and needs a signed-in account. A space that lives in code (`plitzi create --source local`) is written with
`@plitzi/sdk-authoring` and the CLI, with no account and no MCP; `plitzi create --from <space>` turns the first into
the second. The skills an agent is given say the same, so an MCP waiting for a sign-in never blocks a project in code.

## 2. Connecting an agent

### Claude (desktop or claude.ai)

Add a custom connector pointing at the MCP host **with a path**, e.g. `https://mcp.example.com/mcp`. The server
answers on every path, but Claude only completes its sign-in against a URL that has one.

Claude then opens the sign-in page. After logging in, the consent screen lists the spaces the account can reach;
picking one grants that space, and picking **Widgets only** grants none. **Continue without an account** (when the
deployment enables guests) is a widgets-only connection too.

What the agent may change follows the account: a member who can only view a space gets a connection that reads it
and is refused at every write.

### Claude Code, OpenCode and other terminal agents

Add the server once, for every folder:

```bash
claude mcp add --transport http --scope user plitzi https://mcp.example.com/mcp
opencode mcp add plitzi --url https://mcp.example.com/mcp
```

`--scope user` matters: Claude Code's default scope is the folder the command ran in, so a server added without it
is missing everywhere else ("Claude says it has no Plitzi tools"). `claude mcp list` shows whether it is connected.
Sign in from `/mcp` inside Claude Code. It opens the same sign-in and consent screen the Claude app shows. A session
started before the server was added does not see it; start a new one.

### Claude in Chrome

Claude in Chrome needs no connector. It works the builder, or any published page, as the person who has it open,
through the page's accessibility tree. It is the right tool for using a space. It is not the tool for editing one:
the MCP server edits the space as a document, and the builder is a canvas of drag and drop an agent would fight.
What makes a page easy for Claude in Chrome (names on every control, clicks on buttons and links, state that is
announced) is in [Accessibility and browser agents](./accessibility.md).

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
3. **`plitzi_apply` with `dryRun`** — checks a batch without saving (and, with `look`, renders the page as it would
   leave it — HTML, an image or the accessibility outline — in the same call), and answers with
   **suggestions**: a shorter way to what the batch wrote — a header copied onto a third page that a layout would
   hold once, a `text` inside a button that is the button's own `content` — each with the elements it saves. Only what
   the batch opened up is said, and none of them blocks the save.
4. **`plitzi_apply`** without `dryRun` — saves the same batch. A change one intention says whole — an element's
   attributes, its classes, a binding, a component placed, a page — has a tool of its own that writes the batch.

| Tool | What it is for |
|---|---|
| `plitzi_search` | Find elements, pages and style classes; returns the names every edit takes |
| `plitzi_read` | Read several resources at once by URI |
| `plitzi_apply` | Apply and save a batch — all of it or none of it; answers with its `effects` (every change it made, read off the space before and after — a batch that changed nothing, or a store with nothing to save it in, is said first) and its suggestions. `dryRun` checks it without saving, `look` renders the page as the batch leaves it |
| `plitzi_set_attributes`, `plitzi_set_classes`, `plitzi_bind_attribute`, `plitzi_place_component`, `plitzi_add_page` | One change by its intention, the element named by its ref alone, saved as `plitzi_apply` saves it and answered with its `effects`, whether it was `saved`, and what was already so; classes are added or removed, the rest kept. A class it does not wear cannot be taken off, nor a value written under a binding |
| `plitzi_describe_operation` | One operation's schema by its type, or every type there is. A field an operation does not have is refused naming the one meant; the same batch refused twice is not run again (`REPEATED_BATCH`) |
| `plitzi_look` | See a saved page: its accessibility outline (default), its HTML, or an image |
| `plitzi_render` | Show the user an offline widget; never touches the space |
| `plitzi_try_function` | Run one task of the space's [functions](./functions.md) against the draft, in the sandbox: its value, logs and error |

Every tool that only reads is marked `readOnlyHint` (from its `access`), so a host can run it without asking and ask
before the ones that change something — `plitzi_apply`, the intent tools and `plitzi_try_function`.

The resources (`plitzi://…`) are the catalog the agent browses: pages, layouts and components, element types, style classes,
tokens, fonts, variables, [feature flags](./feature-flags.md) (`plitzi://flags/{env}`, written with `upsertFlag` /
`deleteFlag` and gated with `flag` on an element or a page), settings, the interaction and data-source vocabularies,
connectors, server actions, the space's functions (written with the `upsertFunctionFile` / `deleteFunctionFile`
operations of `plitzi_apply`) and its data (`plitzi://data/{env}`: the JSON its server providers read as
`/data/<file>`, written with `upsertDataFile` / `deleteDataFile`). The
full list, with what each one answers, is the agent's manual at `plitzi://guide`.

A look — `plitzi_look`, or `plitzi_apply`'s `look` — needs the deployment's SSR render service (and the screenshot
service for an image or an outline); where they are missing, it says so instead of failing silently.

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
- **The agent is told what is public.** Every document of a space and every file on its public buckets reaches anyone
  who opens it, so the guide sends a secret to a credential and data for some visitors only to a server-rendered
  provider or an action that checks who asks — never into a page, a variable or a public file.
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
| Widget guide | `resources/renderGuide.ts` (`plitzi://render/guide`) and `skills/plitzi-render` | Before a `plitzi_render` call |

Whatever can be generated is: the interaction callbacks and their params, the global binding sources and the
transformer names all come from `@plitzi/sdk-authoring`, the same catalogs the linter checks a save against.
`tests/guide.test.ts` fails when an operation, a registered resource or a global source is missing from the guide —
so a new operation or resource is not finished until the guide explains it.

## 6. Deliberately left open

- **Quality beyond validity.** The linter guarantees a space is well-formed and wired, and warns about what makes a
  page unusable without sight: controls with no name, pictures with no `alt`, clicks on things that are not
  controls, headings that skip a level ([Accessibility](./accessibility.md)). The suggestions judge one thing more —
  economy: the same page written with fewer elements (layouts, components, lists, an element's own `content`, a
  class's states instead of `customCss`). The rest is not judged. Contrast, focus order and hardcoded values where a
  design token exists are not checked, so "make this page better" still rests on the agent's judgement, the
  screenshot and the accessibility view.
- **Intent.** Nothing tells the agent what a page is *for* — its audience or goal — beyond what the user says in the
  conversation.
- **Evals.** There is no golden corpus of spaces and edits that measures whether an agent's change improves a page
  without regressing it. Tests pin the contract of every tool, not the quality of what an agent does with them.
- **Built-in types a space has not used yet.** `plitzi://types` describes the types a space already uses plus those
  its plugins declare. The full built-in catalog is in `plitzi://render/types`.
