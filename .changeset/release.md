---
'@plitzi/sdk-auth': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-dev-tools': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-event-bridge': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-navigation': patch
'@plitzi/sdk-plugins': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
'@plitzi/sdk-style': patch
'@plitzi/sdk-variables': patch
'@plitzi/plitzi-builder': patch
'@plitzi/cli': patch
'@plitzi/sdk-mcp': patch
'@plitzi/plitzi-sdk': patch
'@plitzi/sdk-server': patch
---

## `plitzi push`: a self-hosted project back on its space

`plitzi create --from` and `plitzi pull` took a space out as a project and kept it in step; nothing put the project's
own changes back but a command per part, and no command at all for its pages. `plitzi push` is the way back
(`docs/en/projects-from-spaces.md`):

- **What changed, or what is named.** `plitzi push` sends what changed since the project last had the space — at a
  terminal, offered as a ticked list to choose from (`↑/↓`, space, Enter); `plitzi push space functions` sends only
  those parts: `space`, `functions`, `runtime`, `plugins`.
- **In order:** each changed plugin packed and uploaded (`pack plugin` + `upload plugin`, `--cdn`/`--bucket`), the
  functions, the runtime, then the space — `src/space.ts` authored, the actions `src/actions.ts` serves and the manifests
  in `src/connectors/` — as the space's draft. Never a published environment.
- **Never over the builder's work unseen.** The export now carries which state the draft is in (`SpaceExport.draft`),
  recorded in `.plitzi/space.json` by `create --from` and `pull`; a push names it, and a draft edited since is refused
  until `--force`. A project that never had the space may take one nobody has worked on; one holding work takes
  `--force`.
- **Then `pull` follows it.** `.plitzi/space.json` records what was sent — only that, so a builder's change to a part
  not pushed is still the next pull's — and a project that started on its own works with `pull` from then on.
- `@plitzi/sdk-shared/source`: `SpaceImport` / `SpaceImportResult` (`SPACE_IMPORT_FORMAT`), the push's one shape for
  both ends, beside `SpaceExport`, which gains `draft`.
- `functions push`, `runtime push` and `upload plugin` keep their behaviour; their cores are what `push` runs.

## A project's folders: `tmp/` for what it writes, `.plitzi/` committed, `public/` said to be public

- **`tmp/` is what a project writes for itself.** `@plitzi/sdk-server` keeps the plugins it builds in `tmp/.sdk-plugins`
  and resized pictures in `tmp/images` by default (were `.sdk-plugins` and `.plitzi/images`). A project the CLI writes
  puts the port it took (`tmp/dev-server.json`), the space as last authored while developing (`tmp/space.json`) and
  Playwright's output (`tmp/visual`) there too, and its `.gitignore` ignores `tmp` — one line for all of it.
- **`.plitzi/` is committed.** The scaffold ignored it whole, so a clone lost `space.json`, `functions.json` and
  `scaffold.json` — what `pull`, `push`, `functions push` and `upgrade` stand on. Now it holds only what the CLI records.
  `npx plitzi upgrade --write` brings an existing project's `.gitignore` up.
- **No `space/offline-data.json`.** `npm run author` checks the space and writes nothing; the server asks it for the
  documents with `--out tmp/space.json` while developing. The space is `src/space.ts`, and nothing beside it says
  otherwise.
- **`public/` is on the internet.** The generated `README.md` and `AGENTS.md`, the CLI and authoring skills, the MCP
  guide, `@plitzi/sdk-server`'s README and the docs now say so where data goes: never a secret, a key or data only
  some visitors may read — in `public/`, or in a space's documents, which reach every visitor too.

## An agent leaves the project clean

`AGENTS.md` gains **Keep the project clean** — nothing unused left behind, scratch work in `tmp/`, one of everything,
files a reader can find, and `author`, `typecheck`, `lint`, `format` and `check` passing — and the authoring skill's
review checklist a **Nothing left behind** section.

## The dev tools' X-ray is the outlines too

The QA tab had **Outlines** (every element's box, its type and id when pointed at) and **X-ray** (the same boxes,
fainter, with what is wired to each). They are one tool now: the X-ray draws every box with its type and id, and marks
the wiring picked — all of it, one kind, or **Boxes only**.

## A new space that says where to go

The space a new account and `plitzi create` start from keeps its welcome, and gains the three ways to change it — the
builder, code (with the command to run) and an agent — before the guides, which are shorter. Header, navigation, main
and footer are landmarks; the grid behind the top fades out instead of ending at an edge; the footer's line spans the
content; the links say their words and icon themselves, with no suggestion left.
