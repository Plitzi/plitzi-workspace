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

## Server data reads the same everywhere

- **One shape for a provider with a `query`.** A `runtime: 'server'` provider that only reads a JSON file the server
  serves answered the body itself, while the same provider in the browser publishes `{ status, data }` — so moving it
  to the server broke every binding. `publicFileResolver` and the builder's mock now answer `{ status, data }` too:
  `<source>.data.<field>` whichever runtime.
- **`schema.rsc.enabled` follows the space.** `authorSpace` turns it on when the space has a server provider (a
  `query` one included) and the spec does not say otherwise; nothing to remember.
- **Never inside a component.** The page server resolves a page's tree and its layouts only, so a server provider in a
  component rendered nothing, silently. Refused now (`server-provider-in-component`), with the fix: the provider on
  the page, the rows handed in as a prop.
- **Bindings held to the data.** `authorSpace` takes `data` — what a provider's `query` answers — and
  `publicData(folder)` (`@plitzi/sdk-authoring/node`) reads it from `public/`. A binding onto a path the file does not
  have is warned (`path-not-in-data`) with the keys it does have. Generated projects pass it.
- **`plitzi check` reads the data too.** A binding that reads a path its provider's answer lacks, a provider that
  failed (once, not as every element it left empty) and the rows each list rendered (`dataIssues`). `--ssr` names what
  the server's HTML lacks that the hydrated page has. The dev tools' badge and panel (`data-plitzi-devtools`) are hidden
  while `check` and `shot` look.

## Authoring, clearer where agents tripped

- **`controls` on a button** (`aria-controls`): named by the element's id; authoring gives that element the anchor and
  refuses an id the space lacks (`controls-unknown`); a saved document naming no anchor is warned
  (`controls-no-anchor`). The accordion recipe uses it.
- **`live` on a container** (`aria-live`, `polite` or `assertive`) for words that change while a visitor reads them.
- **`subType: 'p'`** for a paragraph made of parts; `span-holds-block` covers it.
- **`formControl` types `search`, `url` and `tel`.**
- **Images:** no `src` draws the SDK's own placeholder (the CDN one answered 404); `resize: false` keeps a picture as
  written; an SVG is never resized — `/_plitzi/img` redirects to it (`307`) instead of refusing it.
- **Messages:** an id taken by another page or layout names it and the id to write; a hyphenated source in a template
  (`list_study-plans`) is explained as valid; an unknown CSS property says to write it in `customCss`; an unknown
  variant on `custom` says it is never a prop of the component it hosts.
- **`plitzi explain` knows the helpers** — `bindTemplate`, `visibleWhen`, `variantFrom`, `activeOn`, `activeWhen`,
  `when`, `named`, `scope`, `source`, `twig` — and `motion`, from the presets the SDK plays (`MOTION_ENTERS`,
  `MOTION_TRIGGERS`, `MOTION_LOOPS`, now exported). `--list helpers` lists them.
- **`plitzi shot`** writes to `tmp/shots/` by default, and a full page shows the arrivals tied to the scroll as they
  end. `inspectPage` no longer reports an image a hidden ancestor hides.
- **Style inspector:** `container-type` in Size.
- **New recipes:** `server-data.ts`, `accordion.ts`.

## Matching a page to another, measured

- **A whole page is the whole page.** The SDK scrolls a pane of its own, so `shot`'s full-page picture was one
  screen; the pane is unrolled now (`unrollPage`) — the viewport untouched, so a `100vh` hero stays one screen.
- **`plitzi shot --compare` says why, not only how much.** Every lazy picture on both pages is loaded before they are
  taken (`loadImages`), so a section no longer swings between 23 % and 40 % on how many covers had arrived. Each section
  is compared where it is on the other page (`alignPictures` over row profiles): a page 400 px longer is said once, with
  the section the drift starts at, instead of a footer with the same styles reading 100 %. And the texts both pages
  have are paired (`pageTexts`, `compareTexts`), each with what it does differently there —
  `h1 "Learn CSS" — font-size 68px → 60px · y +19px` — position less the drift of its section. `comparePictures` takes
  its options as an object now (`{ regions, tolerance, align }`).
- **`--scheme` is the space's theme.** A space whose default is dark painted dark under `--scheme light`, and the file
  said light. `check` and `shot` now set the `theme` cookie a visitor's toggle writes; left out, the space's default is
  pictured and the file is named by the theme actually painted.

## `motion: { on: 'view' }` arrives once

`view` was tied to the scroll both ways: cards faded out again as the reader scrolled back up. Now it plays once, the
first time the element comes into view, with its `duration`, and stays — `revealOnView` (`@plitzi/sdk-shared/schema/
motionReveal`), one observer under the SDK's root, marks it `data-motion-seen`. The scroll-driven arrival is
`on: 'scroll'`. A page read without scripts shows them as they end (`@media (scripting: none)`); the builder's previews
and the MCP's local screenshots hold motion at its end. The builder's Motion tab has the three.

## Authoring advice that knows where and when

- **`class-conflict` says where both declarations are:** `styles('md-menu-button') at src/components/dropdown.ts:12,
  used by button at …, and styles('md-menu-button') at src/site/layout.ts:8, used by …` — `styles()` records its line as
  an element factory does.
- **`repeated-shape` leaves controls alone.** Siblings that read different sources or write different state keys — a
  menu for the language, one for the level — are not offered as a list.
- **`quiet: ['repeated-shape']`** on an element says a suggestion was left on purpose, and it is not offered again.
  Only suggestions' codes (`quiet-unknown`).
