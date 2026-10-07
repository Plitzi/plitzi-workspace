---
'@plitzi/cli': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-mcp': patch
---

## Agents load less to do the same (RFC 0025)

- **The MCP lists the operations vocabulary once.** A connection with a space listed ~69k tokens of tools before an
  agent did anything — the operations schema five times. `plitzi_apply` carries it; `plitzi_render` lists only its
  operations' types beside it (and keeps the whole schema on a guest connection, where it is alone). The listing is
  now ~18k tokens.
- **`plitzi_validate` is `plitzi_apply`'s `dryRun`**, which already answered the same; the `validate` function, its
  `validateShape` and `ValidateInput` are gone from `@plitzi/sdk-mcp`.
- **`plitzi_apply` looks at the page it would leave**: `look: 'html' | 'image' | 'accessibility' | 'both'` (with
  `pageRef`, `viewport`, `fullPage`) renders it — with `dryRun`, as the batch would leave it, nothing saved; without, as
  saved. Check, look and save with the operations written twice, not four times.
- **`plitzi_look` is the one way to see a saved page** — its accessibility outline (the default: text, cheap), its HTML
  or a PNG; `plitzi_preview` and `plitzi_screenshot` are gone. It is always offered: without a browser service it answers
  the HTML and says so.
- **`plitzi_describe_operation { type }`** answers one operation's schema, or every type there is; a type that does not
  exist is answered with the nearest one.
- `closest` is exported from `@plitzi/sdk-authoring`: the nearest of a closed list of names.
- **`plitzi where <id | class | words>`** answers where the project's code writes an element — the file, the line and
  the call itself — asked of the code as it is now, so it follows an element wherever somebody moved it. A class is
  found by its name or by the variable that holds it (`nav-link`, `navLink`).
- **`plitzi edit <id> --set key=value --remove key`** writes attributes in that call (`content` where the factory takes
  it first), keeping each one's kind, formatted as the project formats, and keeps the change only if the space still
  authors with every value there. Behind both, `locateElements` in `@plitzi/sdk-authoring`: every element with the call
  that wrote it.
- A generated project's `AGENTS.md` says to ask `where` instead of keeping a note of where things are.
- **`plitzi doctor` says one fact once**: packages installed from the same place, and packages behind the same version,
  are one line each — on a project installed from local tarballs, ~1,050 tokens of output became ~330.
- **A mistake costs one line.** An operation type that does not exist is answered with the nearest one; a field an
  operation, an element, a binding or a flow step does not have is refused naming the one meant — it used to be dropped,
  and `prop` for `props` answered success having applied nothing. An element type spelt with other capitals
  (`Heading`) is read as the catalog spells it and said in `warnings`.
- **The same batch refused twice is not run a third time** (`REPEATED_BATCH`), and the second refusal says so; `plitzi
edit` does the same, kept in the project's `tmp/refusals.json`.
- **`plitzi_apply`'s `look` renders a batch through the path a save takes** (`draftBatch`): a
  `repeatElement` expanded, what has one reading read, the same refusals.
- **Each skill is a core an agent reads every time, and references it opens when the task names one.** The core —
  what it is for, the rules that go wrong most, a table routing each task to its one file — is held to 1,500 tokens:
  `plitzi-authoring` went from ~4,000 to ~920 (every rule kept in `reference/rules.md`, the recipes indexed in
  `reference/recipes.md`, every reference in `reference/index.md`), `plitzi-cli` from ~4,000 to ~820 (projects,
  plugins and troubleshooting are references of their own), `plitzi-render` from ~3,100 to ~1,050.
- **Intent tools on the MCP**: `plitzi_set_attributes`, `plitzi_set_classes` (classes added or removed, the rest
  kept), `plitzi_bind_attribute`, `plitzi_place_component`, `plitzi_add_page` — a few parameters, the element by its ref alone (the
  page is found, a ref that does not exist answered with the nearest), checked and saved as `plitzi_apply` saves, and
  answered in a line with the next step.
- **An element may only wear a class the space has, or the batch declares**: `plitzi_apply` used to save one nothing
  defines — rendered unstyled, said by nobody. It is refused naming the nearest class.
- **`plitzi explain` answers any export of `@plitzi/sdk-authoring`** — `pageFamily`, `styles`, `SpaceSpec` — with its
  signature and the first paragraph of its doc, read from the `.d.ts` the project installed: a few dozen tokens where an
  agent used to search ~180k of published types.
- **`plitzi where --by id|class|text`** reads a query one way; without it, the first reading that matches is answered
  and every other one that matched is said with its count and the command for it — a query that means two things is
  never answered as one. `plitzi edit` reads its element by id alone.
