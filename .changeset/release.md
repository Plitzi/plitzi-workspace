---
'@plitzi/cli': patch
'@plitzi/sdk-authoring': patch
'@plitzi/sdk-elements': patch
'@plitzi/sdk-interactions': patch
'@plitzi/sdk-mcp': patch
'@plitzi/sdk-schema': patch
'@plitzi/sdk-shared': patch
---

## The CLI's commands are named after what they act on

Every command sits under the thing it acts on — `plitzi element move`, never a bare `move` that could mean anything —
and only what acts on the project as a whole or the account stays at the top:

| Before | Now |
| --- | --- |
| `where`, `edit`, `remove`, `move` | `element where`, `element edit`, `element remove`, `element move` |
| `check`, `shot`, `import` | `page check`, `page shot`, `page import` |
| `space`, `pull`, `push`, `lint`, `fix` | `space use`, `space pull`, `space push`, `space lint`, `space fix` |
| `add plugin`, `pack plugin`, `upload plugin` | `plugin add`, `plugin pack`, `plugin upload` |
| `add runtime` | `runtime add` |
| `pack source` | `source pack` |
| `update` (alias of `upgrade`) | `upgrade` |

`create`, `verify`, `doctor`, `upgrade`, `explain`, `feedback`, `login`, `logout` and `whoami` stay at the top, beside
`functions`, `runtime`, `data` and `skills`. There are no aliases: a name asked for at the top that is a group's command
answers where it is — `There is no plitzi push: it is one of plitzi space push, plitzi runtime push, plitzi functions
push` — read off the commands themselves. A project's scripts (`lint:space`, `check`, `shot`) call the new names;
`plitzi upgrade --write` updates the ones the CLI wrote.

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
- **`plitzi element where <id | class | words>`** answers where the project's code writes an element — the file, the line and
  the call itself — asked of the code as it is now, so it follows an element wherever somebody moved it. A class is
  found by its name or by the variable that holds it (`nav-link`, `navLink`).
- **`plitzi element edit <id> --set key=value --remove key`** writes attributes in that call (`content` where the factory takes
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
- **`plitzi element where --by id|class|text`** reads a query one way; without it, the first reading that matches is answered
  and every other one that matched is said with its count and the command for it — a query that means two things is
  never answered as one. `plitzi element edit` reads its element by id alone.
- **A helper written once and called for many elements** is told apart: `locateElements` answers each element's
  `through` — the calls of the author's code that led to the one that wrote it — so `plitzi element where` says which other
  elements the same call writes and the call that leads to this one alone, and `plitzi element edit` changes a value the helper
  is handed where it is handed (`pageHead('about-head', 'About us')`), refuses an edit of a call that writes several
  elements unless `--every` says so, and never writes `content` beside words given as the factory's first argument.
- `plitzi explain` of a name that is the project's own says where to read it.
- **Nothing a write does is silent.** `plitzi_apply` answers `effects`: every change the batch made, read off the space
  before and after it (elements added or removed by subtree, attributes, classes, moves, styles, settings, connectors,
  actions), with a note where a changed attribute is one a binding computes; a batch that changed nothing says so, and
  a store with no persister leads the warnings as `NOT saved: …`. The intent tools answer those `effects`, whether it
  was `saved` and what was already so, refuse to take off a class the element does not wear and to write a value under
  a binding. `plitzi element edit` reads the whole space before and after the edit (`plitzi element readings`, in a fresh process),
  prints every change, and puts the files back when anything changed that was not asked, naming it; it refuses an
  attribute a binding computes, and `plitzi element where` marks those `Bound`. `canonicalJson` (`@plitzi/sdk-shared`) is
  what every before-and-after comparison is made with. Authoring keeps deep enough a call stack (64 frames) that a
  helper inside a helper is still told apart.
- `locateElements` answers the parts of every component too, in the component (`rootId` is its id): `plitzi element where`
  and `plitzi element edit` reach an element inside a component as they reach one on a page or a layout.

## Fixed

- **A layout no longer mounts twice when the page hydrates.** An element with `runtime: 'server'` was wrapped in its
  static shell while hydrating and handed back without it — under another key — on the next render, so React tore
  down everything under it and built it again. With a server provider around a layout (an `apiContainer` that draws
  no markup of its own), the whole layout's DOM was replaced on every page, and every `motion` arrival in it played
  twice: a visible flicker on load. The shell now stays around the element on both sides of hydration, under the same
  key, and only stops freezing (`frozen`).
- **A component's instance is written somewhere.** `component(…)` — and each child it places in a slot — rebuilt its
  spec with a spread and lost the marker of where the author wrote it: `plitzi element where` could not place an instance and
  `plitzi element edit` refused it. The original marker is carried (`carryWrittenAt`); `where` finds the words an instance
  hands its component, and `edit` writes an instance's props.
- `plitzi element edit` follows a value read off a list the call is repeated for (`item.question` in
  `QUESTIONS.flatMap(item => …)`) to the one entry that holds it, in the file the list is written in; when the shared
  value is not a literal it says where it comes from instead of offering `--every`.
- **`plitzi page check --element` says which class wins.** Each property more than one of the element's classes sets, at
  rest: the value shown, the class it comes from and what the others say — or that they all set it so. Which wins is
  asked of the page, each class taken off for a moment; a style change is verified in text, not with a picture.
- **`plitzi element where` reads more.** By words it finds every word an element says (`words` on `WrittenElement`: content,
  `label`, `title`, `alt`, `placeholder`, binding templates, an instance's props); by class it says where the class
  is declared (`locateClasses` in `@plitzi/sdk-authoring`); an element repeated over a list says which list, and its
  file; a page or a layout is placed at the object it is declared as.
- **`plitzi element edit` edits a page** by the attributes `where` shows (`seoPageTitle` written as `seoTitle`;
  `PAGE_SPEC_FIELDS` in `@plitzi/sdk-authoring`), refusing `layout` and `seoEnabled`, which are no field of their own;
  and a value read in more than one place (a list entry a nav and a menu both draw) changes them all only with
  `--every`, each named.
- **A component prop of a type that does not exist is refused** (`prop-type-unknown`, with the types there are):
  `type: 'string'` was accepted at run time, offered by no editor and checked against nothing. `BUILTIN_PARAM_TYPES`
  in `@plitzi/sdk-shared` is the list, and `BuiltinParamType` is derived from it.
- **`plitzi element remove <id>` and `plitzi element move <id> --before|--after <id>`** take an element out of the code that writes
  it, or reorder it among its siblings — following a section a helper returns to the helper's call — checked as
  `edit` is: a removal may take only the element and what it holds, a move only reorder its parent, or the file goes
  back. Styles and imports only the removed call used go with it, named; a helper left unread is said.
- **`plitzi verify`** runs the project's checks — author (no warning), lint:space, typecheck, lint, format — and every
  page with no parameter, and prints only what fails; a page it could not open is said as not checked. Generated
  projects get `npm run verify`, and their `AGENTS.md` names it as the way to leave the project passing.
- **A component's refusal says where it is written** (by its root's call).
- **`check --element`** says a class changes nothing on the element only when every property it sets stays without
  it, and names the other elements the class is on: changing the class changes them; taking it off this element does
  not.
- **An element's generated selector and binding ids are named after its id**, under its parent's place, not after its
  position among its siblings: a move renames nothing. Every space written in code gets new generated names once —
  the same rules, so nothing a visitor sees changes.
- A change of an element's children is said as what came, went or moved (`faq moved — now after hero, before pricing`).
- **`plitzi page check --click <id>`** clicks one element and says what changed — flows run and how each step ended, the
  page it went to, what scrolled, what is shown now and what no longer is, the state — or that nothing did, in those words; a flow that
  succeeded while nothing on the page changed is said as that. A click that could not be made, or a flow that failed,
  fails the check.
- **A refusal of the authored space's gate says where**: each of the validator's errors (`UNRESOLVED_INTERACTION_TARGET`,
  `UNRESOLVED_BINDING_SOURCE`, …) carries the file and line of the element it is about, and a name nothing answers to is
  offered the nearest element that answers the step it was for (`openModal('search')` → `search-modal`, not the
  `search-q` field), or the few that do. `SchemaValidationError` gains `missing` and `wantedBy` (`@plitzi/sdk-schema`).
- **`plitzi element where` finds the words a list's rows show** when the list is handed them as data (`items:
  [...PLANS]`), and says the list they are the entries of and its file (`Its rows are the entries of PLANS
  (src/space/enterprise/content.ts)`).
- `plitzi page check --click` says what is **shown** now and what no longer is (drawn, wherever the page is scrolled),
  not "on screen".
- `plitzi upgrade` says packages installed locally in one line past three, and a skill rewritten within the same
  version as that, not `0.38.7 → 0.38.7`.
- **What `element edit`, `remove` and `move` read back goes through the gate `npm run author` does**: a change that
  leaves the space refused — a flow still opening a modal that was removed — is put back, the refusal said with where.
  `element remove` refuses before writing when another element's flows act on what it takes away, and says what it
  took once, by the outermost element (`search-modal removed, with 18 inside`). Moving an element beside itself is
  refused as nothing to do.
- **An id, a plugin folder or a data file written a letter off is offered the nearest one** (`element where`, `edit`,
  `remove`, `move`, `plugin pack`, `data describe`).
- **A project file that does not load is said at its file and line** — `src/space/hero.ts:139: Expected ','` — by the
  server, `npm run author` and every CLI command, never as a stack (`ProjectModuleError` and `moduleProblem` in
  `@plitzi/sdk-authoring/node`).
- **`plitzi verify` stops at the first failure** — one broken file fails every later step the same way — and says the
  rest as not run (`--keep-going` runs them anyway); `--no-pages` no longer fails a run that passed.
- **`plitzi space fix` no longer drops attributes written one level too deep**: `attributes: { value: 5 }` where
  `value: 5` was meant is put in its place (a new `unwrap` fix), not removed with what it said.
- **`plitzi explain <type>` explains the project's own elements** (`src/plugins/`), and `plugin add` prints how to place
  one with the attributes it was declared with.
- **`plitzi data describe` says an object keyed by data once**, as a map of one shape with how many keys, so a file of
  five hundred articles reads as one.
- **`plitzi page check` says a path no page answers before opening it**, with the paths the pages do answer — never a
  redirect home read as a page for signed-in visitors.
- **`copyToClipboard(text)`**, a utility step (`@plitzi/sdk-interactions`, built with `copyToClipboard` in
  `@plitzi/sdk-authoring`): a "Copy link" button had no step to write with. A browser that gives the page no clipboard
  fails the step, so a toast after it is never said of a copy that was not made.
- **`plitzi explain` lists the values a param takes only when it is a choice** (`select`): `setState`'s `value` read
  as `'true' | 'false'`, the examples of a free value taken for its only ones.
- **`plitzi page check --click` says what the page said** — a toast or an alert, `said: "Link copied"` — and **a form
  the browser held back**, with the field and the browser's reason, never as a click that changed nothing.
- **`plitzi page check --click <id> --fill <id>=<value>`** fills fields before the click as a visitor does (typed, an
  option chosen, a box ticked), so a form's success flow is checked, not only its refusal when empty. A container of
  several fields is refused with their ids; a field filled inside another element says whose it is.
